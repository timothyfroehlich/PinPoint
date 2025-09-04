export function setTypedProperty<T, K extends keyof T>(
  obj: Partial<T>,
  key: K,
  value: T[K]
): void {
  obj[key] = value;
}

export function buildTypedPartial<T>(
  entries: [keyof T, T[keyof T]][]
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of entries) {
    result[key] = value;
  }
  return result;
}