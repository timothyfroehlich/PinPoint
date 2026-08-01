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
 * third (the merge guard blocks, the memory gate allows).
 *
 * WHAT IT DOES
 *   - Quote-aware tokenizer: quoted spans become ONE argument, never a command.
 *     `echo "run merge-pr.sh"` resolves to `echo`, not `merge-pr.sh`.
 *   - Heredoc bodies are consumed during tokenization (so quote-awareness still
 *     applies to the `<<TAG` operator itself) and never parsed as commands.
 *   - Redirections and their targets are dropped, not mistaken for arguments.
 *   - Segments are split on real shell separators: && || ; | & newline ( ).
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
 * understand `for`/`if`/functions. The threat model is a well-meaning agent
 * that wraps a command (accidentally or to "work around" a guard), not an
 * attacker with unbounded shell tricks. Guards on a hard boundary should still
 * treat `unresolvable` as suspicious rather than assuming it is safe.
 *
 * KNOWN LIMITATIONS (all fail toward `unresolvable`, never toward a silent
 * "not a match"):
 *   - ANSI-C quoting (`$'it\'s'`) is read as a plain single-quoted span, so the
 *     backslash-escaped quote reads as unbalanced. The command would not run in
 *     bash either; it is reported unresolvable rather than mis-parsed.
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
 *                          separating segments (block-heavy-under-pressure
 *                          deliberately does this — see PP-qota).
 */

"use strict";

const path = require("node:path");

// Wrappers that run another command rather than being the command. Value is the
// set of the wrapper's OWN flags that consume a separate following token, plus
// how many positional arguments the wrapper eats before the command starts
// (`timeout 30 cmd`).
//
// Skipping a wrapper's flags is deliberate. The previous per-guard logic
// stopped at the first flag-like token and gave up, which is exactly why
// `sudo -u root chmod +x f` slipped past the chmod guard while `sudo chmod` did
// not.
const WRAPPERS = new Map([
  ["sudo", { valueFlags: new Set(["-u", "-g", "-U", "-p", "-r", "-t", "-C", "-D", "-h", "--user", "--group", "--other-user", "--prompt", "--role", "--type", "--close-from", "--chdir", "--host"]), positionals: 0 }],
  ["doas", { valueFlags: new Set(["-u", "-C"]), positionals: 0 }],
  ["env", { valueFlags: new Set(["-u", "--unset", "-C", "--chdir", "-S", "--split-string"]), positionals: 0 }],
  ["command", { valueFlags: new Set([]), positionals: 0 }],
  ["builtin", { valueFlags: new Set([]), positionals: 0 }],
  ["exec", { valueFlags: new Set(["-a"]), positionals: 0 }],
  ["time", { valueFlags: new Set(["-o", "--output", "-f", "--format"]), positionals: 0 }],
  ["nice", { valueFlags: new Set(["-n", "--adjustment"]), positionals: 0 }],
  ["ionice", { valueFlags: new Set(["-c", "-n", "-p", "-P", "-u"]), positionals: 0 }],
  ["nohup", { valueFlags: new Set([]), positionals: 0 }],
  ["setsid", { valueFlags: new Set([]), positionals: 0 }],
  ["stdbuf", { valueFlags: new Set(["-i", "-o", "-e", "--input", "--output", "--error"]), positionals: 0 }],
  ["timeout", { valueFlags: new Set(["-s", "--signal", "-k", "--kill-after"]), positionals: 1 }],
  // `xargs [flags] CMD ARGS…` — CMD really does run, with extra args appended
  // from stdin. Treating xargs as a wrapper is what closes
  // `xargs -I{} gh pr merge {} < prs.txt`.
  ["xargs", { valueFlags: new Set(["-I", "-i", "-n", "-P", "-d", "-E", "-L", "-s", "-a", "--replace", "--max-args", "--max-procs", "--delimiter", "--eof", "--max-lines", "--max-chars", "--arg-file"]), positionals: 0 }],
]);

// Shells: `sh -c "<program>"` re-parses its argument, and `sh <file>` makes the
// file the effective command (`bash scripts/workflow/merge-pr.sh`).
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "ash"]);

const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*[+:]?=/;

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
 *   { type: "word", value, quoted, dynamic, subs }
 *     value   – unquoted text
 *     quoted  – any part of it came from inside quotes
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
    if (!cur) cur = { value: "", quoted: false, dynamic: false, subs: [] };
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
    tokens.push({ type: "op", value });
  };

  /** Consume heredoc bodies queued by `<<TAG` operators on the line just ended. */
  const consumeHeredocs = (from) => {
    let i = from;
    while (pendingHeredocs.length > 0) {
      const { tag, stripTabs } = pendingHeredocs.shift();
      for (;;) {
        const nl = src.indexOf("\n", i);
        const line = nl === -1 ? src.slice(i) : src.slice(i, nl);
        const cmp = stripTabs ? line.replace(/^\t+/, "") : line;
        i = nl === -1 ? src.length : nl + 1;
        if (cmp.trim() === tag || nl === -1) break;
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
      ensure().value += src[i + 1] ?? "";
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

/** Skip leading `VAR=value` assignments and wrappers. Returns the index of the
 *  effective command word, or -1 if the segment has none. */
function findCommandIndex(words) {
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (ENV_ASSIGN.test(w.value)) {
      i++;
      continue;
    }
    const wrapper = WRAPPERS.get(path.basename(w.value));
    if (!wrapper) return i;

    i++;
    // Skip the wrapper's own flags (and the values they consume).
    while (i < words.length && words[i].value.startsWith("-")) {
      const flag = words[i].value;
      if (flag === "--") {
        i++;
        break;
      }
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
  }
  return -1;
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

  const cmdIdx = findCommandIndex(words);
  if (cmdIdx === -1) return;

  const cmdWord = words[cmdIdx];
  const argWords = words.slice(cmdIdx + 1);

  // The command slot itself is a substitution/variable → we cannot know what
  // runs. `$(pick-tool) pr merge 1`, `$CMD --squash`.
  if (cmdWord.dynamic) {
    out.unresolvable.push({
      reason: "substituted-command",
      text: describeWords(words),
    });
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
    resolveSegment(words, out, depth, options);
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
