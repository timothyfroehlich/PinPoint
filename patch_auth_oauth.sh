sed -i 's/  if (accessLevel !== "admin") {/  if (accessLevel !== "admin") { \/\/ permissions-audit-allow: OAuth consent gate/g' src/app/\(auth\)/oauth/consent/actions.ts
sed -i 's/  if (accessLevel !== "admin") {/  if (accessLevel !== "admin") { \/\/ permissions-audit-allow: OAuth consent gate/g' src/app/\(auth\)/oauth/consent/page.tsx
