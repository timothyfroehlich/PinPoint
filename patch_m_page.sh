sed -i 's/import { getAccessLevel } from "~\/lib\/permissions\/matrix";/import { getAccessLevel } from "~\/lib\/permissions\/matrix";\nimport { checkPermission } from "~\/lib\/permissions\/helpers";/g' src/app/\(app\)/m/page.tsx
sed -i 's/accessLevel === "admin" || accessLevel === "technician"/checkPermission("machines.create", accessLevel)/g' src/app/\(app\)/m/page.tsx
