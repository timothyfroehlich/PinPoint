"use client";

import type React from "react";
import {
  useState,
  useActionState,
  useEffect,
  useRef,
  startTransition,
} from "react";
import { toast } from "sonner";
import {
  FieldOptionPicker,
  FieldRowStatic,
  FieldRowWithFeedback,
  type FieldOption,
} from "~/components/issues/fields/IssueFieldRow";
import type { Result } from "~/lib/result";

type FieldActionResult = Result<{ issueId: string }, string>;

interface IssueFieldRowFormProps<
  T extends string,
  R extends FieldActionResult,
> {
  issueId: string;
  /** FormData key the action reads the new value from. */
  fieldName: string;
  label: string;
  value: T;
  options: FieldOption<T>[];
  canEdit: boolean;
  action: (state: R | undefined, formData: FormData) => Promise<R>;
  testId: string;
}

/**
 * One Details row for an enum field (spec issue-detail §9.1–§9.2). A choice
 * saves immediately; a failed save puts the row back to its previous value
 * and shows the error, as a toast and inline under the row. A successful save
 * is announced to screen readers.
 *
 * Dispatches the action with a hand-built `FormData` and never renders a
 * `<form>`: React 19 auto-resets a form after its action settles, which once
 * replayed a stale value through a Radix Select (PP-0fvr).
 */
export function IssueFieldRowForm<
  T extends string,
  R extends FieldActionResult,
>({
  issueId,
  fieldName,
  label,
  value,
  options,
  canEdit,
  action,
  testId,
}: IssueFieldRowFormProps<T, R>): React.JSX.Element {
  const [selected, setSelected] = useState<T>(value);
  const [state, formAction, isPending] = useActionState<
    R | undefined,
    FormData
  >(action, undefined);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The label of the value the in-flight save is writing.
  const savingLabelRef = useRef<string | null>(null);

  // Follow server revalidation (including someone else's change).
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
    setSelected(value);
  }, [value]);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (savingLabelRef.current) {
        setAnnouncement(`${label} changed to ${savingLabelRef.current}`);
      }
    } else {
      setSelected(valueRef.current);
      setError(state.message);
      toast.error(state.message);
    }
    savingLabelRef.current = null;
  }, [state, label]);

  if (!canEdit) {
    const current = options.find((option) => option.value === value);
    return (
      <FieldRowStatic
        label={label}
        value={{
          label: current?.label ?? value,
          icon: current?.icon,
          iconColor: current?.iconColor,
        }}
        testId={`${testId}-readonly`}
      />
    );
  }

  const handleSelect = (next: T): void => {
    if (isPending) return;
    setSelected(next);
    setError(null);
    setAnnouncement("");
    savingLabelRef.current =
      options.find((option) => option.value === next)?.label ?? next;
    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append(fieldName, next);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <FieldRowWithFeedback announcement={announcement} error={error}>
      <FieldOptionPicker
        label={label}
        options={options}
        value={selected}
        onSelect={handleSelect}
        isPending={isPending}
        testId={testId}
      />
    </FieldRowWithFeedback>
  );
}
