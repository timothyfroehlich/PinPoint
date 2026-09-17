// ===== CORE-A11Y-002: animate-* motion utilities pair with motion-reduce =====
//
// Static backstop for the `motion-reduce:animate-none` pairing that CORE-A11Y-002
// requires. Users with vestibular disorders request reduced motion via
// `prefers-reduced-motion`; Tailwind exposes it as the `motion-reduce:` variant,
// and the fix is one utility — `animate-spin motion-reduce:animate-none` keeps
// the static icon while suppressing the spin. The pairing has drifted across the
// codebase by manual discipline (follow-up from PP-y798, PP-ho73); this rule
// prevents regressions.
//
// ── Scope (deliberately narrow) ──────────────────────────────────────────────
// Flags the three bare motion utilities CORE-A11Y-002's "Don't" line names —
// `animate-spin`, `animate-pulse`, `animate-bounce` — when they appear in a
// class list WITHOUT a paired `motion-reduce:animate-none`. Transition utilities
// (`transition-*`) and `animate-ping` are out of this rule's scope; widening it
// would be a separate change (see the rule's bead notes).
//
// ── Where it looks (zero-false-positive priority) ────────────────────────────
// Only actual class-list POSITIONS are inspected, so a test that asserts on a
// class name (`toHaveClass("animate-spin")`, `querySelector(".animate-spin")`)
// is never flagged. Two entry points feed one walker (`inspectClassExpression`)
// that descends only through class-composition shapes:
//   1. JSX `className` / `class` attribute values — a direct string/template
//      literal, or an expression container whose expression is walked.
//   2. Calls to the class-merge helpers this repo uses — `cn` (~/lib/utils),
//      `clsx`, `cva`, `twMerge`, plus the common `cx` / `tv` / `twJoin` — so a
//      bare animate class in a module-level `cva("animate-spin", …)` or a
//      `const cls = cn(…)` is caught too.
// The walker recurses through class-merge calls, `&&`/`||`/`??` and ternary
// operands, and array elements, collecting the string and template literals in
// class position. It deliberately does NOT descend into arbitrary (non-merge)
// call arguments or comparison operands, so `className={getIcon("animate-spin")}`
// and `cn(label === "animate-spin" && x)` are not class lists and stay silent.
// Two things are therefore out of reach — an inherent limit of syntactic
// analysis, the same the sibling transaction rule documents: a class factored
// into a plain variable (`const c = "animate-spin"; className={c}`), and class
// strings nested in a `cva`/`clsx` config OBJECT (variant / compound-variant
// values). Neither occurs in the codebase today; both would need a runtime or
// object-position extension.
//
// ── The pairing check ────────────────────────────────────────────────────────
// Per class string: tokenize on whitespace, and for each token whose final
// colon-segment is one of the three animate utilities (so `md:animate-spin`
// counts, but `motion-safe:animate-spin` is skipped — motion-safe already gates
// on the same media query), require a `motion-reduce:animate-none` token in the
// SAME string. Co-locating the pairing in one class string is the CORE-A11Y-002
// convention (its examples show them adjacent) and matches every existing call
// site, so a per-string check enforces the readable form rather than chasing a
// split that no code uses.
//
// Registered in `.oxlintrc.json` (via `pinpoint-plugin.mjs`) and exercised by
// `src/test/lint/oxlint-fixtures.test.ts`.

/** The three bare motion utilities CORE-A11Y-002 forbids shipping unpaired. */
export const BARE_ANIMATE_CLASSES = [
  "animate-spin",
  "animate-pulse",
  "animate-bounce",
];

/** Class-merge helpers whose string arguments are class lists. */
const CLASS_MERGE_CALLEES = [
  "cn",
  "clsx",
  "cx",
  "cva",
  "tv",
  "twMerge",
  "twJoin",
];

export const UNPAIRED_ANIMATE_MESSAGE =
  "Bare motion utility (animate-spin/animate-pulse/animate-bounce) must be " +
  "paired with `motion-reduce:animate-none` in the same class list so users who " +
  "request reduced motion do not see it (CORE-A11Y-002). Add " +
  "`motion-reduce:animate-none` — e.g. `animate-spin motion-reduce:animate-none`.";

/** Final `:`-delimited segment of a class token (`md:animate-spin` -> `animate-spin`). */
function baseUtility(token) {
  const colon = token.lastIndexOf(":");
  return colon === -1 ? token : token.slice(colon + 1);
}

