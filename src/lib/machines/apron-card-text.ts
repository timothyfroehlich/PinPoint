import type {
  ProseMirrorDoc,
  ProseMirrorMark,
  ProseMirrorNode,
} from "~/lib/tiptap/types";
import { isProseMirrorDoc } from "~/lib/tiptap/types";

/**
 * Card text as the printed card renders it (spec apron-cards §3.7): paragraphs
 * and one level of bulleted or numbered list, with bold and italic. Everything
 * else a description can hold prints as plain text — a heading becomes a
 * paragraph, a link its text, a mention its "@name".
 */
export interface CardTextRun {
  /** "\n" marks a line break inside a paragraph or list item. */
  text: string;
  bold?: true;
  italic?: true;
}

export type CardTextBlock =
  | { kind: "paragraph"; runs: CardTextRun[] }
  | { kind: "list"; ordered: boolean; items: CardTextRun[][] };

function markSet(marks: ProseMirrorMark[] | undefined): {
  bold?: true;
  italic?: true;
} {
  const result: { bold?: true; italic?: true } = {};
  for (const mark of marks ?? []) {
    if (mark.type === "bold") result.bold = true;
    if (mark.type === "italic") result.italic = true;
  }
  return result;
}

/** The inline runs of `nodes`; block children are joined with line breaks. */
function inlineRuns(nodes: ProseMirrorNode[] | undefined): CardTextRun[] {
  const runs: CardTextRun[] = [];
  const push = (run: CardTextRun): void => {
    const last = runs.at(-1);
    if (
      last &&
      last.text !== "\n" &&
      run.text !== "\n" &&
      last.bold === run.bold &&
      last.italic === run.italic
    ) {
      last.text += run.text;
    } else {
      runs.push(run);
    }
  };
  const walk = (list: ProseMirrorNode[] | undefined): void => {
    for (const node of list ?? []) {
      if (node.type === "text" && node.text) {
        push({ text: node.text, ...markSet(node.marks) });
      } else if (node.type === "mention") {
        const label = node.attrs?.["label"];
        if (typeof label === "string") push({ text: `@${label}` });
      } else if (node.type === "hardBreak") {
        push({ text: "\n" });
      } else if (node.content) {
        // A block nested inside an inline context (a paragraph or nested list
        // inside a list item) starts on its own line.
        if (runs.length > 0 && runs.at(-1)?.text !== "\n") {
          push({ text: "\n" });
        }
        walk(node.content);
      }
    }
  };
  walk(nodes);
  while (runs.at(-1)?.text === "\n") runs.pop();
  return runs;
}

function hasText(runs: CardTextRun[]): boolean {
  return runs.some((run) => run.text.trim() !== "");
}

/** The printable blocks of a stored description or tip (spec §3.7). */
export function cardTextBlocks(
  doc: ProseMirrorDoc | null | undefined
): CardTextBlock[] {
  if (!isProseMirrorDoc(doc)) return [];
  const blocks: CardTextBlock[] = [];
  const walk = (nodes: ProseMirrorNode[]): void => {
    for (const node of nodes) {
      if (node.type === "bulletList" || node.type === "orderedList") {
        const items = (node.content ?? [])
          .map((item) => inlineRuns(item.content))
          .filter(hasText);
        if (items.length > 0) {
          blocks.push({
            kind: "list",
            ordered: node.type === "orderedList",
            items,
          });
        }
      } else if (node.type === "blockquote") {
        walk(node.content ?? []);
      } else {
        const runs = inlineRuns(node.content);
        if (hasText(runs)) blocks.push({ kind: "paragraph", runs });
      }
    }
  };
  walk(doc.content);
  return blocks;
}

/** Plain text as card blocks: one paragraph per line, as hand-typed text. */
export function plainCardText(text: string): CardTextBlock[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ kind: "paragraph", runs: [{ text: line }] }));
}

function runNodes(runs: CardTextRun[]): ProseMirrorNode[] {
  return runs.map((run) => {
    if (run.text === "\n") return { type: "hardBreak" };
    const marks: ProseMirrorMark[] = [];
    if (run.bold) marks.push({ type: "bold" });
    if (run.italic) marks.push({ type: "italic" });
    return marks.length > 0
      ? { type: "text", text: run.text, marks }
      : { type: "text", text: run.text };
  });
}

/**
 * A description or tip reduced to what the card prints (spec §3.7), or null
 * when it has no text. Saving stores this form, so the editor and the card
 * never disagree about what the text contains.
 */
export function cardTextDoc(
  doc: ProseMirrorDoc | null | undefined
): ProseMirrorDoc | null {
  const blocks = cardTextBlocks(doc);
  if (blocks.length === 0) return null;
  return {
    type: "doc",
    content: blocks.map((block) =>
      block.kind === "paragraph"
        ? { type: "paragraph", content: runNodes(block.runs) }
        : {
            type: block.ordered ? "orderedList" : "bulletList",
            content: block.items.map((runs) => ({
              type: "listItem",
              content: [{ type: "paragraph", content: runNodes(runs) }],
            })),
          }
    ),
  };
}

/** The characters a card's text holds, for the length limit. */
export function cardTextLength(blocks: CardTextBlock[]): number {
  let length = 0;
  for (const block of blocks) {
    const runs = block.kind === "paragraph" ? [block.runs] : block.items;
    for (const item of runs) {
      for (const run of item) length += run.text.length;
    }
  }
  return length;
}
