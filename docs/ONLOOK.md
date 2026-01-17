# Onlook Visual Editor Integration

PinPoint integrates [Onlook](https://github.com/onlook-dev/onlook), an open-source visual editor for Next.js and TailwindCSS projects. Onlook enables real-time UX prototyping and visual editing directly in the browser while maintaining full code synchronization.

## What is Onlook?

Onlook is a visual-first code editor that bridges the gap between design and development. Think of it as "Figma for code" or a more designer-friendly alternative to traditional code editors.

### Key Features

- **Visual Editing**: Edit React components directly in the browser with a Figma-like interface
- **Drag & Drop**: Rearrange elements within their parent containers
- **Style Manipulation**: Adjust Tailwind CSS classes visually in real-time
- **Code Sync**: All changes are written directly to your source files
- **AI Assistance**: Get AI-powered suggestions for design improvements
- **Component Detection**: Automatically detects and highlights React components
- **Layer Management**: Browse and navigate your component tree
- **Live Preview**: See changes instantly as you edit

## How It Works in PinPoint

When enabled in development mode, Onlook adds special `data-onlook-id` attributes to DOM elements. These IDs create a mapping between visual elements and their source code locations, enabling bidirectional editing.

### Architecture

1. The `@onlook/nextjs` SWC plugin instruments your code during compilation
2. Each DOM element gets a unique ID that maps to its source location
3. The Onlook editor (desktop or web) connects to your running dev server
4. Visual edits in Onlook update your actual TypeScript/TSX files
5. Next.js hot-reloads the changes automatically

## Getting Started

### 1. Enable Onlook

Add the following to your `.env.local` file:

```bash
NEXT_PUBLIC_ONLOOK_ENABLED=true
```

### 2. Start Development Server

```bash
pnpm run dev
```

Your app will now be instrumented with Onlook data attributes.

### 3. Connect with Onlook

You have two options:

#### Option A: Onlook Desktop App (Recommended)

1. Download from [https://onlook.com](https://onlook.com)
2. Install and open the Onlook desktop app
3. Import your PinPoint project or connect to `http://localhost:3000` (or your PORT)
4. Start editing visually!

#### Option B: Onlook Web Interface

1. Visit [https://onlook.com](https://onlook.com)
2. Import your GitHub repository or connect to your local dev server
3. Use the web-based editor

## Usage Tips

### Best Practices

- **Commit Regularly**: Onlook writes to your source files, so commit your work before major visual experiments
- **Use with Branching**: Create a feature branch for visual design work
- **Review Changes**: Always review Onlook's code changes before committing
- **TailwindCSS**: Onlook works best with Tailwind utility classes (which PinPoint uses)
- **Component Boundaries**: Onlook respects component boundaries and parent-child relationships

### Common Workflows

**Quick Style Tweaks**

1. Enable Onlook
2. Run dev server
3. Open Onlook and connect
4. Select element
5. Adjust spacing, colors, typography visually
6. Changes are saved to your TSX files

**Layout Experimentation**

1. Enable Onlook
2. Create a git branch for experimentation
3. Use drag-and-drop to rearrange elements
4. Try different layouts visually
5. Review code changes
6. Commit what works, discard what doesn't

**Component Styling**

1. Navigate to a component in Onlook
2. Edit Tailwind classes visually
3. See real-time preview
4. Onlook updates the className attributes in your code

## Configuration

### Environment Variables

- `NEXT_PUBLIC_ONLOOK_ENABLED`: Set to `"true"` to enable Onlook

### Next.js Configuration

The `@onlook/nextjs` plugin is configured in `next.config.ts`:

```typescript
// Only enabled when NODE_ENV === "development"
experimental: {
  swcPlugins: [["@onlook/nextjs", { root: path.resolve(".") }]],
}
```

### Provider Component

The `OnlookProvider` component (in `src/components/dev/onlook-provider.tsx`) wraps the app and enables Onlook features when appropriate.

## Troubleshooting

### Onlook Not Detecting My App

- Verify `NEXT_PUBLIC_ONLOOK_ENABLED=true` is in your `.env.local`
- Restart your dev server after changing environment variables
- Check browser console for Onlook log messages
- Ensure you're running in development mode (`NODE_ENV=development`)

### Changes Not Saving

- Check file permissions on your source files
- Ensure your files aren't read-only
- Verify Onlook has access to your project directory

### Performance Issues

- Onlook adds minimal overhead, but very large pages may see slight slowdown
- Consider disabling Onlook when not actively designing
- Production builds completely exclude Onlook code

### Build Errors

- Onlook should only be active in development
- If you see build errors, ensure `NODE_ENV` is properly set
- The plugin conditionally loads only in development

## Disabling Onlook

To disable Onlook:

1. Set `NEXT_PUBLIC_ONLOOK_ENABLED=false` in `.env.local` (or remove the variable)
2. Restart your dev server

Or simply stop running the dev server with Onlook enabled.

## Production Builds

Onlook is **automatically disabled** in production builds:

- The SWC plugin only loads when `NODE_ENV === "development"`
- No `data-onlook-id` attributes are added to production markup
- No runtime overhead in production
- The `OnlookProvider` component becomes a pass-through wrapper

## Security Notes

- Onlook is development-only and poses no security risk in production
- Never enable Onlook on public staging or production environments
- The `NEXT_PUBLIC_ONLOOK_ENABLED` variable is public, but it only affects dev mode
- Onlook requires local file system access to save changes

## Additional Resources

- [Onlook GitHub Repository](https://github.com/onlook-dev/onlook)
- [Onlook Official Website](https://onlook.com)
- [Onlook Documentation](https://docs.onlook.com)
- [Onlook Discord Community](https://discord.gg/onlook)

## Feedback and Issues

If you encounter issues with the Onlook integration:

1. Check this documentation first
2. Verify your environment variables and configuration
3. Check the [Onlook GitHub Issues](https://github.com/onlook-dev/onlook/issues)
4. Discuss with the team in your development channels

For PinPoint-specific Onlook configuration questions, see `docs/DEVELOPMENT.md` or reach out to the team.
