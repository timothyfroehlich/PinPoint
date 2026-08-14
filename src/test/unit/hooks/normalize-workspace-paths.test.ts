// Unit tests for the pieces exported from
// .claude/hooks/normalize-workspace-paths.cjs.
//
// Both filesystem probes (`exists`, `realpath`) are injected, so these run
// without touching the disk and can model Bazzite from a Mac.
//
// The hook rewrites absolute workspace paths to relative so they match the
// settings.json allowlist. Every test here covers one of the four guards that
// keep a rewrite from changing what a command means — see the hook's header.
// The original regression (PP-xbfn) was guards 1 and 2 missing: a crabbox run
// carrying `/var/home/froeht/Code/PinPoint/.claude/worktrees/...` came out as
// `/var.claude/worktrees/...` and died on `mkdir`.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it, expect } from "vitest";

const require = createRequire(import.meta.url);
const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/normalize-workspace-paths.cjs"
);

interface Probes {
  exists?: (p: string) => boolean;
  realpath?: (p: string) => string;
}

const { normalizeCommand, workspacePrefixes, shiftsContext, samePath } =
  require(hookPath) as {
    normalizeCommand: (
      command: string,
      repoRoot: string,
      probes?: Probes
    ) => { modified: string; rewrites: string[] };
    workspacePrefixes: (
      repoRoot: string,
      realpath?: (p: string) => string
    ) => string[];
    shiftsContext: (command: string) => boolean;
    samePath: (
      a: string,
      b: string,
      realpath?: (p: string) => string
    ) => boolean;
  };

/** A Mac session — the machine that drives crabbox. */
const MAC_ROOT = "/Users/froeht/Code/PinPoint";
/** A Bazzite session, where the repo really does live under /var/home. */
const BAZZITE_ROOT = "/var/home/froeht/Code/PinPoint";

const ENOENT = (p: string): never => {
  throw new Error(`ENOENT: no such file or directory, '${p}'`);
};

/** macOS: /Users resolves to itself, nothing else exists. */
const macRealpath = (p: string) => (p.startsWith("/Users/") ? p : ENOENT(p));

/** Bazzite (Fedora Atomic): /home is a symlink to /var/home. */
const bazziteRealpath = (p: string) => {
  if (p.startsWith("/var/home/")) return p;
  if (p.startsWith("/home/")) return `/var${p}`;
  return ENOENT(p);
};

/** A plain Linux box with a real /home and no /var/home. */
const plainLinuxRealpath = (p: string) =>
  p.startsWith("/home/") ? p : ENOENT(p);

/** Every candidate tail exists — the permissive case. */
const allExist = () => true;

function run(
  command: string,
  repoRoot = MAC_ROOT,
  probes: Probes = {}
): string {
  const realpath =
    probes.realpath ??
    (repoRoot.startsWith("/Users/") ? macRealpath : bazziteRealpath);
  return normalizeCommand(command, repoRoot, {
    exists: probes.exists ?? allExist,
    realpath,
  }).modified;
}

// ---------------------------------------------------------------------------
// Guard 1 — only prefixes that name THIS machine's repo root
// ---------------------------------------------------------------------------
describe("guard 1: remote paths seen from a Mac session", () => {
  it("leaves a crabbox work root untouched", () => {
    const cmd =
      "CRABBOX_STATIC_WORK_ROOT=/var/home/froeht/Code/PinPoint/.claude/worktrees/crabbox-runner env";
    expect(run(cmd)).toBe(cmd);
  });

  it("never produces the orphaned /var prefix", () => {
    expect(
      run("ls /var/home/froeht/Code/PinPoint/.claude/worktrees")
    ).not.toContain("/var.claude");
  });
});

// ---------------------------------------------------------------------------
// Guard 2 — the match must start a path, not continue one
// ---------------------------------------------------------------------------
describe("guard 2: path boundaries", () => {
  it("ignores an unrelated prefix that merely contains the root", () => {
    const cmd = "ls /aaa/Users/froeht/Code/PinPoint/scripts/x.sh";
    expect(run(cmd)).toBe(cmd);
  });

  it("ignores a root embedded after a word character", () => {
    const cmd = "ls fooUsers/froeht/Code/PinPoint/scripts/x.sh";
    expect(run(cmd)).toBe(cmd);
  });

  it("still matches after a quote", () => {
    expect(run(`bash "${MAC_ROOT}/scripts/x.sh"`)).toBe(`bash "scripts/x.sh"`);
  });

  it("still matches after an = in an assignment", () => {
    expect(run(`P=${MAC_ROOT}/scripts/x.sh`)).toBe("P=scripts/x.sh");
  });
});

