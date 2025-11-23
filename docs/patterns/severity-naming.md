# Severity Naming Patterns

## Player-Centric Language

```typescript
// Always use these three severity levels
type Severity = "minor" | "playable" | "unplayable";

// Examples:
// - minor: Cosmetic issues (light out, worn art)
// - playable: Affects gameplay but machine is playable (shot not registering)
// - unplayable: Machine cannot be played (display dead, ball stuck)
```

**Key points**:

- Use player-centric language, not technical terms
- Three levels only: minor, playable, unplayable
- Never use: low/medium/high, critical, or other severity names
- Defined in schema enum for type safety
