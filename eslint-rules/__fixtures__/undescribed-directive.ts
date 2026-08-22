// Fixture: pinpoint/require-directive-description.
//
// `no-console` throughout, so pinpoint/no-restricted-disable-directives has
// nothing to say about this file and the two rules stay separable.

// oxlint-disable-next-line no-console
export const noDescriptionOxlint = 1;

// eslint-disable-next-line no-console
export const noDescriptionEslint = 2;

// A separator with nothing after it is not a description.
// oxlint-disable-next-line no-console --
export const emptyDescription = 3;

// eslint-disable-next-line no-console -- fixture: described, so this one is clean
export const described = 4;