// ---------------------------------------------------------------------------
// Guard 3 — commands that move cwd out from under a relative path
// ---------------------------------------------------------------------------
describe("guard 3: commands that change directory", () => {
  it("skips a command with a leading cd", () => {
    const cmd = `cd /tmp && bash ${MAC_ROOT}/scripts/x.sh`;
    expect(run(cmd)).toBe(cmd);
  });

  it("skips a cd that appears after the first command", () => {
    const cmd = `echo hi; cd /tmp; bash ${MAC_ROOT}/scripts/x.sh`;
    expect(run(cmd)).toBe(cmd);
  });

  it("skips a cd inside a subshell", () => {
    const cmd = `(cd sub && bash ${MAC_ROOT}/scripts/x.sh)`;
    expect(run(cmd)).toBe(cmd);
  });

  it("skips pushd", () => {
    const cmd = `pushd /tmp && bash ${MAC_ROOT}/scripts/x.sh`;
    expect(run(cmd)).toBe(cmd);
  });

  it("skips a -C flag (git, make, tar)", () => {
    const cmd = `git -C /tmp apply ${MAC_ROOT}/patch.diff`;
    expect(run(cmd)).toBe(cmd);
  });

  it("does not mistake a word merely containing cd for the command", () => {
    expect(shiftsContext("bash scripts/cdrom-check.sh")).toBe(false);
    expect(shiftsContext("echo abcd")).toBe(false);
  });

  // The word is matched anywhere, because command position is not detectable
  // by regex — these all hide it somewhere an anchored pattern cannot see.
  it("catches a cd inside a quoted -c payload", () => {
    const cmd = `bash -c 'cd /tmp && bash ${MAC_ROOT}/scripts/x.sh'`;
    expect(run(cmd)).toBe(cmd);
  });

  it("catches a cd inside a loop body", () => {
    const cmd = `for f in a b; do cd /tmp; bash ${MAC_ROOT}/scripts/x.sh; done`;
    expect(run(cmd)).toBe(cmd);
  });
});

// ---------------------------------------------------------------------------
// Guard 4 — commands that hand the text to another machine
// ---------------------------------------------------------------------------
describe("guard 4: remote execution", () => {
  // This is the case guard 1 CANNOT catch: on Bazzite the remote root is
  // spelled exactly like the local one, so only the ssh verb distinguishes it.
  it("leaves an ssh payload alone even when the spelling is local", () => {
    const cmd = `ssh bazzite 'ls ${BAZZITE_ROOT}/scripts/x.sh'`;
    expect(run(cmd, BAZZITE_ROOT)).toBe(cmd);
  });

  it("leaves an ssh payload alone on the Mac too", () => {
    const cmd = "ssh bazzite 'ls /home/froeht/Code/PinPoint/scripts/x.sh'";
    expect(run(cmd)).toBe(cmd);
  });

  it.each(["scp", "rsync", "crabbox", "docker", "podman", "kubectl"])(
    "skips %s",
    (verb) => {
      const cmd = `${verb} run ${MAC_ROOT}/scripts/x.sh`;
      expect(run(cmd)).toBe(cmd);
    }
  );

  // A leading assignment or wrapper word pushes the verb out of command
  // position. The first of these is the command that motivated the whole PR.
  it("catches a verb behind a leading env-var assignment", () => {
    const cmd = `CRABBOX_STATIC_WORK_ROOT=${BAZZITE_ROOT}/.claude/wt crabbox run ${BAZZITE_ROOT}/scripts/x.sh`;
    expect(run(cmd, BAZZITE_ROOT)).toBe(cmd);
  });

  it.each(["sudo", "env FOO=1", "time", "nohup"])(
    "catches ssh behind the %s wrapper",
    (wrapper) => {
      const cmd = `${wrapper} ssh bazzite ls ${BAZZITE_ROOT}/scripts/x.sh`;
      expect(run(cmd, BAZZITE_ROOT)).toBe(cmd);
    }
  );
});

// ---------------------------------------------------------------------------
// Prefix derivation, including the /home <-> /var/home sibling
// ---------------------------------------------------------------------------
describe("workspacePrefixes", () => {
  it("offers both spellings on Bazzite, where they resolve to one directory", () => {
    expect(workspacePrefixes(BAZZITE_ROOT, bazziteRealpath)).toEqual(
      expect.arrayContaining([BAZZITE_ROOT, "/home/froeht/Code/PinPoint"])
    );
  });

  it("does NOT synthesize /var/home on a plain Linux box", () => {
    const prefixes = workspacePrefixes(
      "/home/froeht/Code/PinPoint",
      plainLinuxRealpath
    );
    expect(prefixes).toEqual(["/home/froeht/Code/PinPoint"]);
  });

  it("offers only the literal root on the Mac", () => {
    expect(workspacePrefixes(MAC_ROOT, macRealpath)).toEqual([MAC_ROOT]);
  });

  it("orders longest first, so a worktree beats its parent", () => {
    const prefixes = workspacePrefixes(BAZZITE_ROOT, bazziteRealpath);
    expect(prefixes).toEqual([...prefixes].sort((a, b) => b.length - a.length));
  });
});

