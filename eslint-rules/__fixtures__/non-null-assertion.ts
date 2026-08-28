// Deliberately violates typescript/no-non-null-assertion in source files
const maybeString: string | null = null;
export const definitelyString = maybeString!;
