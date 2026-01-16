# Puck Visual Editor Integration

## Overview

PinPoint includes [Puck](https://puckeditor.com/), an open-source visual editor for React and Next.js, integrated into the developer mode for UX prototyping.

## Accessing Puck

Puck is available at two routes:

- **Editor**: `/debug/puck` - The visual editor interface with drag-and-drop components
- **Preview**: `/debug/puck/preview` - View your prototype without the editor UI

## Available Components

The following components are available in the Puck editor:

### HeadingBlock
- **Fields**: 
  - `level`: H1, H2, H3, H4, H5, H6
  - `children`: Heading text
- **Usage**: Add headings of different sizes

### TextBlock
- **Fields**:
  - `text`: Multi-line text content
- **Usage**: Add paragraph text

### ButtonBlock
- **Fields**:
  - `label`: Button text
  - `variant`: default, destructive, outline, secondary, ghost
  - `href`: Link URL
- **Usage**: Add styled buttons with links

### CardBlock
- **Fields**:
  - `title`: Card title
  - `description`: Card description
- **Usage**: Add card components with title and description

### SpacerBlock
- **Fields**:
  - `size`: small, medium, large
- **Usage**: Add vertical spacing between components

## How to Use

1. **Navigate to the Editor**: Open `/debug/puck` in your browser
2. **Add Components**: Click the "+" button or drag components from the left sidebar
3. **Configure**: Click on any component to edit its properties in the right sidebar
4. **Arrange**: Drag components to reorder them
5. **Publish**: Click "Publish" to save your prototype
6. **Preview**: View your prototype at `/debug/puck/preview`

## Data Persistence

Prototypes are saved to browser `localStorage` under the key `puck-prototype-data`. This means:
- Data persists across browser sessions
- Data is local to your browser (not shared across devices)
- Clearing browser data will delete prototypes

## Use Cases

- **UX Exploration**: Quickly test different layouts and component arrangements
- **Client Demos**: Create mockups to show stakeholders
- **Design Iteration**: Rapidly prototype UI changes before implementing them
- **Component Testing**: Visualize how shadcn/ui components look together

## Adding New Components

To add new components to the Puck configuration:

1. Open `src/lib/puck/config.tsx`
2. Add a new component definition to the `components` object:

```tsx
YourComponent: {
  fields: {
    yourField: {
      type: "text", // or "textarea", "select", etc.
    },
  },
  defaultProps: {
    yourField: "Default Value",
  },
  render: (props) => {
    return <div>{props["yourField"]}</div>;
  },
},
```

3. Follow the existing component patterns for styling with Tailwind CSS

## Notes

- Puck is a development-only feature and should not be used in production
- The configuration uses shadcn/ui-compatible styling
- Components render using the same Tailwind classes as the rest of the application
- This is perfect for prototyping but not for production content management

## Resources

- [Puck Documentation](https://puckeditor.com/docs)
- [Puck GitHub](https://github.com/puckeditor/puck)
- [shadcn/ui Components](https://ui.shadcn.com/)
