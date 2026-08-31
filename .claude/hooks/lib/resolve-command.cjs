#!/usr/bin/env node
/**
 * .claude/hooks/lib/resolve-command.cjs
 *
 * ONE answer to "what command is this?", shared by every PreToolUse Bash guard.
 *
 * WHY THIS EXISTS (PP-6t3c, PP-ar8a). Each guard used to answer that question
 * with its own regex, and each answered differently. The merge boundary
 * (PP-wi85) was bypassable on `main`: `gh pr merge 123` blocked, but
 * `eval "gh pr merge 123"`, `env gh pr merge 123`, `time gh pr merge 123` and
 * `xargs -I{} gh pr merge {}` all sailed through, because a command the matcher
 * could not parse silently read as "not a match".
 *
 * The missing concept was UNRESOLVABLE. A guard needs three answers, not two:
 * "this is command X", "this is definitely not command X", and "I cannot tell".
 * This module returns all three; each guard then picks its own posture on the
 * third. Both in-repo consumers block on it, because both guard a boundary
 * where a miss is unrecoverable: the merge guard (a merged PR cannot be
 * un-merged) and the branch-switch guard (a switched-out worktree strands
 * another session's work). A guard whose failure mode is merely a slower or
 * noisier run should allow instead — nothing in this repo is in that class
 * today, but the third answer exists so such a guard can be written.
 *
 * WHAT IT DOES
 *   - Quote-aware tokenizer: quoted spans become ONE argument, never a command.
 *     `echo "run merge-pr.sh"` resolves to `echo`, not `merge-pr.sh`.
 *   - Heredoc bodies are consumed during tokenization (so quote-awareness still
 *     applies to the `<<TAG` operator itself) and never parsed as commands.
 *   - Redirections and their targets are dropped, not mistaken for arguments.
 *   - Segments are split on real shell separators: && || ; | & newline ( ).
 *   - Leading shell control words are removed from each segment: conditionals,
 *     negation, brace groups, loops, function bodies, coprocesses, and timed
 *     compound commands cannot occupy the command slot and hide the command
 *     they govern.
 *   - Per segment, the EFFECTIVE command is resolved by skipping leading
 *     `VAR=value` assignments and wrappers that do not consume the command slot
 *     (`sudo`, `env`, `command`, `time`, `nice`, `xargs`, `timeout`, ...),
 *     INCLUDING those wrappers' own flags — `sudo -u root chmod +x f` resolves
 *     to `chmod`.
 *   - Literal shell payloads are re-parsed, not skipped: `eval "…"`,
 *     `sh -c "…"`, `bash -c '…'`, `$(…)` and backtick substitutions all
 *     contribute their own segments.
 *   - Anything whose command slot cannot be known statically — `eval "$CMD"`,
 *     `sh -c "$X"`, `$(pick) pr merge`, an unbalanced quote — is reported in
 *     `unresolvable` instead of being silently dropped.
 *
 * WHAT IT IS NOT: a shell. It does not expand variables, evaluate globs, or
 * execute control flow or fully parse `for`/`case` grammar. The threat model is
 * a well-meaning agent
 * that wraps a command (accidentally or to "work around" a guard), not an
 * attacker with unbounded shell tricks. Guards on a hard boundary should still
 * treat `unresolvable` as suspicious rather than assuming it is safe.
 *
 * KNOWN LIMITATIONS (all fail toward `unresolvable`, never toward a silent
 * "not a match"):
 *   - ANSI-C quoting (`$'it\'s'`) is not supported. It is valid bash, but this
 *     reads it as a plain single-quoted span, where the backslash-escaped quote
 *     looks unbalanced — so a valid command using it is reported `unresolvable`
 *     rather than resolved.
 *   - `find -exec cmd \;` and `watch cmd` are not treated as wrappers, so the
 *     inner command is seen as arguments.
 *   - Only ONE `-c` payload per shell invocation is followed.
 *
 * API
 *   resolveCommand(commandString, options?) → {
 *     segments:     Segment[],       // { command, name, args, raw }
 *     unresolvable: Unresolvable[],  // { reason, text }
 *   }
 *
 *   Segment.command  the resolved command token, unquoted, as written
 *                    (e.g. "./scripts/workflow/merge-pr.sh")
 *   Segment.name     its basename (e.g. "merge-pr.sh") — what guards match on
 *   Segment.args     the tokens after it, unquoted, in order
 *   Segment.raw      normalized reconstruction (`[command, ...args].join(" ")`),
 *                    for messages only — NOT source-exact
 *
 *   options.splitNewlines  default true. Pass false to keep a newline from
 *                          separating segments — see PP-qota for why a guard
 *                          might want that.
 */

