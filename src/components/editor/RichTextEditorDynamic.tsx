/**
 * Shared dynamic import for RichTextEditor.
 *
 * Use this instead of re-declaring next/dynamic({ ssr: false }) in each consumer.
 * The dynamic wrapper prevents ProseMirror (which requires a DOM) from running
 * during SSR.
 */
import dynamic from "next/dynamic";

export const RichTextEditor = dynamic(
  () =>
    import("~/components/editor/RichTextEditor").then(
      (mod) => mod.RichTextEditor
    ),
  { ssr: false }
);
