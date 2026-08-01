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
});