"use strict";

const path = require("node:path");

// Wrappers that run another command rather than being the command. Each entry
// carries:
//   valueFlags   – the wrapper's OWN flags that consume a separate token
//   payloadFlags – flags whose value is a shell PROGRAM, re-parsed rather than
//                  skipped (GNU `env -S 'gh pr merge 123'`)
//   positionals  – positional arguments the wrapper eats before the command
//                  (`timeout 30 cmd`)
//
// Skipping a wrapper's flags is deliberate. The previous per-guard logic
// stopped at the first flag-like token and gave up, which is exactly why
// `sudo -u root chmod +x f` slipped past the chmod guard while `sudo chmod` did
// not. `payloadFlags` is the counterpart: skipping `-S`'s value would eat the
// command itself.
const makeWrapper = (valueFlags, options = {}) => ({
  valueFlags: new Set(valueFlags),
  payloadFlags: options.payloadFlags ?? [],
  positionals: options.positionals ?? 0,
});

const WRAPPERS = new Map([
  ["sudo", makeWrapper(["-u", "-g", "-U", "-p", "-r", "-t", "-C", "-D", "-h", "--user", "--group", "--other-user", "--prompt", "--role", "--type", "--close-from", "--chdir", "--host"])],
  ["doas", makeWrapper(["-u", "-C"])],
  ["env", makeWrapper(["-u", "--unset", "-C", "--chdir"], { payloadFlags: ["--split-string", "-S"] })],
  ["command", makeWrapper([])],
  ["builtin", makeWrapper([])],
  ["exec", makeWrapper(["-a"])],
  ["time", makeWrapper(["-o", "--output", "-f", "--format"])],
  ["nice", makeWrapper(["-n", "--adjustment"])],
  ["ionice", makeWrapper(["-c", "-n", "-p", "-P", "-u"])],
  ["nohup", makeWrapper([])],
  ["setsid", makeWrapper([])],
  ["stdbuf", makeWrapper(["-i", "-o", "-e", "--input", "--output", "--error"])],
  ["timeout", makeWrapper(["-s", "--signal", "-k", "--kill-after"], { positionals: 1 })],
  // `xargs [flags] CMD ARGS…` — CMD really does run, with extra args appended
  // from stdin. Treating xargs as a wrapper is what closes
  // `xargs -I{} gh pr merge {} < prs.txt`.
  ["xargs", makeWrapper(["-I", "-i", "-n", "-P", "-d", "-E", "-L", "-s", "-a", "--replace", "--max-args", "--max-procs", "--delimiter", "--eof", "--max-lines", "--max-chars", "--arg-file"])],
]);

// Shells: `sh -c "<program>"` re-parses its argument, and `sh <file>` makes the
// file the effective command (`bash scripts/workflow/merge-pr.sh`).
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "ash"]);

const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*[+:]?=/;

// Shell reserved words that may lead a command inside one of the tokenizer's
// separator-delimited segments. They are syntax, not the effective command:
// `if gh pr merge 1; then ...; fi` must expose `gh`, not `if`.
//
// Only UNQUOTED leading words are stripped. Quoting disables reserved-word
// recognition in the shell too, so `"if" gh ...` remains an attempted command
// named `if`. Terminators are included so their structural-only segments do not
// trip the no-silent-drop invariant below.
const SHELL_CONTROL_WORDS = new Set([
  "if",
  "then",
  "elif",
  "else",
  "fi",
  "while",
  "until",
  "do",
  "done",
  "!",
  "{",
  "}",
  "function",
  "coproc",
]);

// How deep to follow eval / sh -c / $() nesting before giving up. Two levels is
// already exotic; the cap only bounds pathological input.
const MAX_DEPTH = 5;

// --- Tokenizer ---------------------------------------------------------------

/**
 * Read a balanced `$( … )` / `<( … )` / `>( … )` span starting at the open
 * paren index. Skips over quoted spans so a `)` inside quotes does not close
 * it. Returns { body, next } where `next` is the index just past the `)`.
 */
