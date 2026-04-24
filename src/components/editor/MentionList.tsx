// src/components/editor/MentionList.tsx
"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

interface MentionListProps {
  items: {
    id: string;
    name: string;
    avatarUrl: string | null;
  }[];
  command: (props: { id: string; label: string }) => void;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number): void => {
      const item = props.items[index];

      if (item) {
        props.command({ id: item.id, label: item.name });
      }
    };

    const upHandler = (): void => {
      if (props.items.length === 0) return;
      setSelectedIndex(
        (prev) => (prev + props.items.length - 1) % props.items.length
      );
    };

    const downHandler = (): void => {
      if (props.items.length === 0) return;
      setSelectedIndex((prev) => (prev + 1) % props.items.length);
    };

    const enterHandler = (): void => {
      selectItem(selectedIndex);
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          upHandler();
          return true;
        }

        if (event.key === "ArrowDown") {
          downHandler();
          return true;
        }

        if (event.key === "Enter") {
          enterHandler();
          return true;
        }

        return false;
      },
    }));

    if (props.items.length === 0) {
      return (
        <div className="rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md">
          No users found
        </div>
      );
    }

    return (
      <div className="flex flex-col overflow-hidden rounded-md border bg-popover p-1 shadow-md">
        {props.items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ${
              index === selectedIndex ? "bg-accent text-accent-foreground" : ""
            }`}
            onClick={() => selectItem(index)}
          >
            <Avatar className="h-6 w-6">
              {item.avatarUrl ? (
                <AvatarImage src={item.avatarUrl} alt={item.name} />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {item.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>{item.name}</span>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = "MentionList";
