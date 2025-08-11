# Material UI v7: API Cleanup & CSS Layers

_Modernization and interoperability for the CSS ecosystem_

## Key Changes Since November 2025

### 🚨 **Major API Cleanup**

**Deprecated Components Removed**

- **REMOVED:** `Hidden` component - use `sx` prop with responsive breakpoints
- **REMOVED:** Component-specific props like `onBackdropClick`
- **REMOVED:** `createMuiTheme` function - use `createTheme`
- **Migration Impact:** Breaking changes requiring code updates

**Components Promoted from @mui/lab**

- **DO:** Update imports from `@mui/lab` to `@mui/material`
- **Promoted:** Autocomplete, Pagination, Rating, Skeleton, Alert, ToggleButtonGroup, AvatarGroup
- **Migration Benefit:** Stable APIs, better performance, full TypeScript support

### ⚡ **CSS Layers Support**

**CSS Cascade Layers Integration**

- **DO:** Enable `enableCssLayer: true` in `AppRouterCacheProvider`
- **DON'T:** Skip CSS layer setup when using with Tailwind CSS
- **Migration Benefit:** Solves CSS specificity conflicts with utility frameworks

**Layer Order Control**

```typescript
// Define explicit CSS layer order
<GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
```

### 🔄 **Component API Standardization**

**Slots Pattern Unification**

```typescript
// OLD: Inconsistent component props
<Component components={{ Root: Custom }} />
<OtherComponent TransitionComponent={Custom} />

// NEW: Standardized slots pattern
<Component slots={{ root: Custom }} />
<OtherComponent slots={{ transition: Custom }} />
```

**CSS Class Composition Changes**

```css
/* OLD: Composed classes */
.MuiButton-textPrimary
.MuiChip-outlinedSecondary

/* NEW: Atomic classes */
.MuiButton-text.MuiButton-colorPrimary
.MuiChip-outlined.MuiChip-colorSecondary
```

## Migration Patterns

### Hidden Component Replacement

**Replace with sx prop**

```typescript
// OLD: Hidden component
<Hidden implementation="css" mdDown>
  <Paper>Visible on large screens only</Paper>
</Hidden>

// NEW: sx prop approach
<Paper sx={{ display: { xs: 'none', md: 'block' } }}>
  Visible on large screens only
</Paper>
```

**Replace with useMediaQuery**

```typescript
// OLD: Hidden with JS implementation
<Hidden implementation="js" xlUp>
  <Paper />
</Hidden>

// NEW: useMediaQuery hook
const hidden = useMediaQuery(theme => theme.breakpoints.up('xl'))
return hidden ? null : <Paper />
```

### CSS Layers Setup

**Next.js App Router Integration**

```typescript
// app/layout.tsx
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { ThemeProvider } from '@mui/material/styles'
import GlobalStyles from '@mui/material/GlobalStyles'
import theme from '../theme'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
          <ThemeProvider theme={theme}>
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
```

**Benefits for Tailwind Integration**

- MUI styles in dedicated `@layer mui`
- Tailwind utilities in later `@layer utilities`
- No more `!important` hacks needed
- Predictable CSS specificity

### Component Props Migration

**Standardized Slots API**

```typescript
// Alert component
<Alert
- components={{ CloseButton: CustomButton }}
+ slots={{ closeButton: CustomButton }}
/>

// Modal component
<Modal
- components={{ Root: CustomRoot, Backdrop: CustomBackdrop }}
+ slots={{ root: CustomRoot, backdrop: CustomBackdrop }}
/>

// Slider component
<Slider
- components={{ Track: CustomTrack }}
+ slots={{ track: CustomTrack }}
/>
```

**Grid System Updates**

```typescript
// Import changes
- import Grid, { gridClasses } from '@mui/material/Grid'
+ import Grid, { gridClasses } from '@mui/material/Grid' // Now Grid2 by default

// Legacy Grid usage
- import { Grid } from '@mui/material'
+ import { GridLegacy as Grid } from '@mui/material'
```

## CSS Class Migration

### Automated Codemods