function readParenSpan(src, openIdx) {
  let depth = 0;
  let i = openIdx;
  const n = src.length;
  const start = openIdx + 1;
  while (i < n) {
    const c = src[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const close = findQuoteEnd(src, i);
      i = close === -1 ? n : close + 1;
      continue;
    }
    if (c === "(") {
      depth++;
      i++;
      continue;
    }
    if (c === ")") {
      depth--;
      i++;
      if (depth === 0) return { body: src.slice(start, i - 1), next: i };
      continue;
    }
    i++;
  }
  return { body: src.slice(start), next: n, unterminated: true };
}

/** Index of the closing quote matching the one at `openIdx`, or -1. */
function findQuoteEnd(src, openIdx) {
  const q = src[openIdx];
  for (let i = openIdx + 1; i < src.length; i++) {
    if (q === '"' && src[i] === "\\") {
      i++;
      continue;
    }
    if (src[i] === q) return i;
  }
  return -1;
}

/** Read a backtick span. Returns { body, next }. */
function readBacktickSpan(src, openIdx) {
  for (let i = openIdx + 1; i < src.length; i++) {
    if (src[i] === "\\") {
      i++;
      continue;
    }
    if (src[i] === "`") return { body: src.slice(openIdx + 1, i), next: i + 1 };
  }
  return { body: src.slice(openIdx + 1), next: src.length, unterminated: true };
}

/**
 * Tokenize a command string into words and separator operators.
 *
 * Returns { tokens, unbalanced } where each token is either
 *   { type: "word", value, quoted, escaped, dynamic, subs }
 *     value   – unquoted text
 *     quoted  – any part of it came from inside quotes
 *     escaped – any part of it was escaped outside quotes
 *     dynamic – contains a variable/substitution, so its literal text is
 *               not the whole story
 *     subs    – bodies of `$( )` / backtick substitutions found inside it
 * or
 *   { type: "op", value }  – one of && || ;; ; |& | & ( ) \n
 */
