/**
 * Split options into runs that share a `group`, keeping their order — the
 * headings of the status picker (Open, In Progress, Closed).
 */
export function groupOptions<T extends { group?: string | undefined }>(
  options: T[]
): { group: string | undefined; items: T[] }[] {
  const groups: { group: string | undefined; items: T[] }[] = [];
  for (const option of options) {
    const last = groups.at(-1);
    if (last && last.group === option.group) {
      last.items.push(option);
    } else {
      groups.push({ group: option.group, items: [option] });
    }
  }
  return groups;
}
