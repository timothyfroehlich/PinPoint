sed -i 's/    accessLevel === "admin" ||/    checkPermission("issues.report.assignee", accessLevel);/g' src/app/\(app\)/report/unified-report-form.tsx
sed -i '/    accessLevel === "technician" ||/d' src/app/\(app\)/report/unified-report-form.tsx
sed -i '/    accessLevel === "member";/d' src/app/\(app\)/report/unified-report-form.tsx
