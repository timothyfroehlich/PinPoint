// Oxlint jsPlugins entry point. Oxlint requires a DEFAULT export shaped
// `{ meta: { name }, rules }`; the ESLint flat config keeps importing the named
// exports directly (`eslint.config.mjs` builds its own `plugins.pinpoint`
// entry). Same rule objects, two engines — the rule logic stays single-sourced
// in the sibling modules and neither engine is authoritative over the other.
import { pinpointRestrictedDisablePlugin } from "./no-restricted-disable-directives.mjs";
import { pinpointNoTestComLiteralsPlugin } from "./no-test-com-literals.mjs";
import { pinpointTransactionPlugin } from "./no-side-effects-in-transaction.mjs";
import { pinpointRequireDirectiveDescriptionPlugin } from "./require-directive-description.mjs";
import { pinpointServerActionNamingPlugin } from "./server-action-file-naming.mjs";

export default {
  meta: { name: "pinpoint" },
  rules: {
    ...pinpointTransactionPlugin.rules,
    ...pinpointServerActionNamingPlugin.rules,
    // Directive governance. These two are oxlint-only by design: their ESLint
    // counterparts (`eslint-comments/no-restricted-disable` and
    // `eslint-comments/require-description`) still run from
    // `eslint.config.mjs`, so registering them for ESLint as well would
    // double-report every violation. Phase 4 deletes ESLint; these are what
    // keep the CORE-TS-007 gate standing afterwards.
    ...pinpointRestrictedDisablePlugin.rules,
    ...pinpointRequireDirectiveDescriptionPlugin.rules,
    ...pinpointNoTestComLiteralsPlugin.rules,
  },
};
