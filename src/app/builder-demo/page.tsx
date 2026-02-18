import BuilderSelector from '@/components/ui/BuilderSelector';

export default function BuilderDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            AI Website Builder
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Choose a template category to get started with AI-powered website generation
          </p>
        </div>

        {/* Builder Selector Component */}
        <BuilderSelector
          onCategorySelect={(categoryId) => {
            console.log('Category selected:', categoryId);
            // Handle category selection
          }}
          onAddReference={() => {
            console.log('Add reference clicked');
            // Handle add reference
          }}
          onImportFigma={() => {
            console.log('Import Figma clicked');
            // Handle Figma import
          }}
        />

        {/* Additional Info */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 sm:p-8 mt-8">
          <h3 className="text-xl font-bold text-white mb-4">Features</h3>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              <span>Horizontal scrollable category buttons with smooth animations</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              <span>Keyboard navigation support (use arrow keys to scroll)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              <span>Responsive design - works on mobile and desktop</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              <span>Fade effects on scroll edges for better UX</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              <span>Active state with blue accent color</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              <span>ARIA labels for accessibility</span>
            </li>
          </ul>
        </div>

        {/* Usage Example */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 sm:p-8">
          <h3 className="text-xl font-bold text-white mb-4">Usage Example</h3>
          <pre className="bg-[#0d0d0d] p-4 rounded-lg overflow-x-auto text-sm text-gray-300">
{`import BuilderSelector from '@/components/ui/BuilderSelector';

export default function MyPage() {
  return (
    <BuilderSelector
      onCategorySelect={(categoryId) => {
        console.log('Selected:', categoryId);
      }}
      onAddReference={() => {
        // Handle add reference
      }}
      onImportFigma={() => {
        // Handle Figma import
      }}
    />
  );
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
