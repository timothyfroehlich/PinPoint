## 2025-05-18 - TooltipProvider Missing from Root Layout
**Learning:** The application lacked a global `TooltipProvider` in `layout.tsx`, forcing individual components to implement their own providers or risk missing functionality. This is a common oversight in shadcn/ui integration.
**Action:** When adding Radix primitives that require providers (Tooltip, Toast, etc.), always verify they are present in the root layout first to ensure consistent behavior and avoid redundant wrapping.
