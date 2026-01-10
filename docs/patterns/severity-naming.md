# Severity Naming Patterns

## Player-Centric Language

```typescript
// Always use these four severity levels
type Severity = "cosmetic" | "minor" | "major" | "unplayable";

// Examples:
// - cosmetic: Visual issues that don't affect play (dirty glass, minor bulb out)
// - minor: Small issues that don't change gameplay (e.g., sound slightly distorted)
// - major: Plays, but significant feature broken (shot not registering, flipper weak)
// - unplayable: Machine cannot be played (ball stuck, flippers dead, no power)
```

**Key points**:

- Use player-centric language, not technical terms
- Four levels: cosmetic, minor, major, unplayable
- Never use technical terms like low/medium/high, or technical severity names like critical
- Defined in schema enum for type safety
