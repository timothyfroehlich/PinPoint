"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { z } from "zod";
import { BLOB_CONFIG } from "~/lib/blob/config";
import { isValidImageMetadata } from "~/lib/blob/validation";
import type { RichTextEditorHandle } from "~/components/editor/RichTextEditor";
import {
  docToPlainText,
  proseMirrorDocValueSchema,
  type ProseMirrorDoc,
} from "~/lib/tiptap/types";
import type { ImageMetadata } from "~/lib/types/images";

/**
 * Comment drafts: what someone has typed and the photos they have uploaded
 * into an issue's comment composer, kept per signed-in person and per issue so
 * closing the mobile sheet, switching section tabs, or reloading the page
 * never loses them. The desktop inline box and the mobile sheet read and write
 * the same draft. A machine timeline note keeps its draft here too, with the
 * tag it was given (`machineNoteDraftKey`).
 *
 * - One in-memory store per draft key, shared by every composer on the page
 *   (`useSyncExternalStore`), so two mounted composers never disagree.
 * - Typing persists to `localStorage` after a short pause; a photo persists at
 *   once. Pending writes flush when the page is hidden or unloaded.
 * - The idempotency key rides along, so a post retried after a reload is still
 *   recognised as the same submission (PP-e5th).
 * - Every storage access is guarded: without storage (private mode, blocked
 *   site data) the draft lasts for the page view only.
 */

export interface CommentDraft {
  doc: ProseMirrorDoc | null;
  images: ImageMetadata[];
  /** A machine timeline note's tag; `null` for an issue comment. */
  tag: string | null;
  idempotencyKey: string;
}

export interface CommentDraftSnapshot {
  draft: CommentDraft;
  /**
   * Who made the latest change: a composer's id, or `null` when the draft was
   * read from storage. A composer mirrors changes it did not make into its
   * editor.
   */
  origin: string | null;
}

/** Typing is saved once the person pauses this long. */
export const COMMENT_DRAFT_SAVE_DELAY_MS = 500;
/** An untouched draft older than this is dropped rather than restored. */
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DRAFT_VERSION = 1;

export function commentDraftKey(userId: string, issueId: string): string {
  return `comment_draft:${userId}:${issueId}`;
}

/** The draft of a note on a machine's timeline. */
export function machineNoteDraftKey(userId: string, machineId: string): string {
  return `comment_draft:${userId}:machine:${machineId}`;
}

const storedDraftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  savedAt: z.number(),
  doc: proseMirrorDocValueSchema.nullable(),
  images: z.array(z.unknown()),
  // Absent from drafts saved before machine notes kept drafts.
  tag: z.string().nullable().default(null),
  idempotencyKey: z.string().uuid(),
});

function sameDoc(a: ProseMirrorDoc | null, b: ProseMirrorDoc | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Remove every stored comment and note draft from this browser — on sign-out,
 * so a shared device keeps no one's unposted comments.
 */
export function clearStoredCommentDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith("comment_draft:")) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was stored.
  }
  for (const entry of entries.values()) {
    if (entry.saveTimer !== null) clearTimeout(entry.saveTimer);
    entry.saveTimer = null;
  }
  entries.clear();
}

function emptyDraft(): CommentDraft {
  return {
    doc: null,
    images: [],
    tag: null,
    idempotencyKey: crypto.randomUUID(),
  };
}

/** Whether a draft holds anything worth keeping. */
export function draftHasContent(draft: CommentDraft): boolean {
  return draft.images.length > 0 || docToPlainText(draft.doc).trim() !== "";
}

/**
 * Read a stored draft. Returns `null` for an absent, malformed, or expired
 * draft — never throws, so a corrupt entry cannot break the page.
 */
