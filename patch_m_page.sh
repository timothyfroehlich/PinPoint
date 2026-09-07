sed -i 's/accessLevel === "admin" || accessLevel === "technician"/checkPermission("machines.create", accessLevel)/g' src/app/\(app\)/m/page.tsx
