export function setTypedProperty<T, K extends keyof T>(
  obj: Partial<T>,
  key: K,
  value: T[K],
): void {
  Object.defineProperty(obj, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

export function buildTypedPartial<T>(
  entries: [keyof T, T[keyof T]][],
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of entries) {
    Object.defineProperty(result, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return result;
}