export function parseCommentDraft(
  raw: string | null,
  now: number = Date.now()
): CommentDraft | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = storedDraftSchema.safeParse(json);
  if (!parsed.success) return null;
  if (now - parsed.data.savedAt > DRAFT_MAX_AGE_MS) return null;
  const draft: CommentDraft = {
    doc: parsed.data.doc,
    images: parsed.data.images
      .filter(isValidImageMetadata)
      .slice(0, BLOB_CONFIG.LIMITS.COMMENT_MAX),
    tag: parsed.data.tag,
    idempotencyKey: parsed.data.idempotencyKey,
  };
  return draftHasContent(draft) ? draft : null;
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, draft: CommentDraft): void {
  try {
    if (draftHasContent(draft)) {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: DRAFT_VERSION,
          savedAt: Date.now(),
          ...draft,
        })
      );
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable or full: the draft lives in memory for this page
    // view only.
  }
}

interface DraftEntry {
  snapshot: CommentDraftSnapshot;
  listeners: Set<() => void>;
  saveTimer: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<string, DraftEntry>();

function loadSnapshot(key: string): CommentDraftSnapshot {
  const raw = readStorage(key);
  const stored = parseCommentDraft(raw);
  // Drop what could not be restored so it can't linger.
  if (raw !== null && stored === null) writeStorage(key, emptyDraft());
  return { draft: stored ?? emptyDraft(), origin: null };
}

function getEntry(key: string): DraftEntry {
  let entry = entries.get(key);
  if (!entry) {
    installPageListeners();
    entry = {
      snapshot: loadSnapshot(key),
      listeners: new Set(),
      saveTimer: null,
    };
    entries.set(key, entry);
  }
  return entry;
}

function notify(entry: DraftEntry): void {
  for (const listener of entry.listeners) listener();
}

function flush(key: string, entry: DraftEntry): void {
  if (entry.saveTimer === null) return;
  clearTimeout(entry.saveTimer);
  entry.saveTimer = null;
  writeStorage(key, entry.snapshot.draft);
}

function flushAll(): void {
  for (const [key, entry] of entries) flush(key, entry);
}

function update(
  key: string,
  origin: string,
  next: (draft: CommentDraft) => CommentDraft,
  save: "debounced" | "now"
): void {
  const entry = getEntry(key);
  entry.snapshot = { draft: next(entry.snapshot.draft), origin };
  notify(entry);
  if (entry.saveTimer !== null) clearTimeout(entry.saveTimer);
  if (save === "now") {
    entry.saveTimer = null;
    writeStorage(key, entry.snapshot.draft);
  } else {
    entry.saveTimer = setTimeout(() => {
      entry.saveTimer = null;
      writeStorage(key, entry.snapshot.draft);
    }, COMMENT_DRAFT_SAVE_DELAY_MS);
  }
}

let pageListenersInstalled = false;

function installPageListeners(): void {
  if (pageListenersInstalled || typeof window === "undefined") return;
  pageListenersInstalled = true;
  // A reload or a phone backgrounding the tab must not lose the last
  // keystrokes still waiting on the save delay.
  window.addEventListener("pagehide", flushAll);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });
  // Another browser tab saved or posted this draft.
  window.addEventListener("storage", (event) => {
    if (event.key === null) return;
    const entry = entries.get(event.key);
    if (!entry) return;
    if (entry.saveTimer !== null) {
      clearTimeout(entry.saveTimer);
      entry.saveTimer = null;
    }
    entry.snapshot = loadSnapshot(event.key);
    notify(entry);
  });
}

const SERVER_SNAPSHOT: CommentDraftSnapshot = {
  draft: { doc: null, images: [], tag: null, idempotencyKey: "" },
  origin: null,
};

export interface CommentDraftControls {
  snapshot: CommentDraftSnapshot;
  setDoc: (doc: ProseMirrorDoc) => void;
  addImage: (image: ImageMetadata) => void;
  setTag: (tag: string) => void;
  /** Empty the draft (after a post) and mint the next idempotency key. */
  clear: () => void;
}

