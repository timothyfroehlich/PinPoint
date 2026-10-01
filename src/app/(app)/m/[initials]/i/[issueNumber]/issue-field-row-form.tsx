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
 * and shows the error.
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

  // Follow server revalidation (including someone else's change).
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
    setSelected(value);
  }, [value]);

  useEffect(() => {
    if (state && !state.ok) {
      setSelected(valueRef.current);
      toast.error(state.message);
    }
  }, [state]);

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
    setSelected(next);
    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append(fieldName, next);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <FieldOptionPicker
      label={label}
      options={options}
      value={selected}
      onSelect={handleSelect}
      isPending={isPending}
      testId={testId}
    />
  );
}
