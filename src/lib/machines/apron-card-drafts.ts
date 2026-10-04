import type {
  ApronCardSize,
  ApronCardTemplate,
  SavedApronCard,
} from "~/lib/machines/apron-card";
import { cardTextDoc } from "~/lib/machines/apron-card-text";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

/**
 * One card as the Apron card tab edits it (spec apron-cards §11.6). `key` is
 * stable across the edit; `id` is null for a card added since the last save,
 * and `size` is null until one is chosen (§4.3).
 */
export interface ApronCardDraft {
  key: string;
  id: string | null;
  name: string;
  size: ApronCardSize | null;
  template: ApronCardTemplate;
  useCustomDescription: boolean;
  description: ProseMirrorDoc | null;
  tip: ProseMirrorDoc | null;
  tipEnabled: boolean;
  designEnabled: boolean;
  artEnabled: boolean;
}

export function draftFromSaved(card: SavedApronCard): ApronCardDraft {
  return { ...card, key: card.id };
}

/**
 * A new card (§11.3): blank, on the Standard template (§5.5), with no size
 * until one is chosen (§4.2–4.3).
 */
export function blankDraft(key: string, name: string): ApronCardDraft {
  return {
    key,
    id: null,
    name,
    size: null,
    template: "standard",
    useCustomDescription: false,
    description: null,
    tip: null,
    tipEnabled: false,
    designEnabled: true,
    artEnabled: true,
  };
}

/** "Card N" with the lowest N no card is named yet. */
export function nextCardName(names: readonly string[]): string {
  const taken = new Set(names);
  for (let n = names.length + 1; ; n += 1) {
    const name = `Card ${n}`;
    if (!taken.has(name)) return name;
  }
}

/** Card text compares by what prints, so an emptied editor equals no text. */
function sameText(a: ProseMirrorDoc | null, b: ProseMirrorDoc | null): boolean {
  return JSON.stringify(cardTextDoc(a)) === JSON.stringify(cardTextDoc(b));
}

function sameCard(draft: ApronCardDraft, saved: SavedApronCard): boolean {
  return (
    draft.id === saved.id &&
    draft.name === saved.name &&
    draft.size === saved.size &&
    draft.template === saved.template &&
    draft.useCustomDescription === saved.useCustomDescription &&
    sameText(draft.description, saved.description) &&
    sameText(draft.tip, saved.tip) &&
    draft.tipEnabled === saved.tipEnabled &&
    draft.designEnabled === saved.designEnabled &&
    draft.artEnabled === saved.artEnabled
  );
}

/** Whether the tab's cards differ from what is saved. */
export function draftsDirty(
  drafts: readonly ApronCardDraft[],
  saved: readonly SavedApronCard[]
): boolean {
  if (drafts.length !== saved.length) return true;
  return drafts.some((draft, i) => {
    const card = saved[i];
    return card === undefined || !sameCard(draft, card);
  });
}