```bash
# Button classes migration
npx @mui/codemod@latest deprecations/button-classes <path>

# Chip classes migration
npx @mui/codemod@latest deprecations/chip-classes <path>

# Alert classes migration
npx @mui/codemod@latest deprecations/alert-classes <path>

# All deprecated API migrations
npx @mui/codemod@latest deprecations/all <path>
```

### Manual Class Updates

**Button Classes**

```css
/* OLD */
.MuiButton-textPrimary {
}
.MuiButton-containedSecondary {
}
.MuiButton-outlinedSizeSmall {
}

/* NEW */
.MuiButton-text.MuiButton-colorPrimary {
}
.MuiButton-contained.MuiButton-colorSecondary {
}
.MuiButton-outlined.MuiButton-sizeSmall {
}
```

**StyleOverrides Updates**

```typescript
// Theme configuration updates
import { buttonClasses } from '@mui/material/Button'

MuiButton: {
  styleOverrides: {
    root: {
      // OLD
-     [`&.${buttonClasses.textPrimary}`]: { color: 'red' },

      // NEW
+     [`&.${buttonClasses.text}.${buttonClasses.colorPrimary}`]: { color: 'red' },
    },
  },
}
```

## Testing Strategy

### Theme Provider Setup

```typescript
// Test utilities with v7 theme
import { render } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'

const mockTheme = createTheme({
  // No more createMuiTheme
  palette: {
    primary: { main: '#1976d2' }
  }
})

function renderWithTheme(component) {
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  )
}
```

### CSS Layers Testing

```typescript
// Verify CSS layers are enabled
test("CSS layers are properly configured", () => {
  const styles = window.getComputedStyle(document.body);
  // Check that MUI styles are in correct layer
  expect(document.querySelector("style")).toHaveTextContent("@layer mui");
});
```

## Migration Checklist

### Phase 1: Dependencies & Setup

- [ ] Update to Material UI v7: `npm install @mui/material@^7.0.0`
- [ ] Remove deprecated packages: `npm uninstall @mui/lab` (for promoted components)
- [ ] Enable CSS layers in app configuration

### Phase 2: Component Updates

- [ ] Replace `Hidden` components with `sx` prop or `useMediaQuery`
- [ ] Update component imports (lab → material for promoted components)
- [ ] Migrate `components` props to `slots` pattern

### Phase 3: Styling Migration

- [ ] Run automated codemods for CSS class updates
- [ ] Update theme configuration for new class structure
- [ ] Test CSS specificity with utility frameworks

### Phase 4: Testing & Validation

- [ ] Update component tests for new APIs
- [ ] Verify CSS layers integration works correctly
- [ ] Test responsive breakpoint behavior

## Breaking Changes Summary

| Component           | Change                   | Migration                          |
| ------------------- | ------------------------ | ---------------------------------- |
| **Hidden**          | Removed                  | Use `sx` prop or `useMediaQuery`   |
| **Grid**            | Grid2 becomes Grid       | Import GridLegacy for old behavior |
| **All Components**  | `components` → `slots`   | Update prop names                  |
| **Button/Chip/etc** | CSS classes atomized     | Use multiple classes               |
| **Theme**           | `createMuiTheme` removed | Use `createTheme`                  |

## Performance Benefits

**Reduced Bundle Size**

- Removed deprecated code paths
- Cleaner component APIs
- Better tree-shaking

**CSS Efficiency**

- CSS layers prevent specificity wars
- No need for `!important` overrides
- Better caching with predictable styles

**Developer Experience**

- Consistent slot pattern across components
- Better TypeScript support
- Automated migration tools

## Next Steps

1. **Plan migration timeline** - v7 has breaking changes
2. **Run codemods first** - automate bulk of CSS class updates
3. **Test CSS layers** - especially important with utility frameworks
4. **Update component usage** - migrate from deprecated patterns
5. **Verify responsive behavior** - after Hidden component replacement

_Full examples and detailed migration guide in [tech-stack-research-catchup.md](../tech-stack-research-catchup.md)_
