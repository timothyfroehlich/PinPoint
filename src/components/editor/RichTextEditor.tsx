// src/components/editor/RichTextEditor.tsx
"use client";

import React, {
  useMemo,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  useEditor,
  EditorContent,
  ReactRenderer,
  type AnyExtension,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import {
  openFloatingPanel,
  type FloatingPanelHandle,
} from "~/components/ui/floating-panel";
import { searchMentionableUsers } from "~/app/(app)/mentions/actions";
import { MentionList, type MentionListRef } from "./MentionList";
import { EditorToolbar } from "./EditorToolbar";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { cn } from "~/lib/utils";
import { RICH_TEXT_CLASSES } from "~/components/editor/rich-text-classes";

export interface RichTextEditorHandle {
  clear: () => void;
  focus: () => void;
  /**
   * Replace the document without firing `onChange` — for mirroring a change
   * made elsewhere (another composer sharing the same draft).
   */
  setContent: (doc: ProseMirrorDoc | null) => void;
}

export interface RichTextEditorProps {
  content: ProseMirrorDoc | null;
  onChange: (doc: ProseMirrorDoc) => void;
  /**
   * Fired when the editor loses focus. The Settings tab uses this to flush its
   * auto-save debounce on blur (symmetric with its plain-text inputs). Optional
   * and backward-compatible — existing callers are unaffected.
   */
  onBlur?: (() => void) | undefined;
  mentionsEnabled?: boolean | undefined;
  placeholder?: string | undefined;
  compact?: boolean | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  ariaLabel?: string | undefined;
  /**
   * Show the formatting toolbar. Defaults to `true` to preserve every
   * existing caller. The timeline composer's "quick → full" transition
   * (design-bible §17) passes `false` for quick mode and flips it `true`
   * when the author taps the format toggle.
   */
  showToolbar?: boolean | undefined;
  /** Focus the editor on mount (e.g. when opened inside a sheet). */
  autoFocus?: boolean | undefined;
  /**
   * `card`: bold, italic, and lists only — the formatting a printed apron
   * card carries (apron-cards 3.7). Defaults to `full`.
   */
  formats?: "full" | "card" | undefined;
}

export const RichTextEditor = forwardRef<
  RichTextEditorHandle,
  RichTextEditorProps
>(function RichTextEditor(
  {
    content,
    onChange,
    onBlur,
    mentionsEnabled = false,
    placeholder = "Write something...",
    compact = false,
    disabled = false,
    className,
    ariaLabel,
    showToolbar = true,
    autoFocus = false,
    formats = "full",
  }: RichTextEditorProps,
  ref
) {
  const extensions = useMemo(() => {
    const list: AnyExtension[] =
      formats === "card"
        ? [
            StarterKit.configure({
              heading: false,
              blockquote: false,
              code: false,
              codeBlock: false,
              horizontalRule: false,
              strike: false,
              underline: false,
              link: false,
            }),
            Placeholder.configure({ placeholder }),
          ]
        : [
            StarterKit.configure({
              heading: { levels: [2, 3] },
              link: false, // Disabled here — configured explicitly below with custom options
            }),
            Link.configure({
              openOnClick: false,
              autolink: true,
            }),
            Placeholder.configure({
              placeholder,
            }),
          ];

    if (mentionsEnabled) {
      list.push(
        Mention.configure({
          HTMLAttributes: {
            class: "mention",
          },
          suggestion: {
            items: ({ query }) => searchMentionableUsers(query),
            render: () => {
              let component: ReactRenderer<MentionListRef> | undefined;
              let panel: FloatingPanelHandle | undefined;
              // Tiptap hands over a fresh `clientRect` on every update; the
              // panel reads whichever is current when it places itself.
              let currentRect: (() => DOMRect | null) | undefined;

              return {
                onStart: (props) => {
                  component = new ReactRenderer(MentionList, {
                    props,
                    editor: props.editor,
                  });

                  if (!props.clientRect) {
                    return;
                  }

                  currentRect = props.clientRect;
                  // The shared floating panel owns placement and the open and
                  // close motion (CORE-UI-007).
                  panel = openFloatingPanel({
                    element: component.element,
                    getAnchorRect: () => currentRect?.() ?? null,
                    contextElement: props.editor.view.dom,
                  });
                },

                onUpdate(props) {
                  component?.updateProps(props);

                  if (!props.clientRect || !component) {
                    return;
                  }

                  currentRect = props.clientRect;
                  panel?.reposition();
                },

                // Escape needs no handling here: the suggestion plugin calls
                // `onExit` itself when it sees the key.
                onKeyDown(props) {
                  return component?.ref?.onKeyDown(props) ?? false;
                },

                onExit() {
                  const closing = component;
                  const closingPanel = panel;
                  component = undefined;
                  panel = undefined;
                  currentRect = undefined;
                  // Keep the React tree alive until the fade-out finishes.
                  if (closingPanel) {
                    closingPanel.close(() => closing?.destroy());
                  } else {
                    closing?.destroy();
                  }
                },
              };
            },
          },
        })
      );
    }

    return list;
  }, [mentionsEnabled, placeholder, formats]);

  const editor = useEditor({
    extensions,
    content,
    editable: !disabled,
    autofocus: autoFocus ? "end" : false,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as ProseMirrorDoc);
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: cn(
          RICH_TEXT_CLASSES,
          "focus:outline-none px-3 py-2",
          // 16px on phones: iOS Safari zooms the page into any field smaller
          // than that when it takes focus.
          "max-md:text-base",
          // One line in compact mode, ~3 lines otherwise. Mutually exclusive
          // so the arbitrary-value min-heights never both apply (which made
          // the winner depend on stylesheet order). Compact is "jot" mode, so
          // it also drops the tall paragraph margins.
          compact ? "min-h-[40px] [&_p]:!my-1" : "min-h-[100px]"
        ),
        // aria-label is prohibited on a role-less div (axe
        // aria-prohibited-attr); the editable surface is a multi-line textbox.
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel ?? placeholder,
      },
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        // clearContent(false) avoids firing onUpdate, which would call onChange()
        // with an empty-paragraph doc and overwrite the null state already set
        // by the caller (AddCommentForm's success effect calling setComment(null)).
        editor?.commands.clearContent(false);
      },
      focus: () => {
        editor?.commands.focus();
      },
      setContent: (doc) => {
        if (doc) editor?.commands.setContent(doc, { emitUpdate: false });
        else editor?.commands.clearContent(false);
      },
    }),
    [editor]
  );

  // Sync external content changes (e.g. when restoring draft from localStorage)
  // We only set it if the editor is currently empty to prevent overwriting user input
  useEffect(() => {
    if (editor && content && editor.isEmpty) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  return (
    <div
      className={cn(
        "flex flex-col rounded-md border bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled ? "cursor-not-allowed opacity-50" : "",
        className
      )}
    >
      {showToolbar ? (
        <EditorToolbar
          editor={editor}
          mentionsEnabled={mentionsEnabled}
          formats={formats}
        />
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
});
