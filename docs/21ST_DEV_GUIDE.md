# Adding 21st.dev Components to Your Project

## Overview

21st.dev is a free, open-source component registry built on shadcn/ui. Your project is **already compatible** with all 21st.dev components because you have:

- ✅ React 18+
- ✅ Tailwind CSS
- ✅ Radix UI primitives
- ✅ shadcn/ui components

## Quick Start

### 1. Browse Components

Visit these websites to find components:
- **Primary**: https://21st.dev
- **Alternative**: https://allshadcn.com/components/21stdev/
- **Shadcn Template**: https://www.shadcn.io/template/serafimcloud-21st

### 2. Copy and Paste

21st.dev components are copy-paste ready:

```bash
# Example: Adding a Hero Section
1. Visit https://21st.dev
2. Search for "hero section"
3. Click "View Code" or "Copy"
4. Create file: src/components/ui/hero-section.tsx
5. Paste the code
6. Install any peer dependencies if needed
```

### 3. Install Dependencies (If Needed)

Most components work out of the box, but some may need additional Radix UI primitives:

```bash
# Example: If a component needs Popover
npm install @radix-ui/react-popover

# Check the component page for exact dependencies
```

## Example: Adding a Pricing Card Component

### Step 1: Find the Component

Visit https://21st.dev and search for "pricing card" or "pricing section"

### Step 2: Create the Component File

```bash
touch src/components/ui/pricing-card-21st.tsx
```

### Step 3: Paste the Component Code

The component code from 21st.dev will look something like:

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"

export function PricingCard({ title, price, features, popular = false }) {
  return (
    <Card className={popular ? "border-primary shadow-lg" : ""}>
      {popular && (
        <div className="bg-primary text-primary-foreground text-sm font-medium py-1 text-center">
          Most Popular
        </div>
      )}
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          <span className="text-3xl font-bold">${price}</span>/month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Get Started</Button>
      </CardFooter>
    </Card>
  )
}
```

### Step 4: Use the Component

```tsx
import { PricingCard } from "@/components/ui/pricing-card-21st"

export default function MyPage() {
  return (
    <div className="grid md:grid-cols-3 gap-8">
      <PricingCard
        title="Free"
        price="0"
        features={["Feature 1", "Feature 2"]}
      />
      <PricingCard
        title="Pro"
        price="29"
        features={["Feature 1", "Feature 2", "Feature 3"]}
        popular
      />
      <PricingCard
        title="Enterprise"
        price="199"
        features={["All features", "Priority support"]}
      />
    </div>
  )
}
```

## Helper Script

Use the included helper script:

```bash
# Open 21st.dev and get instructions
./scripts/add-21st-component.sh hero

# Examples
./scripts/add-21st-component.sh navbar
./scripts/add-21st-component.sh footer
./scripts/add-21st-component.sh testimonials
./scripts/add-21st-component.sh cta
```

## Popular Component Categories

### Layout Components
- Hero sections
- Navigation bars
- Footers
- Grid layouts
- Bento grids

### Marketing Components
- Pricing tables
- Feature sections
- Testimonials
- Call-to-action (CTA) sections
- FAQ sections

### Interactive Components
- Animated cards
- Hover effects
- Scroll animations
- Interactive demos
- Charts and graphs

### Form Components
- Contact forms
- Newsletter signups
- Multi-step forms
- Search bars
- Filters

## Customization

All 21st.dev components use your existing Tailwind CSS classes and can be customized:

```tsx
// Example: Customize colors
<PricingCard
  className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900"
  title="Custom"
  price="49"
/>
```

## Common Dependencies

Most 21st.dev components work with what you already have, but here are common extras:

```bash
# Animation libraries
npm install framer-motion

# Icons (you already have lucide-react)
npm install lucide-react

# Additional Radix UI primitives
npm install @radix-ui/react-accordion
npm install @radix-ui/react-alert-dialog
npm install @radix-ui/react-aspect-ratio
npm install @radix-ui/react-checkbox
npm install @radix-ui/react-collapsible
npm install @radix-ui/react-context-menu
npm install @radix-ui/react-hover-card
npm install @radix-ui/react-menubar
npm install @radix-ui/react-navigation-menu
npm install @radix-ui/react-popover
npm install @radix-ui/react-radio-group
npm install @radix-ui/react-scroll-area
npm install @radix-ui/react-slider
npm install @radix-ui/react-toast
npm install @radix-ui/react-toggle
npm install @radix-ui/react-toggle-group
npm install @radix-ui/react-tooltip
```

## Troubleshooting

### Issue: Component not found

**Solution**: Make sure the component imports match your file structure:

```tsx
// Change absolute imports to match your setup
import { Button } from "@/components/ui/button"  // ✅ Good
import { Button } from "~/components/ui/button"  // ❌ Wrong path alias
```

### Issue: Styles not applying

**Solution**: Ensure Tailwind CSS content paths include the component:

```js
// tailwind.config.js
content: [
  './src/components/**/*.{js,ts,jsx,tsx}',  // ✅ This should already be there
],
```

### Issue: Dark mode not working

**Solution**: Your project uses `darkMode: ['class']`, which is correct for 21st.dev components.

## Best Practices

1. **Keep components in `src/components/ui/`** for consistency
2. **Name files with kebab-case**: `pricing-card.tsx`, not `PricingCard.tsx`
3. **Test responsive behavior** - most 21st.dev components are mobile-first
4. **Check accessibility** - components should work with keyboard navigation
5. **Customize for your brand** - adjust colors, spacing, and animations

## Resources

- 21st.dev: https://21st.dev
- All Shadcn Components: https://allshadcn.com/components/21stdev/
- Shadcn UI Docs: https://ui.shadcn.com
- Radix UI Docs: https://www.radix-ui.com

## License

All 21st.dev components are **MIT licensed** and free for personal and commercial use.