/**
 * The comment draft stored under `key`, for the composer `composerId`.
 * Server rendering sees an empty draft; the stored one appears on hydration.
 */
export function useCommentDraft(
  key: string,
  composerId: string
): CommentDraftControls {
  const subscribe = useCallback(
    (listener: () => void) => {
      const entry = getEntry(key);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    [key]
  );
  const getSnapshot = useCallback(() => getEntry(key).snapshot, [key]);
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SERVER_SNAPSHOT
  );

  const setDoc = useCallback(
    (doc: ProseMirrorDoc) =>
      update(
        key,
        composerId,
        // A changed comment is a new submission. The key stays the same only
        // while the text does, so a retry of the same post is deduped but an
        // edit after a post whose response was lost is not mistaken for it.
        (draft) =>
          sameDoc(draft.doc, doc)
            ? { ...draft, doc }
            : { ...draft, doc, idempotencyKey: crypto.randomUUID() },
        "debounced"
      ),
    [key, composerId]
  );
  const addImage = useCallback(
    (image: ImageMetadata) =>
      update(
        key,
        composerId,
        // Adding a photo changes the submission too.
        (draft) => ({
          ...draft,
          images: [...draft.images, image],
          idempotencyKey: crypto.randomUUID(),
        }),
        "now"
      ),
    [key, composerId]
  );
  const setTag = useCallback(
    (tag: string) =>
      update(
        key,
        composerId,
        // Re-tagging a note changes the submission too.
        (draft) =>
          draft.tag === tag
            ? draft
            : { ...draft, tag, idempotencyKey: crypto.randomUUID() },
        "now"
      ),
    [key, composerId]
  );
  const clear = useCallback(
    () => update(key, composerId, () => emptyDraft(), "now"),
    [key, composerId]
  );

  return { snapshot, setDoc, addImage, setTag, clear };
}

export interface DraftEditorSync {
  /** The editor's `onChange`. */
  onDocChange: (doc: ProseMirrorDoc) => void;
  /** Empty the draft and the editor, after a post. */
  clear: () => void;
}

/**
 * Keep a composer's editor in step with its draft. Changes another composer
 * made to the same draft (the hidden inline box while the mobile sheet is in
 * use, or another browser tab) are copied into this editor — unless the
 * person is typing in `containerRef`, in which case their version wins and is
 * saved back, so what they see is what posts.
 */
export function useDraftEditorSync({
  draft,
  composerId,
  editorRef,
  containerRef,
}: {
  draft: CommentDraftControls;
  composerId: string;
  editorRef: RefObject<RichTextEditorHandle | null>;
  containerRef: RefObject<HTMLElement | null>;
}): DraftEditorSync {
  const { snapshot, setDoc, clear: clearDraft } = draft;
  const seenSnapshotRef = useRef<CommentDraftSnapshot>(snapshot);
  // The last document typed in this composer.
  const localDocRef = useRef<ProseMirrorDoc | null>(null);

  const onDocChange = useCallback(
    (doc: ProseMirrorDoc) => {
      localDocRef.current = doc;
      setDoc(doc);
    },
    [setDoc]
  );

  useEffect(() => {
    if (seenSnapshotRef.current === snapshot) return;
    seenSnapshotRef.current = snapshot;
    if (snapshot.origin === composerId) return;
    const typingHere =
      containerRef.current?.contains(document.activeElement) ?? false;
    if (typingHere && localDocRef.current !== null) {
      setDoc(localDocRef.current);
      return;
    }
    editorRef.current?.setContent(snapshot.draft.doc);
  }, [snapshot, composerId, setDoc, editorRef, containerRef]);

  const clear = useCallback(() => {
    localDocRef.current = null;
    // Mints a fresh idempotency key — the next post is a new submission.
    clearDraft();
    editorRef.current?.clear();
  }, [clearDraft, editorRef]);

  return { onDocChange, clear };
}
