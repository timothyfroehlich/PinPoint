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
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { searchMentionableUsers } from "~/app/(app)/mentions/actions";
import { MentionList, type MentionListRef } from "./MentionList";
import { EditorToolbar } from "./EditorToolbar";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { cn } from "~/lib/utils";

export interface RichTextEditorHandle {
  clear: () => void;
  focus: () => void;
}

interface RichTextEditorProps {
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
  }: RichTextEditorProps,
  ref
) {
  const extensions = useMemo(() => {
    const list: AnyExtension[] = [
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
              let popup: TippyInstance[] | undefined;

              return {
                onStart: (props) => {
                  component = new ReactRenderer(MentionList, {
                    props,
                    editor: props.editor,
                  });

                  if (!props.clientRect) {
                    return;
                  }

                  const clientRect = props.clientRect as () => DOMRect;

                  popup = tippy("body", {
                    getReferenceClientRect: clientRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: "manual",
                    placement: "bottom-start",
                  });
                },

                onUpdate(props) {
                  component?.updateProps(props);

                  if (!props.clientRect || !popup?.[0]) {
                    return;
                  }

                  const clientRect = props.clientRect as () => DOMRect;

                  popup[0].setProps({
                    getReferenceClientRect: clientRect,
                  });
                },

                onKeyDown(props) {
                  if (props.event.key === "Escape") {
                    popup?.[0]?.hide();
                    return true;
                  }

                  return component?.ref?.onKeyDown(props) ?? false;
                },

                onExit() {
                  popup?.[0]?.destroy();
                  component?.destroy();
                },
              };
            },
          },
        })
      );
    }

    return list;
  }, [mentionsEnabled, placeholder]);

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
          "prose prose-sm prose-invert focus:outline-none max-w-none px-3 py-2",
          // One line in compact mode, ~3 lines otherwise. Mutually exclusive
          // so the arbitrary-value min-heights never both apply (which made
          // the winner depend on stylesheet order). Compact is "jot" mode, so
          // it also drops prose's airy rhythm (1.71 leading + tall paragraph
          // margins) for snug utility-text spacing.
          compact ? "min-h-[40px] !leading-snug [&_p]:!my-1" : "min-h-[100px]"
        ),
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
        <EditorToolbar editor={editor} mentionsEnabled={mentionsEnabled} />
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
});
