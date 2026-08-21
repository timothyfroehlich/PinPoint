// Oxlint jsPlugins entry point. Oxlint requires a DEFAULT export shaped
// `{ meta: { name }, rules }`; the ESLint flat config keeps importing the named
// exports directly (`eslint.config.mjs` builds its own `plugins.pinpoint`
// entry). Same rule objects, two engines — the rule logic stays single-sourced
// in the sibling modules and neither engine is authoritative over the other.
import { pinpointRestrictedDisablePlugin } from "./no-restricted-disable-directives.mjs";
import { pinpointTransactionPlugin } from "./no-side-effects-in-transaction.mjs";
import { pinpointServerActionNamingPlugin } from "./server-action-file-naming.mjs";

export default {
  meta: { name: "pinpoint" },
  rules: {
    ...pinpointTransactionPlugin.rules,
    ...pinpointServerActionNamingPlugin.rules,
    // Directive governance. Deliberately oxlint-only: the ESLint counterpart
    // (`eslint-comments/no-restricted-disable`) still runs from
    // `eslint.config.mjs`, so registering this for ESLint too would
    // double-report every violation. Phase 4 deletes ESLint; this is what keeps
    // the CORE-TS-007 gate standing afterwards.
    ...pinpointRestrictedDisablePlugin.rules,
  },
};
