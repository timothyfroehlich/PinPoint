/**
 * Typography shared by every rich-text surface — RichTextDisplay and the
 * RichTextEditor's editable area — so text reads the same while it is being
 * written as after it is saved.
 *
 * The line-height override is what does the work. The global base `p` rule in
 * globals.css is `leading-7` (28px), which reads as double-spaced at the
 * text-sm these blocks render in, and it applies to each paragraph directly, so
 * a line height set on the container never reaches the text. The `prose`
 * classes cannot fix it: the typography plugin is not installed, so they emit
 * no CSS. They stay because tests and E2E specs select rendered rich text by
 * `.prose`.
 */
export const RICH_TEXT_CLASSES =
  "prose prose-sm prose-invert max-w-none [&_li]:leading-normal [&_p]:leading-normal";
