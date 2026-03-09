// src/components/editor/RichTextEditor.tsx
"use client";

import React, { useMemo } from "react";
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

interface RichTextEditorProps {
  content: ProseMirrorDoc | null;
  onChange: (doc: ProseMirrorDoc) => void;
  mentionsEnabled?: boolean | undefined;
  placeholder?: string | undefined;
  compact?: boolean | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  ariaLabel?: string | undefined;
}

export function RichTextEditor({
  content,
  onChange,
  mentionsEnabled = false,
  placeholder = "Write something...",
  compact = false,
  disabled = false,
  className,
  ariaLabel,
}: RichTextEditorProps): React.JSX.Element {
  const extensions = useMemo(() => {
    const list: AnyExtension[] = [
      StarterKit.configure({
        heading: { levels: [2, 3] },
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
              let component: ReactRenderer<MentionListRef>;
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
                  component.updateProps(props);

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

                  return component.ref?.onKeyDown(props) ?? false;
                },

                onExit() {
                  popup?.[0]?.destroy();
                  component.destroy();
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
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as ProseMirrorDoc);
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert focus:outline-none max-w-none min-h-[100px] px-3 py-2",
          compact ? "min-h-[40px]" : ""
        ),
        "aria-label": ariaLabel ?? placeholder,
      },
    },
  });

  return (
    <div
      className={cn(
        "flex flex-col rounded-md border bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled ? "cursor-not-allowed opacity-50" : "",
        className
      )}
    >
      <EditorToolbar editor={editor} mentionsEnabled={mentionsEnabled} />
      <EditorContent editor={editor} />
    </div>
  );
}
