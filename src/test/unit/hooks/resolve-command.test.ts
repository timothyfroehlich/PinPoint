// Unit tests for .claude/hooks/lib/resolve-command.cjs — the shared
// command-resolution primitive every PreToolUse Bash guard sits on (PP-6t3c).
//
// This is where the wrapper/quoting/substitution class is tested ONCE. The
// guards' own suites cover their policy (what counts as a merge, a branch
// switch, a heavy run); they should NOT each re-test `eval`, `sh -c`, `xargs`,
// heredocs and friends.
//
// The class this file exists for: on 2026-07-26 every one of the "wrapped"
// rows below RESOLVED TO NOTHING in the merge guard, which read that as
// "not a merge" and allowed it.

import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface Segment {
  command: string;
  name: string;
  args: string[];
  dynamicArgs: boolean[];
  raw: string;
}
interface Unresolvable {
  reason: string;
  text: string;
}
interface Resolution {
  segments: Segment[];
  unresolvable: Unresolvable[];
}

const require = createRequire(import.meta.url);
const libPath = path.resolve(
  process.cwd(),
  ".claude/hooks/lib/resolve-command.cjs"
);
const { resolveCommand } = require(libPath) as {
  resolveCommand: (
    cmd: string,
    options?: { splitNewlines?: boolean }
  ) => Resolution;
};

/** The resolved command basenames, in order. */
function names(cmd: string, options?: { splitNewlines?: boolean }): string[] {
  return resolveCommand(cmd, options).segments.map((s) => s.name);
}

/** The first segment, asserted to exist. */
function firstSegment(cmd: string): Segment {
  const { segments } = resolveCommand(cmd);
  const first = segments[0];
  if (first === undefined) {
    throw new Error(`expected at least one segment for ${JSON.stringify(cmd)}`);
  }
  return first;
}

// ---------------------------------------------------------------------------
// Plain invocations
// ---------------------------------------------------------------------------
describe("plain commands", () => {
  it("resolves the command and its arguments", () => {
    const seg = firstSegment("gh pr merge 123 --squash");
    expect(seg.name).toBe("gh");
    expect(seg.args).toEqual(["pr", "merge", "123", "--squash"]);
  });

  it("keeps the command as written and exposes its basename separately", () => {
    const seg = firstSegment("./scripts/workflow/merge-pr.sh 123 --human");
    expect(seg.command).toBe("./scripts/workflow/merge-pr.sh");
    expect(seg.name).toBe("merge-pr.sh");
  });

  it("returns no segments for an empty or whitespace-only command", () => {
    expect(resolveCommand("").segments).toEqual([]);
    expect(resolveCommand("   ").segments).toEqual([]);
  });

  it("marks arguments whose literal value was changed by shell expansion", () => {
    const { segments } = resolveCommand(
      "gh pr merge 123 --repo timothyfroehlich/Pin$(printf Point)"
    );
    const seg = segments.find(({ name }) => name === "gh");
    if (seg === undefined) throw new Error("expected the outer gh segment");
    expect(seg.args).toEqual([
      "pr",
      "merge",
      "123",
      "--repo",
      "timothyfroehlich/Pin",
    ]);
    expect(seg.dynamicArgs).toEqual([false, false, false, false, true]);
  });
});

