#!/bin/bash

# Helper script to add 21st.dev components to your project
# Usage: ./scripts/add-21st-component.sh [component-name]

set -e

echo "🎨 21st.dev Component Helper"
echo ""

if [ -z "$1" ]; then
  echo "Usage: ./scripts/add-21st-component.sh [component-name]"
  echo ""
  echo "Examples:"
  echo "  ./scripts/add-21st-component.sh hero"
  echo "  ./scripts/add-21st-component.sh pricing-table"
  echo "  ./scripts/add-21st-component.sh testimonials"
  echo ""
  echo "📦 Browse components at: https://21st.dev"
  echo "📦 Or check: https://allshadcn.com/components/21stdev/"
  exit 1
fi

COMPONENT_NAME=$1

echo "📦 Opening 21st.dev in browser..."
echo "   Search for: $COMPONENT_NAME"
echo ""

# Open the 21st.dev website
open "https://21st.dev" || xdg-open "https://21st.dev" 2>/dev/null || echo "Please visit: https://21st.dev"

echo ""
echo "📝 Steps to add the component:"
echo ""
echo "1. Search for '$COMPONENT_NAME' on 21st.dev"
echo "2. Click 'View Code' or 'Copy'"
echo "3. Create a new file: src/components/ui/$COMPONENT_NAME.tsx"
echo "4. Paste the code into the file"
echo "5. Install any required dependencies (shown on the component page)"
echo ""
echo "💡 Your project already has:"
echo "   ✅ React 18"
echo "   ✅ Tailwind CSS"
echo "   ✅ Radix UI primitives"
echo "   ✅ shadcn/ui components"
echo ""
echo "   You're ready to use any 21st.dev component!"