/** True when `callee` is one of the class-merge helpers (`cn(...)`, `clsx(...)`, …). */
function isClassMergeCallee(callee) {
  return (
    callee != null &&
    callee.type === "Identifier" &&
    CLASS_MERGE_CALLEES.includes(callee.name)
  );
}

/**
 * True when `text` is a class list that contains one of the three bare animate
 * utilities without a paired `motion-reduce:animate-none`.
 *
 * @param {string} text
 */
export function classListIsUnpaired(text) {
  const tokens = text.split(/\s+/).filter(Boolean);

  const hasReducePair = tokens.some(
    (t) =>
      t === "motion-reduce:animate-none" ||
      t.endsWith(":motion-reduce:animate-none")
  );
  if (hasReducePair) return false;

  return tokens.some((t) => {
    // A `motion-safe:` gate already scopes the animation to users who have NOT
    // requested reduced motion, so it needs no separate pairing.
    if (t.includes("motion-safe:")) return false;
    return BARE_ANIMATE_CLASSES.includes(baseUtility(t));
  });
}

/**
 * Custom ESLint/oxlint rule: report a bare animate-* motion utility that lacks
 * its `motion-reduce:animate-none` pairing, on className surfaces only.
 *
 * @type {import("eslint").Rule.RuleModule}
 */
export const noUnpairedAnimateMotionRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require animate-spin/animate-pulse/animate-bounce to be paired with motion-reduce:animate-none (CORE-A11Y-002).",
    },
    schema: [],
    messages: { unpaired: UNPAIRED_ANIMATE_MESSAGE },
  },
  create(context) {
    // A class-merge call inside a className attribute is reached by both the
    // JSXAttribute walk and the CallExpression visitor; report each node once.
    const reported = new WeakSet();

    /** @param {import("estree").Node} node @param {string} text */
    const check = (node, text) => {
      if (reported.has(node)) return;
      if (classListIsUnpaired(text)) {
        reported.add(node);
        context.report({ node, messageId: "unpaired" });
      }
    };

    /**
     * Walk an expression in class-list position, checking the string and
     * template literals it composes. Recurses only through class-composition
     * shapes — a non-merge call argument or a comparison operand is not a class
     * list and is not descended into.
     *
     * @param {import("estree").Node | null | undefined} node
     */
    const inspectClassExpression = (node) => {
      if (node == null) return;
      switch (node.type) {
        case "Literal":
          if (typeof node.value === "string") check(node, node.value);
          return;
        case "TemplateLiteral":
          // Interpolations become gaps; joining quasi raws with a space keeps a
          // pairing that sits in a later quasi in the same tokenized string. A
          // bare animate class living inside an interpolation expression itself
          // (`${cond ? "animate-spin" : ""}`) is not descended into — the same
          // syntactic limit noted above; the convention keeps both tokens in a
          // static quasi.
          check(node, node.quasis.map((q) => q.value.raw).join(" "));
          return;
        case "CallExpression":
          if (isClassMergeCallee(node.callee)) {
            for (const arg of node.arguments) inspectClassExpression(arg);
          }
          return;
        case "LogicalExpression":
          inspectClassExpression(node.left);
          inspectClassExpression(node.right);
          return;
        case "ConditionalExpression":
          inspectClassExpression(node.consequent);
          inspectClassExpression(node.alternate);
          return;
        case "ArrayExpression":
          for (const element of node.elements) inspectClassExpression(element);
          return;
        default:
          return;
      }
    };

    return {
      /** @param {import("estree").Node} node */
      JSXAttribute(node) {
        const name = node.name?.name;
        if (name !== "className" && name !== "class") return;
        const value = node.value;
        if (value == null) return;
        if (value.type === "Literal") {
          inspectClassExpression(value);
        } else if (value.type === "JSXExpressionContainer") {
          inspectClassExpression(value.expression);
        }
      },
      /** @param {import("estree").CallExpression} node */
      CallExpression(node) {
        if (!isClassMergeCallee(node.callee)) return;
        for (const arg of node.arguments) inspectClassExpression(arg);
      },
    };
  },
};

/**
 * Flat-config plugin object. Spread its `rules` into a `plugins` entry, then
 * enable `"<prefix>/no-unpaired-animate-motion": "error"`.
 */
export const pinpointNoUnpairedAnimateMotionPlugin = {
  rules: { "no-unpaired-animate-motion": noUnpairedAnimateMotionRule },
};