// ---------------------------------------------------------------------------
// Separators
// ---------------------------------------------------------------------------
describe("shell separators", () => {
  it.each([
    ["a && b", ["a", "b"]],
    ["a || b", ["a", "b"]],
    ["a ; b", ["a", "b"]],
    ["a | b", ["a", "b"]],
    ["a & b", ["a", "b"]],
    ["a\nb", ["a", "b"]],
    ["(a) && b", ["a", "b"]],
  ])("splits %s", (cmd, expected) => {
    expect(names(cmd)).toEqual(expected);
  });

  it("keeps newlines out of the split when splitNewlines is false", () => {
    // block-heavy-under-pressure's posture (PP-qota).
    expect(names("cd foo\npnpm run build", { splitNewlines: false })).toEqual([
      "cd",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Shell control words — syntax must not occupy the effective command slot
// ---------------------------------------------------------------------------
describe("shell control words expose the governed command (PP-c8xa)", () => {
  it.each([
    ["if gh pr merge 1; then echo blocked; fi", ["gh", "echo"]],
    ["! gh pr merge 1", ["gh"]],
    ["{ gh pr merge 1; }", ["gh"]],
    ["while gh pr merge 1; do echo blocked; done", ["gh", "echo"]],
    ["until gh pr merge 1; do echo blocked; done", ["gh", "echo"]],
    ["if ! env gh pr merge 1; then :; fi", ["gh", ":"]],
    ["function guarded { gh pr merge 1; }; guarded", ["gh", "guarded"]],
    ["coproc gh pr merge 1", ["gh"]],
    ["coproc { gh pr merge 1; }", ["gh"]],
    ["coproc guarded { gh pr merge 1; }", ["gh"]],
    ["time if gh pr merge 1; then echo blocked; fi", ["gh", "echo"]],
    ["time { gh pr merge 1; }", ["gh"]],
    ["time function guarded { gh pr merge 1; }; guarded", ["gh", "guarded"]],
    ["time coproc gh pr merge 1", ["gh"]],
    ["time coproc guarded { gh pr merge 1; }", ["gh"]],
    ["time -p if ! env gh pr merge 1; then :; fi", ["gh", ":"]],
    ["coproc guarded if gh pr merge 1; then :; fi", ["gh", ":"]],
    ["coproc guarded while gh pr merge 1; do :; done", ["gh", ":"]],
    ["coproc guarded until gh pr merge 1; do :; done", ["gh", ":"]],
    ["time coproc guarded if gh pr merge 1; then :; fi", ["gh", ":"]],
    ["function guarded if gh pr merge 1; then :; fi", ["gh", ":"]],
    ["function guarded while gh pr merge 1; do :; done", ["gh", ":"]],
    ["function guarded until gh pr merge 1; do :; done", ["gh", ":"]],
    ["time function guarded if gh pr merge 1; then :; fi", ["gh", ":"]],
    ["function guarded-name if gh pr merge 1; then :; fi", ["gh", ":"]],
  ])("resolves %s", (cmd, expected) => {
    expect(names(cmd)).toEqual(expected);
  });

  it("keeps control words in ordinary argument positions", () => {
    expect(names("echo if function coproc gh pr merge 1")).toEqual(["echo"]);
  });

  it("does not treat a quoted control word as shell syntax", () => {
    expect(names("'if' gh pr merge 1")).toEqual(["if"]);
  });

  it("does not treat an escaped control word as shell syntax", () => {
    expect(names("\\if gh pr merge 1")).toEqual(["if"]);
  });

  it("does not treat control words after an external time command as shell syntax", () => {
    expect(names("/usr/bin/time if gh pr merge 1")).toEqual(["if"]);
    expect(names("env time if gh pr merge 1")).toEqual(["if"]);
  });

  it("keeps a simple coprocess operand in the command slot", () => {
    expect(names("coproc guarded gh pr merge 1")).toEqual(["guarded"]);
    expect(names("coproc git -C { checkout feature/x")).toEqual(["git"]);
    expect(firstSegment("coproc git -C { checkout feature/x").args).toEqual([
      "-C",
      "{",
      "checkout",
      "feature/x",
    ]);
  });

  it("keeps a non-compound function header in its ordinary command slot", () => {
    expect(names("function guarded gh pr merge 1")).toEqual(["function"]);
  });

  it("reports a dynamic governed command as unresolvable", () => {
    const { segments, unresolvable } = resolveCommand(
      'if "$COMMAND"; then echo blocked; fi'
    );
    expect(segments.map((segment) => segment.name)).toEqual(["echo"]);
    expect(unresolvable.map((entry) => entry.reason)).toContain(
      "substituted-command"
    );
  });
});

// ---------------------------------------------------------------------------
// Wrappers — the class that folded the guards
// ---------------------------------------------------------------------------
describe("wrappers resolve through to the real command", () => {
  it.each([
    "env gh pr merge 123",
    "time gh pr merge 123",
    "command gh pr merge 123",
    "nice gh pr merge 123",
    "sudo gh pr merge 123",
    "nohup gh pr merge 123",
    "setsid gh pr merge 123",
    "timeout 30 gh pr merge 123",
    "xargs -I{} gh pr merge {}",
    "xargs -n 1 -P 4 gh pr merge",
    "FOO=1 gh pr merge 123",
    "FOO=1 BAR=2 gh pr merge 123",
    "env FOO=bar gh pr merge 123",
    "/usr/bin/env gh pr merge 123",
  ])("resolves %s to gh", (cmd) => {
    expect(names(cmd)).toEqual(["gh"]);
  });

  it("skips a wrapper's own flags AND their values", () => {
    // The old per-guard logic gave up at the first flag after a wrapper, so
    // `sudo chmod` blocked but `sudo -u root chmod` did not.
    expect(names("sudo -u root chmod +x f")).toEqual(["chmod"]);
    expect(names("nice -n 10 pnpm run build")).toEqual(["pnpm"]);
    expect(names("stdbuf -o0 vitest run")).toEqual(["vitest"]);
  });

  it("does not consume a following token for an attached flag value", () => {
    expect(firstSegment("xargs --max-args=1 gh pr merge").name).toBe("gh");
    expect(firstSegment("xargs -I{} gh pr merge {}").args).toEqual([
      "pr",
      "merge",
      "{}",
    ]);
  });

  it("marks xargs replacement targets as dynamic", () => {
    const segment = firstSegment(
      "xargs -I dotfiles gh pr merge 1 --repo timothyfroehlich/dotfiles"
    );
    expect(segment.args).toEqual([
      "pr",
      "merge",
      "1",
      "--repo",
      "timothyfroehlich/dotfiles",
    ]);
    expect(segment.dynamicArgs).toEqual([false, false, false, false, true]);
  });

  it.each(["-i", "--replace"])(
    "does not consume the command after bare xargs %s",
    (flag) => {
      const segment = firstSegment(`xargs ${flag} gh pr merge {}`);
      expect(segment.name).toBe("gh");
      expect(segment.args).toEqual(["pr", "merge", "{}"]);
      expect(segment.dynamicArgs).toEqual([false, false, true]);
    }
  );
});

// ---------------------------------------------------------------------------
// Shell payloads — eval / sh -c / substitutions
// ---------------------------------------------------------------------------
describe("literal shell payloads are re-parsed, not skipped", () => {
  it.each([
    'eval "gh pr merge 123"',
    "eval 'gh pr merge 123'",
    'sh -c "gh pr merge 123"',
    'bash -c "gh pr merge 123"',
    "zsh -c 'gh pr merge 123'",
    'bash -lc "gh pr merge 123"',
    'env sh -c "gh pr merge 123"',
    'xargs sh -c "gh pr merge 123"',
  ])("resolves %s to gh", (cmd) => {
    expect(names(cmd)).toEqual(["gh"]);
  });

  it("treats `bash <script>` as an invocation of the script", () => {
    expect(names("bash scripts/workflow/merge-pr.sh 123")).toEqual([
      "merge-pr.sh",
    ]);
    expect(names("sh ./scripts/workflow/merge-pr.sh 123")).toEqual([
      "merge-pr.sh",
    ]);
  });

  it("resolves commands inside $() and backtick substitutions", () => {
    expect(names("$(gh pr merge 5)")).toContain("gh");
    expect(names("`gh pr merge 5`")).toContain("gh");
    expect(names('echo "$(gh pr merge 5)"')).toContain("gh");
  });

  it("resolves commands inside process substitution", () => {
    expect(names("diff <(gh pr merge 5) b")).toContain("gh");
  });

  it("stops recursing at the depth cap instead of hanging", () => {
    const nested = 'eval "eval \\"eval \\\\\\"gh pr merge 1\\\\\\"\\""';
    // Whatever it resolves to, it must terminate and report something.
    const result = resolveCommand(nested);
    expect(result.segments.length + result.unresolvable.length).toBeGreaterThan(
      0
    );
  });
});

// ---------------------------------------------------------------------------
// Quoting — prose must NOT read as a command
// ---------------------------------------------------------------------------
describe("quoted spans are arguments, never commands", () => {
  it.each([
    ['echo "run merge-pr.sh when ready"', "echo"],
    ["echo 'scripts/workflow/merge-pr.sh <PR> --human'", "echo"],
    ['rg "merge-pr.sh" docs/', "rg"],
    ['git commit -m "speed up vitest run"', "git"],
    ['bd comments add PP-x "ran pnpm run smoke"', "bd"],
    ["echo git checkout feature/x", "echo"],
  ])("resolves %s to %s only", (cmd, expected) => {
    expect(names(cmd)).toEqual([expected]);
  });

  it("strips quotes from arguments", () => {
    expect(firstSegment('git checkout "main"').args).toEqual([
      "checkout",
      "main",
    ]);
  });

  it("keeps a multi-line quoted argument as ONE argument", () => {
    const seg = firstSegment(
      'bd comments add PP-x "line1\npnpm run e2e\nline3"'
    );
    expect(seg.name).toBe("bd");
    expect(seg.args.at(-1)).toBe("line1\npnpm run e2e\nline3");
  });
});

// ---------------------------------------------------------------------------
// Heredocs and redirections
// ---------------------------------------------------------------------------
describe("heredoc bodies are never parsed as commands", () => {
  it("drops a heredoc body", () => {
    expect(
      names(["cat <<EOF > notes.md", "gh pr merge 123", "EOF"].join("\n"))
    ).toEqual(["cat"]);
  });

  it("drops a quoted-tag heredoc body", () => {
    expect(
      names(
        [
          "cat > /tmp/x.md <<'EOF'",
          "scripts/workflow/merge-pr.sh 1",
          "EOF",
        ].join("\n")
      )
    ).toEqual(["cat"]);
  });

  it("drops an indented (<<-) heredoc body", () => {
    expect(
      names(["cat <<-EOF", "\tgh pr merge 1", "\tEOF"].join("\n"))
    ).toEqual(["cat"]);
  });

  it("requires an EXACT terminator — an indented EOF is still body", () => {
    // Trimming before comparing would end the body here and parse the rest of
    // it as real commands.
    expect(
      names(
        ["cat <<EOF", "  EOF", "gh pr merge 1", "EOF", "echo done"].join("\n")
      )
    ).toEqual(["cat", "echo"]);
  });

  it("does not accept a terminator with trailing spaces", () => {
    expect(
      names(["cat <<EOF", "EOF  ", "gh pr merge 1", "EOF"].join("\n"))
    ).toEqual(["cat"]);
  });

  it("accepts a CRLF terminator line", () => {
    expect(
      names(["cat <<EOF", "body", "EOF", "echo done"].join("\r\n"))
    ).toEqual(["cat", "echo"]);
  });

  it("resumes parsing after the heredoc terminator", () => {
    expect(
      names(["cat <<EOF", "body line", "EOF", "gh pr merge 1"].join("\n"))
    ).toEqual(["cat", "gh"]);
  });

  it("does not treat a QUOTED << as a heredoc (it would swallow the rest)", () => {
    expect(names('echo "use <<EOF here"\ngh pr merge 1')).toEqual([
      "echo",
      "gh",
    ]);
  });

  it("drops redirections and their targets from the arguments", () => {
    expect(firstSegment("gh pr merge 1 > out.log 2>&1").args).toEqual([
      "pr",
      "merge",
      "1",
    ]);
    expect(firstSegment("xargs -I{} gh pr merge {} < prs.txt").args).toEqual([
      "pr",
      "merge",
      "{}",
    ]);
  });
});

// ---------------------------------------------------------------------------
// `env -S` (GNU split-string) and the silent-drop class it exposed.
//
// `-S` was first modelled as an ordinary value flag, so the wrapper scan ATE
// the payload, the segment yielded no command, and `resolveSegment` returned in
// silence — no segment AND no `unresolvable`. A hard-boundary guard reading
// that as "not a merge" fails open, which is the exact failure mode this module
// exists to remove.
// ---------------------------------------------------------------------------
describe("env -S / --split-string re-parses its payload", () => {
  it.each([
    "env -S 'gh pr merge 123'",
    'env -S "gh pr merge 123"',
    "env --split-string='gh pr merge 123'",
    "env -S'gh pr merge 123'",
    "env -i -S 'gh pr merge 123'",
    "env -u FOO -S 'gh pr merge 123'",
    "sudo env -S 'gh pr merge 123'",
    "xargs env -S 'gh pr merge 123'",
  ])("resolves %s to gh", (cmd) => {
    expect(names(cmd)).toEqual(["gh"]);
  });

  it("reports a dynamic split-string payload instead of dropping it", () => {
    const { segments, unresolvable } = resolveCommand('env -S "$PAYLOAD"');
    expect(segments).toEqual([]);
    expect(unresolvable.map((u) => u.reason)).toContain("split-string-dynamic");
  });

  it("handles an unmodelled flag cluster by resolving AND flagging it", () => {
    // `-iS` is not modelled, so the payload lands in the command slot as a
    // whitespace-containing token. Both outputs are produced on purpose: the
    // real segment for fail-open guards, the signal for hard-boundary ones.
    const { segments, unresolvable } = resolveCommand(
      "env -iS 'gh pr merge 1'"
    );
    expect(segments.map((s) => s.name)).toContain("gh");
    expect(unresolvable.map((u) => u.reason)).toContain("split-string-command");
  });
});

describe("a wrapper that consumes the whole segment resolves to the wrapper", () => {
  // The alternative — reporting these unresolvable — would make a hard-boundary
  // guard fall back to a raw-text scan on ordinary commands, so `env | rg
  // merge-pr.sh` would block. They are real invocations of the wrapper itself.
  it.each([
    ["env", "env"],
    ["sudo -l", "sudo"],
    ["xargs", "xargs"],
    ["timeout 30", "timeout"],
  ])("resolves %s to %s with no unresolvable", (cmd, expected) => {
    const { segments, unresolvable } = resolveCommand(cmd);
    expect(segments.map((s) => s.name)).toEqual([expected]);
    expect(unresolvable).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Unresolvable — the signal every guard was missing
// ---------------------------------------------------------------------------
describe("unresolvable", () => {
  it("reports a dynamic eval payload rather than silently allowing it", () => {
    const { segments, unresolvable } = resolveCommand('eval "$CMD"');
    expect(segments).toEqual([]);
    expect(unresolvable.map((u) => u.reason)).toContain("eval-dynamic");
  });

  it("reports a dynamic `sh -c` payload", () => {
    expect(
      resolveCommand('sh -c "$PAYLOAD"').unresolvable.map((u) => u.reason)
    ).toContain("shell-c-dynamic");
  });

  it("reports a substituted command slot", () => {
    expect(
      resolveCommand("$(pick-tool) pr merge 1").unresolvable.map(
        (u) => u.reason
      )
    ).toContain("substituted-command");
    expect(
      resolveCommand("$GH pr merge 1").unresolvable.map((u) => u.reason)
    ).toContain("substituted-command");
  });

  it("reports an unbalanced quote", () => {
    expect(
      resolveCommand('echo "unterminated').unresolvable.map((u) => u.reason)
    ).toContain("unbalanced-quote");
  });

  it("stays empty for ordinary commands, including prose mentions", () => {
    for (const cmd of [
      "gh pr view 123",
      'echo "run merge-pr.sh when ready"',
      'rg "gh pr merge" docs/',
      "git status && git checkout main",
      'git commit -m "note: $ signs and stuff"',
    ]) {
      expect(
        resolveCommand(cmd).unresolvable,
        `expected no unresolvable for ${JSON.stringify(cmd)}`
      ).toEqual([]);
    }
  });

  it("does not flag a variable in an ARGUMENT — only in the command slot", () => {
    const { segments, unresolvable } = resolveCommand("gh pr view $NUMBER");
    expect(segments.map((s) => s.name)).toEqual(["gh"]);
    expect(unresolvable).toEqual([]);
  });

  it("stays empty for an assignments-only segment (a real 'no command')", () => {
    expect(resolveCommand("FOO=bar")).toEqual({
      segments: [],
      unresolvable: [],
    });
    const { segments, unresolvable } = resolveCommand(
      "CMD='pr merge'; echo hi"
    );
    expect(segments.map((s) => s.name)).toEqual(["echo"]);
    expect(unresolvable).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The backstop invariant
// ---------------------------------------------------------------------------
describe("no segment is ever dropped in silence", () => {
  it.each([
    "sh -c", // -c with no payload
    "eval", // eval with no words
    'sh -c ""', // empty payload
  ])("reports %s rather than returning nothing", (cmd) => {
    const { segments, unresolvable } = resolveCommand(cmd);
    expect(
      segments.length + unresolvable.length,
      `${JSON.stringify(cmd)} produced neither a segment nor an unresolvable`
    ).toBeGreaterThan(0);
  });

  it("holds across a broad sweep of wrapper and payload shapes", () => {
    // The invariant, asserted directly: any command with a real (non-assignment)
    // word must yield a segment or an unresolvable — never silence.
    for (const cmd of [
      "env -S 'gh pr merge 1'",
      "env -S",
      "env -u",
      "sudo",
      "sudo --",
      "timeout",
      "timeout 30",
      "xargs -I",
      "xargs -I{}",
      "nice -n",
      "stdbuf -o",
      "bash -c",
      "bash",
      "command",
      "$X",
      "eval $X",
      "cmd >; cmd2",
    ]) {
      const { segments, unresolvable } = resolveCommand(cmd);
      expect(
        segments.length + unresolvable.length,
        `${JSON.stringify(cmd)} produced neither a segment nor an unresolvable`
      ).toBeGreaterThan(0);
    }
  });

  it("does not let a redirect drop the command after a separator", () => {
    expect(names("cmd >; cmd2")).toEqual(["cmd", "cmd2"]);
  });
});
