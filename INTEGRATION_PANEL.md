# Integration Panel Components

A beautiful, modern integration panel UI built with React and TypeScript, featuring:

- **Featured Card** - Highlighted integration with close button
- **Tab Navigation** - Switch between Apps, Custom API, and Custom MCP
- **Search Functionality** - Filter apps by name or description
- **App Grid** - Responsive 2-column grid of integration cards
- **Hover Effects** - Smooth transitions and interactive states

## Components

### IntegrationPanel

The main component that orchestrates all sub-components.

```tsx
import IntegrationPanel from "@/components/ui/IntegrationPanel";

export default function MyPage() {
  return <IntegrationPanel />;
}
```

### FeaturedCard

A prominent card that appears at the top with a close button.

```tsx
<FeaturedCard
  icon="https://example.com/icon.png"
  title="My Browser"
  description="Let Manus access your personalized context..."
  onConnect={() => console.log("Connect clicked")}
  onClose={() => setShowFeatured(false)}
/>
```

### Tabs

Tab navigation component with active state indicator.

```tsx
<Tabs
  tabs={["Apps", "Custom API", "Custom MCP"]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

### SearchInput

Search input with clear button that appears on hover/focus.

```tsx
<SearchInput
  value={searchQuery}
  onChange={setSearchQuery}
  onClear={() => setSearchQuery("")}
/>
```

### AppCard

Individual app card with icon, title, and description.

```tsx
<AppCard
  icon="https://example.com/icon.png"
  title="Gmail"
  description="Draft replies, search your inbox..."
  onClick={() => console.log("Gmail clicked")}
/>
```

## CSS Variables

The components use CSS custom properties for theming. These are defined in `globals.css`:

### Dark Mode Variables

- `--border-btn-main` - Button borders
- `--border-main` - Main borders
- `--background-menu-white` - Card backgrounds
- `--text-primary` - Primary text color
- `--text-tertiary` - Tertiary text color
- `--icon-secondary` - Secondary icon color
- And more...

### Light Mode Variables

All variables have light mode equivalents defined in the `.light` class.

## Demo

Visit `/integration-demo` to see the component in action.

## Customization

### Adding New Apps

Edit the `apps` array in `IntegrationPanel.tsx`:

```tsx
const apps: App[] = [
  {
    id: "my-app",
    icon: "https://example.com/icon.png",
    title: "My App",
    description: "Description of my app",
  },
  // ... more apps
];
```

### Changing Tab Content

Currently, all tabs show the same app grid. To customize per tab:

```tsx
const getAppsForTab = (tab: string) => {
  switch (tab) {
    case "Apps":
      return standardApps;
    case "Custom API":
      return customApiApps;
    case "Custom MCP":
      return mcpApps;
    default:
      return [];
  }
};
```

### Styling

The component uses Tailwind CSS with custom CSS variables. To customize:

1. Modify CSS variables in `globals.css`
2. Update Tailwind classes in component files
3. Add custom styles as needed

## Features

- ✅ Responsive design (mobile-friendly)
- ✅ Dark/Light mode support
- ✅ Search filtering
- ✅ Smooth animations
- ✅ Accessible (ARIA labels)
- ✅ TypeScript types
- ✅ Custom scrollbar styling

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Notes

The lint warnings for `@tailwind`, `@apply`, and `@theme` are expected and can be ignored. These are Tailwind CSS directives that are processed during build time.
