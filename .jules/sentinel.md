# Sentinel Journal

## 2025-12-16 - Missing Input Length Limits

**Vulnerability:** Found that authenticated users could submit unlimited length strings for issue descriptions and comments.
**Learning:** Zod schemas for authenticated actions were missing `.max()` constraints, while public forms had them.
**Prevention:** Always audit schemas for `.max()` constraints on string fields to prevent DoS.