function tokenize(src) {
  const tokens = [];
  let unbalanced = false;
  let cur = null;
  let dropWords = 0;
  const pendingHeredocs = [];

  const ensure = () => {
    if (!cur) {
      cur = {
        value: "",
        quoted: false,
        escaped: false,
        dynamic: false,
        subs: [],
      };
    }
    return cur;
  };
  const flush = () => {
    if (!cur) return;
    const word = cur;
    cur = null;
    if (dropWords > 0) {
      dropWords--;
      return;
    }
    tokens.push({ type: "word", ...word });
  };
  const pushOp = (value) => {
    flush();
    // A redirect target cannot cross a separator, so a pending drop must not
    // either — otherwise `cmd >; cmd2` would swallow `cmd2` in silence.
    dropWords = 0;
    tokens.push({ type: "op", value });
  };

  /** Consume heredoc bodies queued by `<<TAG` operators on the line just ended.
   *
   *  The terminator must match the tag EXACTLY, as bash requires — only `<<-`
   *  allows leading tabs, and nothing allows surrounding spaces. Accepting a
   *  trimmed match would end the body early on an indented `EOF` inside it, and
   *  the remaining body lines would then be parsed as real commands. */
  const consumeHeredocs = (from) => {
    let i = from;
    while (pendingHeredocs.length > 0) {
      const { tag, stripTabs } = pendingHeredocs.shift();
      for (;;) {
        const nl = src.indexOf("\n", i);
        const line = nl === -1 ? src.slice(i) : src.slice(i, nl);
        // Tolerate CRLF input; that is a line ending, not body content.
        const cmp = (stripTabs ? line.replace(/^\t+/, "") : line).replace(
          /\r$/,
          ""
        );
        i = nl === -1 ? src.length : nl + 1;
        if (cmp === tag || nl === -1) break;
      }
    }
    return i;
  };

  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];

    if (c === "\n") {
      pushOp("\n");
      i = consumeHeredocs(i + 1);
      continue;
    }

    if (c === " " || c === "\t" || c === "\r") {
      flush();
      i++;
      continue;
    }

    if (c === "\\") {
      if (src[i + 1] === "\n") {
        i += 2; // line continuation
        continue;
      }
      const t = ensure();
      t.escaped = true;
      t.value += src[i + 1] ?? "";
      i += 2;
      continue;
    }

    if (c === "'") {
      const end = findQuoteEnd(src, i);
      const t = ensure();
      t.quoted = true;
      if (end === -1) {
        unbalanced = true;
        t.value += src.slice(i + 1);
        i = n;
        continue;
      }
      t.value += src.slice(i + 1, end);
      i = end + 1;
      continue;
    }

    if (c === '"') {
      const t = ensure();
      t.quoted = true;
      i++;
      let closed = false;
      while (i < n) {
        const d = src[i];
        if (d === "\\") {
          t.value += src[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (d === '"') {
          closed = true;
          i++;
          break;
        }
        if (d === "$" && src[i + 1] === "(") {
          const span = readParenSpan(src, i + 1);
          t.subs.push(span.body);
          t.dynamic = true;
          i = span.next;
          continue;
        }
        if (d === "`") {
          const span = readBacktickSpan(src, i);
          t.subs.push(span.body);
          t.dynamic = true;
          i = span.next;
          continue;
        }
        if (d === "$") {
          t.dynamic = true;
          t.value += d;
          i++;
          continue;
        }
        t.value += d;
        i++;
      }
      if (!closed) unbalanced = true;
      continue;
    }

    if (c === "$" && src[i + 1] === "(") {
      const span = readParenSpan(src, i + 1);
      const t = ensure();
      t.subs.push(span.body);
      t.dynamic = true;
      i = span.next;
      continue;
    }

    if (c === "`") {
      const span = readBacktickSpan(src, i);
      const t = ensure();
      t.subs.push(span.body);
      t.dynamic = true;
      i = span.next;
      continue;
    }

    if (c === "$") {
      ensure().dynamic = true;
      ensure().value += c;
      i++;
      continue;
    }

    // Process substitution: <( … ) / >( … ) — the body is a real command.
    if ((c === "<" || c === ">") && src[i + 1] === "(") {
      const span = readParenSpan(src, i + 1);
      const t = ensure();
      t.subs.push(span.body);
      t.dynamic = true;
      i = span.next;
      continue;
    }

    // Heredoc: `<<TAG`, `<<-TAG`, `<<'TAG'`. Detected HERE, inside the
    // quote-aware walk, so `echo "use <<EOF"` cannot swallow the rest of the
    // input as a heredoc body.
    if (c === "<" && src[i + 1] === "<" && src[i + 2] !== "<") {
      let j = i + 2;
      let stripTabs = false;
      if (src[j] === "-") {
        stripTabs = true;
        j++;
      }
      while (src[j] === " " || src[j] === "\t") j++;
      let tag = "";
      if (src[j] === "'" || src[j] === '"') {
        const q = src[j];
        j++;
        while (j < n && src[j] !== q) tag += src[j++];
        j++;
      } else {
        while (j < n && /[A-Za-z0-9_]/.test(src[j])) tag += src[j++];
      }
      if (tag) {
        pendingHeredocs.push({ tag, stripTabs });
        flush();
        i = j;
        continue;
      }
    }

    // Plain redirection: drop the operator and its target word, and drop a
    // bare leading fd digit (`2>&1`) that is already in the current token.
    if (c === "<" || c === ">") {
      if (cur && !cur.quoted && /^\d+$/.test(cur.value)) cur = null;
      flush();
      i++;
      while (i < n && (src[i] === ">" || src[i] === "<" || src[i] === "&")) i++;
      dropWords++;
      continue;
    }

    const two = src.slice(i, i + 2);
    if (two === "&&" || two === "||" || two === ";;" || two === "|&") {
      pushOp(two);
      i += 2;
      continue;
    }
    if (c === ";" || c === "|" || c === "&" || c === "(" || c === ")") {
      pushOp(c);
      i++;
      continue;
    }

    ensure().value += c;
    i++;
  }

  flush();
  return { tokens, unbalanced };
}

// --- Segment resolution -------------------------------------------------------

