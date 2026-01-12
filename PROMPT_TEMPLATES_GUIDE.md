# Prompt Templates System Guide

## Overview

The Xantuus AI platform now includes a powerful prompt template system that allows admins to create reusable prompt templates with variables. Users can browse the template gallery, fill in variables, and generate customized prompts.

## Features

✅ **Template Gallery** - Browse templates by category
✅ **Variable System** - Support for text, number, textarea, and select inputs
✅ **Admin Dashboard** - Create, edit, and manage templates
✅ **Usage Tracking** - Track how many times each template is used
✅ **Categories & Tags** - Organize templates for easy discovery
✅ **Featured Templates** - Highlight popular or important templates

## Database Schema

### PromptTemplateCategory
- Categories to organize templates (e.g., "File Management", "Content Creation")
- Each category has a name, description, icon, and order

### PromptTemplate
- Individual prompt templates with:
  - Title, description, and template content
  - Category association
  - Tags for filtering
  - Variables configuration (JSON)
  - Visibility settings (public/private, active/inactive, featured)
  - Usage analytics

## Template Variable Format

Variables in templates use double curly braces: `{{variable_name}}`

### Variable Configuration

Each variable is defined as a JSON object:

```json
{
  "name": "filename_structure",
  "label": "Filename Structure",
  "type": "text",
  "placeholder": "e.g., project_{{number}}_final",
  "required": true
}
```

### Supported Variable Types

1. **text** - Single line text input
2. **textarea** - Multi-line text input
3. **number** - Numeric input
4. **select** - Dropdown with predefined options

### Example Template

```
Rename all files in the specified folder based on the following naming convention: {{filename_structure}}. If the convention includes a sequence, please start numbering from {{starting_number}}. This will help with file organization.
```

Variables:
- `filename_structure` (text) - The naming pattern
- `starting_number` (number) - Starting sequence number

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```bash
# Admin email for template management
ADMIN_EMAIL=your-admin@email.com
```

### 2. Run Database Migration

The schema has already been pushed to your database. If you need to reset:

```bash
npx prisma db push
```

### 3. Seed Sample Templates (Optional)

To add example templates:

```bash
npx ts-node prisma/seed-templates.ts
```

This creates:
- 3 categories (File Management, Content Creation, Code Assistant)
- 4 sample templates including your file renaming example

## Using the System

### For Admins

#### Access Admin Dashboard
Visit: `http://localhost:3010/admin/templates`

#### Create a New Template

1. Click "New Template"
2. Fill in basic information:
   - Title
   - Description
   - Category
   - Tags

3. Configure variables:
   - Variable name (used in template as `{{variable_name}}`)
   - Display label (shown to users)
   - Input type (text, number, textarea, select)
   - Placeholder text
   - Required/optional flag

4. Write template content:
   - Use `{{variable_name}}` placeholders
   - Click "Insert" next to variables to add them
   - Preview updates in real-time

5. Set visibility:
   - Public/Private
   - Active/Inactive
   - Featured (shows at top of gallery)

6. Click "Create Template"

#### Managing Templates

From `/admin/templates`:
- View all templates (including inactive)
- Edit templates
- Delete templates
- See usage statistics

### For Users

#### Browse Template Gallery
Visit: `http://localhost:3010/templates`

Features:
- Search templates
- Filter by category
- Featured templates shown first
- See usage count and variable count

#### Use a Template

1. Click on any template card
2. Fill in the variable fields
3. Preview the generated prompt (updates in real-time)
4. Click "Copy" to copy to clipboard
5. Click "Use Template" to copy and increment usage count

## API Endpoints

### Public Endpoints

```bash
# List all public templates
GET /api/templates
GET /api/templates?categoryId=xxx
GET /api/templates?search=keyword
GET /api/templates?featured=true

# Get single template
GET /api/templates/[id]

# Increment usage count
POST /api/templates/[id]

# List categories
GET /api/templates/categories
```

### Admin Endpoints (Requires Authentication)

```bash
# List all templates (including inactive)
GET /api/admin/templates

# Create template
POST /api/admin/templates
Body: { title, description, template, categoryId, tags, variables, isPublic, isActive, isFeatured }

# Update template
PUT /api/admin/templates/[id]
Body: { title, description, template, categoryId, tags, variables, isPublic, isActive, isFeatured }

# Delete template
DELETE /api/admin/templates/[id]

# Create category
POST /api/admin/templates/categories
Body: { name, description, icon, order }
```

## Variable Replacement Logic

When a user fills in variables, the system:

1. Takes the template content
2. Finds all `{{variable_name}}` placeholders
3. Replaces them with user-provided values
4. Shows unfilled variables as `[variable_name]` in preview
5. Generates final prompt when all required fields are filled

Example:

Template:
```
Rename files using {{filename_structure}} starting from {{starting_number}}
```

User fills in:
- `filename_structure`: "project_{{n}}_final"
- `starting_number`: "1"

Result:
```
Rename files using project_{{n}}_final starting from 1
```

## Best Practices

### For Creating Templates

1. **Clear Variable Names** - Use descriptive names like `filename_structure` not `var1`
2. **Helpful Placeholders** - Provide example values in placeholders
3. **Logical Grouping** - Use categories to organize related templates
4. **Descriptive Labels** - User-facing labels should be clear and concise
5. **Required vs Optional** - Mark variables required only when necessary
6. **Testing** - Test your template with various inputs before making it public

### For Variable Design

1. **Text** - For short, single-line inputs (names, IDs, simple values)
2. **Textarea** - For longer content (code snippets, descriptions)
3. **Number** - For numeric values (counts, dates, sequences)
4. **Select** - For predefined choices (reduces errors, faster input)

## Storage and Upgrades

### Database Storage
- Templates stored in PostgreSQL via Prisma
- JSON field for variable configuration (flexible structure)
- Easy to query, filter, and update

### Easy Upgrades

To add new features to templates:

1. **New Variable Types** - Add to the type enum and create corresponding input component
2. **New Fields** - Add columns to Prisma schema and migrate
3. **Bulk Updates** - Use Prisma queries to update multiple templates
4. **Import/Export** - Templates can be exported as JSON and imported to other instances

### Example: Adding a New Field

```prisma
// Add to schema
model PromptTemplate {
  // ... existing fields
  difficulty String @default("beginner") // new field
}
```

```bash
# Push to database
npx prisma db push
```

## Troubleshooting

### Templates Not Showing in Gallery

1. Check `isPublic` is true
2. Check `isActive` is true
3. Verify database connection
4. Check browser console for errors

### Admin Access Denied

1. Verify `ADMIN_EMAIL` in `.env` matches your account email
2. Restart Next.js server after changing `.env`
3. Check session is authenticated

### Variable Not Replacing

1. Verify variable name matches exactly (case-sensitive)
2. Check for double curly braces: `{{name}}` not `{name}`
3. Ensure variable is defined in variables array

## Future Enhancements

Potential additions:
- Template versioning
- Template sharing/import
- Advanced variable validation
- Conditional variables (show/hide based on other values)
- Template categories with permissions
- Multi-language support
- Template analytics dashboard
- Public template marketplace

## Support

For issues or questions about the template system, contact the development team or check the project documentation.
