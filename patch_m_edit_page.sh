sed -i 's/accessLevel === "admin" || accessLevel === "technician"/checkPermission("machines.edit", accessLevel)/g' src/app/\(app\)/m/\[initials\]/\(tabs\)/edit/page.tsx