/** Split a token stream into per-segment word arrays. */
function splitSegments(tokens, splitNewlines) {
  const segments = [];
  let current = [];
  for (const token of tokens) {
    if (token.type === "op") {
      if (token.value === "\n" && !splitNewlines) {
        // Newline is not a separator for this caller: keep accumulating. The
        // words on the next line join this segment and (being neither the
        // command slot nor a recognised wrapper) simply read as arguments.
        continue;
      }
      if (current.length > 0) segments.push(current);
      current = [];
      continue;
    }
    current.push(token);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

/**
 * Is `words[i]` one of this wrapper's PAYLOAD flags — a flag whose value is a
 * shell program rather than a plain value? GNU `env -S 'gh pr merge 123'` is
 * the one that matters: env splits the string and runs it.
 *
 * Returns a `{ kind: "payload", word }` slot, or null. Handles all three
 * spellings: `-S STR`, `-SSTR`, `--split-string=STR`.
 */
function readPayloadFlag(wrapper, words, i) {
  const word = words[i];
  const flag = word.value;
  for (const pf of wrapper.payloadFlags) {
    if (flag === pf) {
      const next = words[i + 1];
      // `env -S` with nothing after it runs nothing — fall through to the
      // ordinary flag walk rather than inventing an empty payload.
      return next ? { kind: "payload", word: next } : null;
    }
    const attached = pf.startsWith("--")
      ? flag.startsWith(`${pf}=`) && flag.slice(pf.length + 1)
      : flag.length > pf.length && flag.startsWith(pf) && flag.slice(pf.length);
    if (attached) {
      return {
        kind: "payload",
        word: { value: attached, dynamic: word.dynamic, subs: [] },
      };
    }
  }
  return null;
}

/**
 * Resolve a segment's command slot past leading `VAR=value` assignments and
 * wrappers. Returns one of:
 *   { kind: "command", index }  – words[index] is the effective command
 *   { kind: "payload", word }   – word.value is a shell program to re-parse
 *   { kind: "none" }            – the segment is assignments-only (or empty),
 *                                 which is a real "no command", not a failure
 *
 * There is deliberately NO "gave up" result. A wrapper that consumes the whole
 * segment (`sudo -l`, `env`, `timeout 30`) resolves to the WRAPPER itself,
 * because that is what actually runs. An earlier revision returned -1 there and
 * `resolveSegment` dropped the segment in silence — which is how
 * `env -S 'gh pr merge 123'` slipped past the merge guard: `-S` was modelled as
 * an ordinary value flag, the scan ate the payload, and the segment vanished.
 * A guard cannot pick a safe posture on a signal it never receives.
 */
function resolveCommandSlot(words) {
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (ENV_ASSIGN.test(w.value)) {
      i++;
      continue;
    }
    const wrapper = WRAPPERS.get(path.basename(w.value));
    if (!wrapper) return { kind: "command", index: i };

    const wrapperIdx = i;
    i++;
    // Skip the wrapper's own flags (and the values they consume).
    while (i < words.length && words[i].value.startsWith("-")) {
      const flag = words[i].value;
      if (flag === "--") {
        i++;
        break;
      }
      const payload = readPayloadFlag(wrapper, words, i);
      if (payload) return payload;

      // The value may already be attached — `--max-args=3`, `-I{}`, `-n1`.
      // Only a bare flag consumes the following token.
      const hasEquals = flag.includes("=");
      const bare = hasEquals ? flag.slice(0, flag.indexOf("=")) : flag;
      const attachedShortValue =
        !hasEquals && !bare.startsWith("--") && flag.length > 2;
      i++;
      if (!hasEquals && !attachedShortValue && wrapper.valueFlags.has(bare)) i++;
    }
    // Skip the wrapper's own positional arguments (`timeout 30 cmd`).
    for (let p = 0; p < wrapper.positionals && i < words.length; p++) i++;

    // Nothing left after the wrapper — the wrapper IS the command.
    if (i >= words.length) return { kind: "command", index: wrapperIdx };
  }
  return { kind: "none" };
}

/** Best-effort human-readable text for an unresolvable report. A word that is
 *  purely a substitution has an empty literal value, so fall back to the
 *  substitution body — `$(pick) pr merge` should not report as just `pr merge`. */
function describeWords(words) {
  return words
    .map((w) => (w.value === "" && w.subs.length > 0 ? `$(${w.subs.join("; ")})` : w.value))
    .join(" ")
    .trim();
}

/** Remove leading shell syntax so the governed command owns the command slot. */
function stripLeadingShellControlWords(words) {
  let i = 0;
  while (i < words.length) {
    const word = words[i];
    if (
      word.quoted ||
      word.escaped ||
      !SHELL_CONTROL_WORDS.has(word.value)
    ) {
      break;
    }

    if (word.value === "function" || word.value === "coproc") {
      const braceIdx = words.findIndex(
        (candidate, index) =>
          index > i &&
          !candidate.quoted &&
          !candidate.escaped &&
          candidate.value === "{"
      );
      if (braceIdx !== -1) {
        i = braceIdx + 1;
        continue;
      }

      // `coproc command ...` runs the following simple command directly.
      // A function definition without a same-segment brace has its compound
      // body in a later tokenizer segment (`function f () { ... }`), so keep
      // the header's existing ordinary classification and let that segment
      // expose the body.
      if (word.value === "function") break;
    }

    i++;
  }
  return words.slice(i);
}

/**
 * Bash's bare, unquoted `time` is reserved syntax and can prefix a compound
 * command (`time if ...`, `time { ...; }`). Consume that one syntax prefix so
 * the newly-exposed control word can be normalized too. Do not do this after
 * ordinary wrappers: `env time if ...` and `/usr/bin/time if ...` attempt to
 * execute a command named `if`, rather than asking Bash to parse a conditional.
 */
function stripLeadingShellTimePrefix(words) {
  let i = 0;
  while (i < words.length && ENV_ASSIGN.test(words[i].value)) i++;

  const word = words[i];
  if (!word || word.quoted || word.escaped || word.value !== "time") {
    return words;
  }

  const wrapper = WRAPPERS.get("time");
  i++;
  while (i < words.length && words[i].value.startsWith("-")) {
    const flag = words[i].value;
    if (flag === "--") {
      i++;
      break;
    }

    const hasEquals = flag.includes("=");
    const bare = hasEquals ? flag.slice(0, flag.indexOf("=")) : flag;
    const attachedShortValue =
      !hasEquals && !bare.startsWith("--") && flag.length > 2;
    i++;
    if (!hasEquals && !attachedShortValue && wrapper.valueFlags.has(bare)) i++;
  }

  // A prefix without a following pipeline is still the effective command for
  // classification/backstop purposes; do not turn it into structural silence.
  return i < words.length ? words.slice(i) : words;
}

/** Normalize leading shell syntax until no timed compound prefix remains. */
function normalizeLeadingShellSyntax(words) {
  let effectiveWords = stripLeadingShellControlWords(words);
  while (effectiveWords.length > 0) {
    const afterTime = stripLeadingShellTimePrefix(effectiveWords);
    if (afterTime === effectiveWords) break;
    effectiveWords = stripLeadingShellControlWords(afterTime);
  }
  return effectiveWords;
}

/**
 * Resolve one segment into zero or more Segments, following literal shell
 * payloads. Pushes into `out.segments` / `out.unresolvable`.
 */
function resolveSegment(words, out, depth, options) {
  // Any substitution anywhere in the segment is itself a command to resolve.
  for (const w of words) {
    for (const body of w.subs) {
      resolveInto(body, out, depth + 1, options);
    }
  }

  const effectiveWords = normalizeLeadingShellSyntax(words);

  // A segment made only of reserved words (`then`, `fi`, `done`, `}`) is shell
  // structure, not a command and not an ambiguity.
  if (effectiveWords.length === 0) return;

  const slot = resolveCommandSlot(effectiveWords);

  // `env -S '<program>'` — GNU env splits the string and runs it.
  if (slot.kind === "payload") {
    if (slot.word.dynamic) {
      out.unresolvable.push({
        reason: "split-string-dynamic",
        text: describeWords(effectiveWords),
      });
      return;
    }
    resolveInto(slot.word.value, out, depth + 1, options);
    return;
  }

  // Assignments-only segment (`FOO=bar; …`). A real "no command", not a
  // parse failure — nothing to report.
  if (slot.kind === "none") return;

  const cmdWord = effectiveWords[slot.index];
  const argWords = effectiveWords.slice(slot.index + 1);

  // The command slot itself is a substitution/variable → we cannot know what
  // runs. `$(pick-tool) pr merge 1`, `$CMD --squash`.
  if (cmdWord.dynamic) {
    out.unresolvable.push({
      reason: "substituted-command",
      text: describeWords(effectiveWords),
    });
    return;
  }

  // A command slot containing whitespace is not a single binary. Either the
  // shell fails to find it, or something we did not model splits it (a wrapper
  // flag cluster like `env -iS 'gh pr merge 1'`). Report it AND re-parse it:
  // a hard-boundary guard gets the signal, a fail-open guard still gets real
  // segments.
  if (/\s/.test(cmdWord.value)) {
    out.unresolvable.push({
      reason: "split-string-command",
      text: describeWords(effectiveWords),
    });
    resolveInto(
      [cmdWord.value, ...argWords.map((w) => w.value)].join(" "),
      out,
      depth + 1,
      options
    );
    return;
  }

  const name = path.basename(cmdWord.value);

  if (name === "eval") {
    // bash concatenates eval's arguments and re-parses the result.
    if (argWords.some((w) => w.dynamic)) {
      out.unresolvable.push({
        reason: "eval-dynamic",
        text: `eval ${argWords.map((w) => w.value).join(" ")}`.trim(),
      });
      return;
    }
    resolveInto(argWords.map((w) => w.value).join(" "), out, depth + 1, options);
    return;
  }

  if (SHELLS.has(name)) {
    // `-c`, and combined short-flag forms that end in it (`bash -lc "…"`).
    const dashCIdx = argWords.findIndex((w) => /^-[A-Za-z]*c$/.test(w.value));
    if (dashCIdx !== -1) {
      const payload = argWords[dashCIdx + 1];
      if (!payload) return;
      if (payload.dynamic) {
        out.unresolvable.push({
          reason: "shell-c-dynamic",
          text: `${name} -c ${payload.value}`.trim(),
        });
        return;
      }
      resolveInto(payload.value, out, depth + 1, options);
      return;
    }
    // `bash script.sh args…` — the script is the effective command.
    const scriptIdx = argWords.findIndex((w) => !w.value.startsWith("-"));
    if (scriptIdx !== -1) {
      const script = argWords[scriptIdx];
      if (script.dynamic) {
        out.unresolvable.push({
          reason: "substituted-command",
          text: `${name} ${script.value}`.trim(),
        });
        return;
      }
      pushSegment(out, script.value, argWords.slice(scriptIdx + 1));
      return;
    }
  }

  pushSegment(out, cmdWord.value, argWords);
}

function pushSegment(out, command, argWords) {
  const args = argWords.map((w) => w.value);
  out.segments.push({
    command,
    name: path.basename(command),
    args,
    raw: [command, ...args].join(" "),
  });
}

function resolveInto(command, out, depth, options) {
  if (depth > MAX_DEPTH) {
    out.unresolvable.push({ reason: "depth-limit", text: String(command) });
    return;
  }
  const src = String(command || "");
  if (src.trim() === "") return;

  const { tokens, unbalanced } = tokenize(src);
  if (unbalanced) {
    out.unresolvable.push({ reason: "unbalanced-quote", text: src });
  }
  for (const words of splitSegments(tokens, options.splitNewlines)) {
    const segmentsBefore = out.segments.length;
    const unresolvableBefore = out.unresolvable.length;
    resolveSegment(words, out, depth, options);

    // BACKSTOP — the invariant this module owes its callers: a segment that
    // contains a real (non-assignment) word must produce EITHER a segment or an
    // `unresolvable`. Never silence. A guard can pick a safe posture on any
    // signal, but not on the absence of one — silence is how the merge boundary
    // was bypassable in the first place. This should be unreachable; it exists
    // so a future edit that reintroduces a dead end degrades to "I cannot tell"
    // instead of "nothing to see here".
    if (
      out.segments.length === segmentsBefore &&
      out.unresolvable.length === unresolvableBefore &&
      words.some(
        (w) =>
          !ENV_ASSIGN.test(w.value) &&
          (w.quoted || !SHELL_CONTROL_WORDS.has(w.value))
      )
    ) {
      out.unresolvable.push({
        reason: "no-effective-command",
        text: describeWords(words),
      });
    }
  }
}

/**
 * Resolve a shell command string into its effective per-segment commands.
 *
 * @param {string} command
 * @param {{ splitNewlines?: boolean }} [options]
 * @returns {{ segments: Array<{command: string, name: string, args: string[], raw: string}>,
 *             unresolvable: Array<{reason: string, text: string}> }}
 */
function resolveCommand(command, options = {}) {
  const out = { segments: [], unresolvable: [] };
  resolveInto(command, out, 0, {
    splitNewlines: options.splitNewlines !== false,
  });
  return out;
}

module.exports = { resolveCommand, WRAPPERS, SHELLS };
