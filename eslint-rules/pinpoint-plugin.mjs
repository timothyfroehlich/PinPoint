// Oxlint jsPlugins entry point. Oxlint requires a DEFAULT export shaped
// `{ meta: { name }, rules }`.
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
    // Directive governance. These two are the sole CORE-TS-007 disable gate.
    ...pinpointRestrictedDisablePlugin.rules,
    ...pinpointRequireDirectiveDescriptionPlugin.rules,
    ...pinpointNoTestComLiteralsPlugin.rules,
  },
};
