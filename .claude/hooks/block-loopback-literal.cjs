#!/usr/bin/env node
// .claude/hooks/block-loopback-literal.cjs
// PreToolUse hook (matcher: Write|Edit): blocks writing the literal 127.0.0.1
// into the config files that determine which host the browser and the Supabase
// SSR client talk to.
//
// CORE-SEC-008: use `localhost`, never `127.0.0.1`. Browsers scope cookies by
// host STRING, not by resolved address, so a cookie set on `localhost` is
// invisible to a request to `127.0.0.1` and vice versa. Mixing the two spellings
// across config silently breaks Supabase SSR auth — the session cookie is
// written by one host and never read back by the other, and the failure looks
// like a random logout rather than a config bug.
//
// SCOPE IS DELIBERATELY NARROW. Only files where a bare 127.0.0.1 literal is
// always wrong:
//   supabase/config.toml, supabase/config.toml.template, .env*,
//   playwright*.config.*
//
// Explicitly NOT scoped: scripts/**, *.mjs, *.ts, docs. Those have legitimate
// uses that a content match cannot distinguish from violations —
// supabase/seed-timeline-backfill.mjs compares
// `url.hostname === "localhost" || url.hostname === "127.0.0.1"` as a safety
// check (it must accept both spellings), seed-timeline-demo.mjs names it in a
// comment, and scripts/beads-server/SETUP.md documents binding a Dolt server to
// loopback, which has nothing to do with browser cookies. A hook that fires on
// those would be noise, and a noisy hook gets bypassed.
//
// Fails OPEN on malformed payloads, other tools, and out-of-scope paths.

const path = require("node:path");

// --- Pure classifiers (unit-testable, no filesystem) --------------------------

// Is this path one where a bare loopback literal is unambiguously wrong?
// Matched against the repo-relative path with POSIX separators.
function isScopedPath(filePath) {
  const p = String(filePath || "").replace(/\\/g, "/");
  if (!p) return false;

  const base = path.posix.basename(p);

  // supabase/config.toml and its template (the generated file is chmod 444;
  // edits are supposed to go to the template, so cover both).
  if (/(^|\/)supabase\/config\.toml(\.template)?$/.test(p)) return true;

  // .env, .env.local, .env.production, ... but NOT .env.example-style docs?
  // Those are config too — an example that says 127.0.0.1 gets copied verbatim.
  if (/^\.env(\.|$)/.test(base)) return true;

  // playwright.config.ts, playwright.config.smoke.ts, playwright.config.full.ts.
  // Variant segments appear AFTER `.config` in this repo, so allow extra dotted
  // segments on both sides rather than only before.
  if (/^playwright(\.[\w-]+)*\.config(\.[\w-]+)*\.[cm]?[jt]s$/.test(base)) {
    return true;
  }

  return false;
}

// Does this content introduce the loopback literal?
// Word-boundaried so 127.0.0.10 / 8127.0.0.1 don't match.
function containsLoopbackLiteral(content) {
  return /(?<![\d.])127\.0\.0\.1(?![\d.])/.test(String(content || ""));
}

// Pull the text this tool call would write. Write sends `content`; Edit sends
// `new_string`. Anything else contributes nothing.
function writtenText(payload) {
  const input = (payload || {}).tool_input || {};
  const name = (payload || {}).tool_name || "";
  if (name === "Write") return String(input.content || "");
  if (name === "Edit") return String(input.new_string || "");
  return "";
}

module.exports = { isScopedPath, containsLoopbackLiteral, writtenText };

// --- Hook entrypoint ----------------------------------------------------------
if (require.main === module) {
  let input = "";
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(input);
    } catch {
      process.exit(0);
    }

    const toolName = payload.tool_name || "";
    if (toolName !== "Write" && toolName !== "Edit") {
      process.exit(0);
    }

    const filePath = (payload.tool_input || {}).file_path || "";
    if (!isScopedPath(filePath)) {
      process.exit(0);
    }

    if (!containsLoopbackLiteral(writtenText(payload))) {
      process.exit(0);
    }

    console.error(
      `Blocked: 127.0.0.1 in ${filePath} (CORE-SEC-008). ` +
        `Use \`localhost\`. Browsers scope cookies by host string, not by resolved address, ` +
        `so a session cookie written on one spelling is invisible to the other — ` +
        `mixing them breaks Supabase SSR auth in a way that looks like a random logout. ` +
        `If you genuinely need the numeric address here (a non-browser, non-cookie context), ` +
        `raise it with Tim rather than working around this hook.`
    );
    process.exit(2);
  });
}
