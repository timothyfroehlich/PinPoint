sed -i 's/      validated.newRole !== "admin"/      validated.newRole !== "admin" \/\/ permissions-audit-allow: self-demotion invariant/g' src/app/\(app\)/admin/users/actions.ts