describe("both spellings rewrite on Bazzite", () => {
  it("rewrites the canonical /var/home spelling", () => {
    expect(run(`bash ${BAZZITE_ROOT}/scripts/x.sh`, BAZZITE_ROOT)).toBe(
      "bash scripts/x.sh"
    );
  });

  it("rewrites the symlinked /home spelling", () => {
    expect(
      run("bash /home/froeht/Code/PinPoint/scripts/x.sh", BAZZITE_ROOT)
    ).toBe("bash scripts/x.sh");
  });
});

// ---------------------------------------------------------------------------
// samePath — the cwd guard's comparison
// ---------------------------------------------------------------------------
describe("samePath", () => {
  it("matches two spellings of one directory through symlinks", () => {
    expect(
      samePath("/home/froeht/Code/PinPoint", BAZZITE_ROOT, bazziteRealpath)
    ).toBe(true);
  });

  it("does not match genuinely different directories", () => {
    expect(samePath(`${MAC_ROOT}/a`, `${MAC_ROOT}/b`, macRealpath)).toBe(false);
  });

  it("is false rather than throwing when a path does not resolve", () => {
    expect(samePath("/nope/a", "/nope/b", macRealpath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The allowlist rewrite it exists for
// ---------------------------------------------------------------------------
describe("the allowlist rewrite it exists for", () => {
  it("rewrites a script path to relative", () => {
    expect(run(`bash ${MAC_ROOT}/scripts/workflow/merge-pr.sh 1039`)).toBe(
      "bash scripts/workflow/merge-pr.sh 1039"
    );
  });

  it("rewrites every occurrence in one command", () => {
    expect(run(`diff ${MAC_ROOT}/a.txt ${MAC_ROOT}/b.txt`)).toBe(
      "diff a.txt b.txt"
    );
  });

  it("leaves the path alone when the tail does not exist locally", () => {
    const cmd = `ls ${MAC_ROOT}/nope/missing`;
    expect(run(cmd, MAC_ROOT, { exists: () => false })).toBe(cmd);
  });

  it("reports what it rewrote", () => {
    const { rewrites } = normalizeCommand(
      `bash ${MAC_ROOT}/scripts/x.sh`,
      MAC_ROOT,
      { exists: allExist, realpath: macRealpath }
    );
    expect(rewrites).toHaveLength(1);
    expect(rewrites[0]).toContain("-> scripts/x.sh");
  });

  it("leaves a command with no workspace path untouched", () => {
    const cmd = "pnpm run check";
    expect(run(cmd)).toBe(cmd);
  });
});

// ---------------------------------------------------------------------------
// Guard 5 — the hook must never approve the command it rewrote
// ---------------------------------------------------------------------------
describe("guard 5: the decision payload", () => {
  // Runs the real hook end to end, because the decision is built in main().
  function runHook(command: string, cwd = process.cwd()) {
    const out = execFileSync(process.execPath, [hookPath], {
      input: JSON.stringify({ cwd, tool_input: { command } }),
      encoding: "utf8",
    });
    return out.trim() ? JSON.parse(out).hookSpecificOutput : null;
  }

  it("rewrites without approving, so permissions.ask still applies", () => {
    // `Bash(rm -rf:*)` is on permissions.ask. Returning "allow" here would skip
    // that prompt for anyone who happened to spell the path absolutely.
    const out = runHook(`rm -rf ${process.cwd()}/src/app`);
    expect(out?.updatedInput?.command).toBe("rm -rf src/app");
    expect(out).not.toHaveProperty("permissionDecision");
  });

  it("stays silent when there is nothing to rewrite", () => {
    expect(runHook("pnpm run check")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Worktrees: a worktree root is its own root, and does not match the main one
// ---------------------------------------------------------------------------
describe("worktrees", () => {
  const WORKTREE = `${MAC_ROOT}/.claude/worktrees/feat-x`;

  it("rewrites paths under the worktree it is running in", () => {
    expect(run(`bash ${WORKTREE}/scripts/x.sh`, WORKTREE)).toBe(
      "bash scripts/x.sh"
    );
  });

  it("does not relativize a main-repo path from inside a worktree", () => {
    const cmd = `bash ${MAC_ROOT}/scripts/x.sh`;
    expect(run(cmd, WORKTREE)).toBe(cmd);
  });
});
