// Negative fixture: semantic tokens only, so
// better-tailwindcss/no-restricted-classes must stay quiet.
export function CleanTokens() {
  return (
    <div className="bg-primary text-primary-foreground">
      <span className="text-muted-foreground">ok</span>
    </div>
  );
}
