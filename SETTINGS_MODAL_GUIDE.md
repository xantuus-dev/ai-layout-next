# Settings Modal - User Guide

## Overview

Your application already has a **fully-functional dark-themed Settings Modal** with sidebar navigation! It was created previously and is ready to use.

## Features

✅ **Dark Theme Design** - Modern #1a1a1a background with #252525 sidebar
✅ **6 Navigation Sections** - Account, Settings, Usage, Personalization, Connectors, Integrations
✅ **Responsive** - Mobile dropdown, desktop sidebar
✅ **Keyboard Shortcuts** - ESC to close
✅ **Click Outside to Close** - Backdrop click support
✅ **Smooth Animations** - Hover states and transitions
✅ **Icons** - Lucide React icons throughout

## File Locations

### Main Modal Component
```
/src/components/SettingsModal.tsx
```

### Section Components
```
/src/components/settings/
├── AccountSection.tsx
├── SettingsSection.tsx
├── UsageSection.tsx
├── PersonalizationSection.tsx
├── ConnectorsSection.tsx
└── IntegrationsSection.tsx
```

## How to Use

### Already Integrated in UserProfileDropdown

The Settings Modal is **already integrated** into your `UserProfileDropdown` component:

```typescript
// src/components/UserProfileDropdown.tsx
import { SettingsModal } from '@/components/SettingsModal';

// Inside component:
const [showSettings, setShowSettings] = useState(false);
const [settingsSection, setSettingsSection] = useState<string>('account');

// Render modal:
<SettingsModal
  open={showSettings}
  onClose={() => setShowSettings(false)}
  initialSection={settingsSection}
/>
```

### Opening the Modal

Click on your profile avatar in the top-right corner, then click any of these menu items:
- **Account Settings** → Opens to Account section
- **Usage & Billing** → Opens to Usage section
- **Personalization** → Opens to Personalization section
- **Connectors** → Opens to Connectors section
- **Integrations** → Opens to Integrations section

### Programmatic Usage

To open the modal from anywhere in your app:

```typescript
import { useState } from 'react';
import { SettingsModal } from '@/components/SettingsModal';

function MyComponent() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <button onClick={() => setShowSettings(true)}>
        Open Settings
      </button>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        initialSection="account" // Optional: 'account' | 'settings' | 'usage' | 'personalization' | 'connectors' | 'integrations'
      />
    </>
  );
}
```

## Section Details

### 1. Account Section
**File**: `src/components/settings/AccountSection.tsx`

Features:
- User profile information (email, name, ID)
- Subscription details with upgrade button
- Security settings (password, 2FA)
- Danger zone (delete account)

### 2. Settings Section
**File**: `src/components/settings/SettingsSection.tsx`

Features:
- Appearance (theme: light/dark/system)
- Notifications (email, push, updates)
- Language & region
- Advanced settings (beta features, analytics)

### 3. Usage Section
**File**: `src/components/settings/UsageSection.tsx`

Features:
- Credits usage with progress bar
- Usage history chart
- Recent activity table
- Export data as CSV

### 4. Personalization Section
**File**: `src/components/settings/PersonalizationSection.tsx`

Features:
- Nickname (50 chars)
- Occupation (100 chars)
- Bio/About (2000 chars)
- Custom AI Instructions (3000 chars)
- Character counters with color coding
- Auto-save functionality

### 5. Connectors Section
**File**: `src/components/settings/ConnectorsSection.tsx`

Features:
- Data source connectors (databases, APIs, cloud storage)
- Connection status indicators
- Add/remove connectors
- Connector configuration

### 6. Integrations Section
**File**: `src/components/settings/IntegrationsSection.tsx`

Features:
- Third-party integrations (Google, Notion, Slack, GitHub)
- OAuth connection flows
- Feature toggles per integration
- Permissions management

## Styling

The modal uses a consistent dark theme:

```css
/* Background Colors */
--modal-bg: #1a1a1a
--sidebar-bg: #252525
--card-bg: #252525
--hover-bg: #2a2a2a

/* Borders */
--border-color: rgba(71, 85, 105, 0.5) /* slate-700/50 */

/* Text */
--text-primary: #ffffff
--text-secondary: #94a3b8 /* slate-400 */
--text-muted: #64748b /* slate-500 */

/* Accents */
--accent-blue: #3b82f6
--accent-green: #10b981
--accent-red: #ef4444
```

