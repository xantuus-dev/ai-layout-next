# BuilderSelector Component

A beautiful, interactive horizontal scrollable button matrix for ai.xantuus.com that allows users to select website builder categories.

![BuilderSelector Preview](https://via.placeholder.com/800x400/1a1a1a/ffffff?text=BuilderSelector+Component)

## Features

✅ **Horizontal Scrolling** - Smooth scroll with mouse drag or arrow buttons  
✅ **12+ Categories** - Landing page, Dashboard, Portfolio, Corporate, SaaS, and more  
✅ **Keyboard Navigation** - Use arrow keys to scroll left/right  
✅ **Responsive Design** - Mobile shows 2-3 buttons, desktop shows all  
✅ **Fade Effects** - Beautiful gradient fade on scroll edges  
✅ **Active State** - Blue accent color for selected category  
✅ **Action Buttons** - Add website reference and Import from Figma  
✅ **Accessibility** - ARIA labels and keyboard support  
✅ **TypeScript** - Full type safety  
✅ **Smooth Animations** - Transitions and hover effects

## Installation

The component is already installed in your project at:

```
src/components/ui/BuilderSelector.tsx
```

## Usage

### Basic Usage

```tsx
import BuilderSelector from "@/components/ui/BuilderSelector";

export default function MyPage() {
  return <BuilderSelector />;
}
```

### With Event Handlers

```tsx
import BuilderSelector from "@/components/ui/BuilderSelector";

export default function MyPage() {
  const handleCategorySelect = (categoryId: string) => {
    console.log("Selected category:", categoryId);
    // Your logic here
  };

  const handleAddReference = () => {
    console.log("Add reference clicked");
    // Open modal or navigate
  };

  const handleImportFigma = () => {
    console.log("Import Figma clicked");
    // Handle Figma import
  };

  return (
    <BuilderSelector
      onCategorySelect={handleCategorySelect}
      onAddReference={handleAddReference}
      onImportFigma={handleImportFigma}
    />
  );
}
```

## Props

| Prop               | Type                           | Required | Description                                      |
| ------------------ | ------------------------------ | -------- | ------------------------------------------------ |
| `onCategorySelect` | `(categoryId: string) => void` | No       | Callback when a category is selected             |
| `onAddReference`   | `() => void`                   | No       | Callback when "Add website reference" is clicked |
| `onImportFigma`    | `() => void`                   | No       | Callback when "Import from Figma" is clicked     |

## Categories

The component includes 12 pre-defined categories:

1. **Landing page** - LayoutTemplate icon
2. **Dashboard** - Gauge icon
3. **Portfolio** - Briefcase icon
4. **Corporate** - Building2 icon
5. **SaaS** - Cloud icon
6. **Link in bio** - User icon
7. **Mobile app** - Smartphone icon
8. **E-commerce** - ShoppingCart icon
9. **Education** - GraduationCap icon
10. **Blog** - Newspaper icon
11. **Booking** - Calendar icon
12. **Newsletter** - Mail icon

## Customization

### Adding New Categories

Edit the `categories` array in `BuilderSelector.tsx`:

```tsx
import { YourIcon } from "lucide-react";

const categories: Category[] = [
  // ... existing categories
  { id: "your-category", label: "Your Category", icon: YourIcon },
];
```

### Changing Colors

The component uses the following color scheme:

```tsx
// Background
bg-[#1a1a1a]  // Main container
bg-[#2a2a2a]  // Buttons default
bg-[#353535]  // Buttons hover

// Selected state
bg-blue-600   // Selected button
shadow-blue-600/30  // Selected shadow

// Text
text-white    // Primary text
text-gray-400 // Secondary text
```

To customize, simply replace these Tailwind classes.

### Changing Scroll Amount

Modify the `scrollAmount` in the `scroll` function:

```tsx
const scroll = (direction: "left" | "right") => {
  const scrollAmount = 300; // Change this value
  // ...
};
```

## Keyboard Navigation

- **Arrow Left** - Scroll left
- **Arrow Right** - Scroll right

## Accessibility

The component includes:

- ARIA labels on all interactive elements
- `role="tablist"` on the scrollable container
- `role="tab"` on category buttons
- `aria-selected` for active state
- `aria-label` for screen readers

## Responsive Behavior

### Mobile (< 640px)

- Shows 2-3 category buttons
- Abbreviated action button text
- Smaller padding and spacing

### Tablet (640px - 1024px)

- Shows 4-5 category buttons
- Full action button text
- Medium padding

### Desktop (> 1024px)

- Shows all category buttons (if they fit)
- Full action button text
- Maximum padding

## Styling Details

### Button States

```tsx
// Default
bg-[#2a2a2a] text-white

// Hover
hover:bg-[#353535] hover:brightness-110

// Selected
bg-blue-600 text-white shadow-lg shadow-blue-600/30

// Active (click)
active:scale-95
```

### Scroll Arrows

- Hidden by default
- Appear on container hover
- Smooth fade-in animation
- Only show when scrollable

### Fade Effects

- Left fade: `bg-gradient-to-r from-[#1a1a1a]`
- Right fade: `bg-gradient-to-l from-[#1a1a1a]`
- Width: 12 (48px)

## Demo

Visit `/builder-demo` to see the component in action with:

- Live category selection
- Console logging
- Usage examples
- Feature highlights

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Uses `useRef` for DOM manipulation (no re-renders)
- Smooth scroll with CSS `scroll-behavior: smooth`
- Optimized event listeners with cleanup
- Minimal re-renders with `useState`

## TypeScript

Full TypeScript support with interfaces:

```tsx
interface Category {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface BuilderSelectorProps {
  onCategorySelect?: (categoryId: string) => void;
  onAddReference?: () => void;
  onImportFigma?: () => void;
}
```

## Dependencies

- `react` - Core React library
- `lucide-react` - Icon library
- `tailwindcss` - Styling

All dependencies are already included in your Next.js project.

## Tips

1. **Smooth Scrolling**: The component uses CSS `scroll-behavior: smooth` for smooth scrolling
2. **Keyboard Support**: Users can navigate with arrow keys
3. **Mobile Friendly**: Touch scrolling works naturally on mobile devices
4. **Accessibility**: All buttons have proper ARIA labels
5. **Performance**: Uses refs to avoid unnecessary re-renders

## Troubleshooting

### Scrollbar Visible

If you see a scrollbar, ensure the CSS is applied:

```tsx
style={{
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
}}
```

### Icons Not Showing

Make sure `lucide-react` is installed:

```bash
npm install lucide-react
```

### Arrows Not Appearing

Arrows only appear when:

1. Container is hovered
2. Content is scrollable
3. Not at scroll edge

## Future Enhancements

Potential improvements:

- [ ] Drag-to-scroll functionality
- [ ] Category grouping
- [ ] Search/filter categories
- [ ] Custom category templates
- [ ] Animation on selection
- [ ] Persist selected category in localStorage

## License

This component is part of the ai.xantuus.com project.

---

**Created for**: ai.xantuus.com  
**Component**: BuilderSelector  
**Version**: 1.0.0  
**Last Updated**: February 2026
