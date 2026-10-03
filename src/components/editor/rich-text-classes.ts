/**
 * Typography shared by every rich-text surface — RichTextDisplay and the
 * RichTextEditor's editable area — so text reads the same while it is being
 * written as after it is saved.
 *
 * Every element style here is written out by hand because the `prose` classes
 * do nothing: the typography plugin is not installed, so they emit no CSS.
 * They stay because tests and E2E specs select rendered rich text by `.prose`.
 *
 * - Paragraphs and list items: `leading-normal`, set on each element because a
 *   line height on the container would not reach them.
 * - Lists: Tailwind's preflight strips markers and indent, which made a
 *   bulleted list read as plain lines.
 * - Headings: the global base rules size `h2`/`h3` for page titles (text-3xl,
 *   text-2xl), far too large inside a comment.
 * - Links: preflight makes them inherit color with no underline, so they read
 *   as plain text. Mentions keep their own `mention` styling.
 * - Blockquote, code, and rules: no toolbar button, but the editor's markdown
 *   shortcuts (`> `, backticks, `---`) still create them.
 */
export const RICH_TEXT_CLASSES = [
  "prose prose-sm prose-invert max-w-none",
  "[&>:first-child]:mt-0",
  "[&_p]:leading-normal [&_li]:leading-normal",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5 [&_li_ol]:my-0.5 [&_li_ul]:my-0.5 [&_ul_ul]:list-[circle]",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold",
  "[&_a]:text-primary [&_a:not(.mention)]:underline [&_a:not(.mention)]:underline-offset-2",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-outline-variant [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em]",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_hr]:my-4 [&_hr]:border-outline-variant",
].join(" ");
