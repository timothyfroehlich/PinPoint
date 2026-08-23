// ===== Server Action file naming =====
//
// A module whose directive prologue is `"use server"` must be named
// `actions.ts` or `<something>-action(s).ts`, or live under
// `src/server/actions/`.
//
// ── Why a naming rule exists at all ──────────────────────────────────────────
// Server Actions are deliberately NOT collected into one directory: a
// route-local action colocates with its route under `src/app/**` (that is the
// App Router convention and the import graph confirms it — each colocated
// action is imported only from within its own feature subtree), while a
// genuinely cross-cutting action lives in `src/server/actions/`. That split is
// worth keeping.
//
// The cost of keeping it is that "is this a Server Action module?" becomes a
// file-CONTENT question, and several things that need to answer it can only
// match on PATH:
//
//   - Tooling, linters, CODEOWNERS entries, CI path filters, or reviewer
//     checklists keyed on actions.
//
// Those consumers all use the same four globs:
//
//     **/actions.ts
//     **/*-action.ts
//     **/*-actions.ts
//     src/server/actions/**
//
// A new action named `foo.ts` would silently fall out of every one of them, and
// nothing would fail. This rule is what makes that failure loud. It does NOT
// enforce where the file lives, only what it is called; moving actions around
// stays a free choice.
//
// ── Scope: module-level directive only ───────────────────────────────────────
// Only a `"use server"` in the module's directive prologue marks the whole file
// as a Server Action module, and only that is matched here
// (`Program > ExpressionStatement[directive="use server"]`). An inline
// `"use server"` inside a function body is a different construct with a
// different rule (CORE-ARCH-005 bans it as a form-action wrapper) and is not
// this rule's business. A `"use server"` appearing in a comment or a string
// literal is not a directive and never matches — three files in `src/app/(auth)`
// mention it in prose for exactly this reason.

// The pattern must accept EXACTLY what the four globs above match — no more.
// Two near-misses this deliberately rejects, because accepting either would
// pass a file the globs then drop, which is the failure this rule exists to
// catch:
//   - bare singular `action.ts` — `**/actions.ts` is plural, and the other two
//     globs require the literal `-`.
//   - any `.tsx` — every glob ends in `.ts`. A module that is nothing but
//     Server Actions has no JSX, so `.tsx` is the wrong extension regardless;
//     widening the globs to cover it would buy nothing.
/** Basename of a conforming action module: `actions.ts` or `*-action(s).ts`. */
export const ACTION_FILENAME_PATTERN = /^(?:actions|.*-actions?)\.ts$/;

/** Shared (non-route-local) actions live here and are exempt from the basename rule. */
export const SHARED_ACTIONS_DIR_PATTERN =
  /(?:^|[/\\])src[/\\]server[/\\]actions[/\\]/;

export const SERVER_ACTION_FILE_NAMING_MESSAGE =
  'A module with a top-level "use server" directive must be named ' +
  "`actions.ts` or `<name>-action.ts` / `<name>-actions.ts`, or live under " +
  "`src/server/actions/`. Path-based tooling and conventions match on filename, " +
  "not on the directive, so an off-pattern name silently drops the file out of them.";

/**
 * Returns true when `filename` satisfies the Server Action naming convention.
 *
 * @param {string} filename absolute or relative path to the linted file
 */
export function isConformingActionFilename(filename) {
  if (SHARED_ACTIONS_DIR_PATTERN.test(filename)) return true;
  const basename = filename.split(/[/\\]/).pop() ?? "";
  return ACTION_FILENAME_PATTERN.test(basename);
}

/**
 * Custom ESLint rule: a module-level `"use server"` file must be named so the
 * path globs that route rules to Server Actions can find it.
 *
 * @type {import("eslint").Rule.RuleModule}
 */
export const serverActionFileNamingRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Require a module with a top-level "use server" directive to be named actions.ts / *-action(s).ts or live in src/server/actions/.',
    },
    schema: [],
    messages: { serverActionFileNaming: SERVER_ACTION_FILE_NAMING_MESSAGE },
  },
  create(context) {
    return {
      'Program > ExpressionStatement[directive="use server"]': (node) => {
        const filename = context.filename;
        if (!filename) return;
        if (isConformingActionFilename(filename)) return;
        context.report({ node, messageId: "serverActionFileNaming" });
      },
    };
  },
};

/**
 * Flat-config plugin object. Merge its `rules` into the `pinpoint` plugin entry
 * in `eslint.config.mjs`, then enable
 * `"pinpoint/server-action-file-naming": "error"`.
 */
export const pinpointServerActionNamingPlugin = {
  rules: { "server-action-file-naming": serverActionFileNamingRule },
};
