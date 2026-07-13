"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { createCollectionAction } from "~/app/(app)/c/collections/actions";

export function CreateCollectionForm(): React.JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData): Promise<void> {
    const raw = formData.get("name");
    const name = typeof raw === "string" ? raw : "";
    const result = await createCollectionAction({ name });
    if (result.success && result.data) {
      router.push(`/c/collection/${result.data.id}`);
    } else {
      setError(result.success ? "Create failed" : result.error);
    }
  }

  return (
    <form
      action={(fd) => startTransition(() => void action(fd))}
      className="flex items-start gap-2"
    >
      <div className="flex flex-col gap-1">
        <Input
          name="name"
          required
          maxLength={120}
          placeholder="New collection name"
          aria-label="New collection name"
          enterKeyHint="done"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create"}
      </Button>
    </form>
  );
}
