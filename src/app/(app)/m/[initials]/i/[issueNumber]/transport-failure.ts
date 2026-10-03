/** A save whose request never completed (offline, dropped connection). */
export interface TransportFailure {
  ok: false;
  code: "TRANSPORT";
  message: string;
}

export const TRANSPORT_FAILURE: TransportFailure = {
  ok: false,
  code: "TRANSPORT",
  message: "Not saved. Check your connection and try again.",
};

/**
 * Wrap a Server Action for `useActionState` so a request that throws (the
 * connection dropped) resolves to a failed save — shown like any other —
 * instead of an exception that takes the page to the route's error boundary.
 *
 * The issue page's save actions don't read their previous state, so the
 * wrapper never passes it on.
 */
export function withTransportFailure<R>(
  action: (previous: undefined, formData: FormData) => Promise<R>
): (previous: unknown, formData: FormData) => Promise<R | TransportFailure> {
  return async (_previous, formData) => {
    try {
      return await action(undefined, formData);
    } catch {
      // A fresh object, so a second failure in a row still re-runs the
      // caller's result effect.
      return { ...TRANSPORT_FAILURE };
    }
  };
}
