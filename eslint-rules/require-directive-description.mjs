// ===== Every suppression explains itself =====
//
// Replaces `eslint-comments/require-description` (`eslint.config.mjs`), which
// has no oxlint equivalent — oxc declined a built-in (oxc-project/oxc#22193)
// and recommends a JS plugin, which is what this is.
//
// A suppression without a reason is unreviewable: the next reader cannot tell
// whether it was a considered exception or a way past a red gate. Requiring
// `-- why` costs the author one clause and gives the reviewer the whole
// argument.
//
// Like its sibling `no-restricted-disable-directives`, this matches BOTH the
// `eslint-` and `oxlint-` prefixes: after the cutover people will write
// `oxlint-disable`, and a rule that only understood `eslint-` would quietly
// stop covering new suppressions.

/**
 * A disable OR enable directive of either engine, capturing everything after
 * the directive keyword.
 *
 * `-enable` is included because ESLint's original covered it: a bare
 * `eslint-enable` re-enables everything and is as worth explaining as the
 * disable that preceded it.
 *
 * The `(?![\w-])` guard stops `eslint-disable-next-line` from being read as
 * `eslint-disable` followed by a rule named `-next-line`, and stops a word
 * like `eslint-disabled` from matching at all.
 */
const DIRECTIVE_RE =
  /^\s*(?:eslint|oxlint)-(?:disable|enable)(?:-next-line|-line)?(?![\w-])([\s\S]*)$/;

export const requireDirectiveDescriptionRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disable/enable directives must explain themselves with a `-- reason`",
    },
    schema: [],
    messages: {
      missing:
        "Directive comment needs a description: append `-- <why this suppression is safe here>`.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = DIRECTIVE_RE.exec(comment.value);
          if (!match) continue;

          // `split("--", 2)` would truncate a description that itself contains
          // `--`; take everything after the FIRST separator instead.
          const rest = match[1] ?? "";
          const separator = rest.indexOf("--");
          const description =
            separator === -1 ? "" : rest.slice(separator + 2).trim();

          if (description === "") {
            context.report({ loc: comment.loc, messageId: "missing" });
          }
        }
      },
    };
  },
};

/**
 * Flat-config plugin object, merged into the `pinpoint` namespace by
 * `eslint-rules/pinpoint-plugin.mjs`.
 */
export const pinpointRequireDirectiveDescriptionPlugin = {
  rules: {
    "require-directive-description": requireDirectiveDescriptionRule,
  },
};
