// Fixture: better-tailwindcss/no-restricted-classes must fire twice —
// once for the raw palette class (line 6) and once for the arbitrary hex
// (line 7). Line numbers are asserted by src/test/lint/oxlint-fixtures.test.ts.
export function Palette() {
  return (
    <div className="bg-red-500">
      <span className="text-[#ff0000]">nope</span>
    </div>
  );
}
