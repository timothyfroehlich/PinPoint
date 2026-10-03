import { z } from "zod";
import { proseMirrorDocValueSchema } from "~/lib/tiptap/types";
import { cardTextBlocks, cardTextLength } from "~/lib/machines/apron-card-text";

/** Longest card name; the switcher shows it on one line. */
export const APRON_CARD_NAME_MAX = 40;

/** Most saved cards one machine keeps. */
export const APRON_CARDS_MAX = 20;

/** Most characters of description or tip a card stores. */
const CARD_TEXT_MAX = 1500;

const cardText = proseMirrorDocValueSchema
  .nullable()
  .refine(
    (doc) => cardTextLength(cardTextBlocks(doc)) <= CARD_TEXT_MAX,
    `Card text is limited to ${CARD_TEXT_MAX} characters`
  );

const savedCardSchema = z.object({
  /** Absent for a card added since the last save. */
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Every card needs a name")
    .max(
      APRON_CARD_NAME_MAX,
      `Card names are limited to ${APRON_CARD_NAME_MAX} characters`
    ),
  size: z.enum(["stern", "wpc"], { error: "Every card needs an apron size" }),
  useCustomDescription: z.boolean(),
  description: cardText,
  tip: cardText,
  tipEnabled: z.boolean(),
  designEnabled: z.boolean(),
  artEnabled: z.boolean(),
});

/**
 * One save of the Apron card tab (spec apron-cards §11.6): every card it
 * shows, in order, plus the saved cards deleted since the last save.
 */
export const saveApronCardsSchema = z
  .object({
    machineId: z.uuid(),
    cards: z.array(savedCardSchema).max(APRON_CARDS_MAX),
    deletedIds: z.array(z.uuid()).max(APRON_CARDS_MAX),
  })
  .superRefine((value, ctx) => {
    const names = new Set<string>();
    for (const card of value.cards) {
      if (names.has(card.name)) {
        ctx.addIssue({
          code: "custom",
          message: `Two cards are named ${card.name}`,
        });
        return;
      }
      names.add(card.name);
    }
  });

export type SaveApronCardsInput = z.input<typeof saveApronCardsSchema>;
export type SavedApronCardInput = z.input<typeof savedCardSchema>;
