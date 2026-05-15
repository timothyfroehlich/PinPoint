/**
 * Shared sanitize-html config fragments.
 *
 * NON_TEXT_TAGS extends sanitize-html's default `nonTextTags`
 * (`['script', 'style', 'textarea', 'option']`) with raw-text HTML
 * elements that pass their content through unparsed by the HTML
 * parser. When sanitize-html strips a tag listed in `nonTextTags`,
 * its content is dropped instead of being preserved as text — which
 * the browser could otherwise re-parse as HTML when the output is
 * injected back into the DOM.
 *
 * Hardens against GHSA-rpr9-rxv7-x643 (sanitize-html xmp passthrough,
 * CVSS 9.3, no upstream patch as of 2026-05-15) and the broader class
 * of raw-text-element bypasses (xmp, noscript, noembed, noframes).
 */
export const NON_TEXT_TAGS: readonly string[] = [
  "script",
  "style",
  "textarea",
  "option",
  "xmp",
  "noscript",
  "noembed",
  "noframes",
];