## Responsive Behavior

### Desktop (≥768px)
- Full sidebar visible (220px width)
- Content area on the right
- Close button in top-right

### Mobile (<768px)
- Sidebar hidden
- Dropdown menu for section navigation
- Full-width content area

## Keyboard Shortcuts

- **ESC** - Close modal
- **Click outside** - Close modal

## Customization

### Adding a New Section

1. Create new section component:
```typescript
// src/components/settings/MyNewSection.tsx
export function MyNewSection() {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold text-white mb-4">
          My New Feature
        </h3>
        <div className="bg-[#252525] rounded-lg p-6">
          {/* Your content */}
        </div>
      </section>
    </div>
  );
}
```

2. Add to navigation items in SettingsModal.tsx:
```typescript
import { MyIcon } from 'lucide-react';
import { MyNewSection } from './settings/MyNewSection';

const navigationItems: NavItem[] = [
  // ... existing items
  { id: 'mynew', label: 'My Feature', icon: MyIcon },
];
```

3. Add to renderSection() switch:
```typescript
const renderSection = () => {
  switch (activeSection) {
    // ... existing cases
    case 'mynew':
      return <MyNewSection />;
    default:
      return <AccountSection />;
  }
};
```

### Changing Colors

Update the Tailwind classes in the modal:

```typescript
// Sidebar background
<aside className="w-[220px] bg-[#YOUR_COLOR]">

// Main background
<div className="flex-1 bg-[#YOUR_COLOR]">

// Cards
<div className="bg-[#YOUR_COLOR] rounded-lg p-6">
```

## API Integration

### Fetching User Data

Most sections fetch data from API endpoints:

```typescript
// Example from UsageSection
const fetchUsage = async () => {
  const response = await fetch('/api/usage');
  const data = await response.json();
  setUsage(data);
};
```

### Saving Changes

```typescript
// Example from PersonalizationSection
const handleSubmit = async () => {
  const response = await fetch('/api/user/personalization', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
};
```

## Testing

### 1. Visual Testing
- Open the modal from UserProfileDropdown
- Navigate through all 6 sections
- Verify dark theme consistency
- Check responsive behavior on mobile

### 2. Functional Testing
- Save changes in each section
- Verify API calls in Network tab
- Test ESC key and click outside
- Check character counters

### 3. Browser Testing
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### Modal doesn't open
**Check**: UserProfileDropdown state management
```typescript
// Verify these exist in UserProfileDropdown
const [showSettings, setShowSettings] = useState(false);
```

### Sections not loading
**Check**: Import paths in SettingsModal.tsx
```typescript
import { AccountSection } from './settings/AccountSection';
```

### Styling issues
**Check**: Tailwind CSS is compiling
```bash
npm run dev
```

### API errors
**Check**: API routes exist and are authenticated
```typescript
// Each section should have corresponding API routes
/api/user/personalization
/api/usage
/api/integrations/*
```

## Best Practices

1. **Consistent Card Layout**
```typescript
<div className="bg-[#252525] rounded-lg p-6">
  {/* Content */}
</div>
```

2. **Proper Spacing**
```typescript
<div className="space-y-8">
  <section>...</section>
  <section>...</section>
</div>
```

3. **Loading States**
```typescript
if (loading) {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-slate-700 rounded w-3/4"></div>
    </div>
  );
}
```

4. **Error Handling**
```typescript
try {
  await fetch('/api/...');
} catch (error) {
  console.error('Error:', error);
  // Show error message to user
}
```

## Summary

Your Settings Modal is **already built and fully functional**!

✅ Dark-themed UI matching Manus style
✅ 6 comprehensive sections
✅ Responsive design
✅ Keyboard shortcuts
✅ Smooth animations
✅ API integration ready

**No additional work needed** - it's ready to use right now through your UserProfileDropdown component!

## Next Steps

1. Test the modal by clicking your profile avatar
2. Navigate through each section
3. Customize section content as needed
4. Add any additional features specific to your needs

Need help with customization? Refer to the "Customization" section above or ask!
