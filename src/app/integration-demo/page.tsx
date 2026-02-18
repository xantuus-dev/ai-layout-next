import IntegrationPanel from '@/components/ui/IntegrationPanel';

export default function IntegrationDemoPage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Integration Panel Demo</h1>
          <p className="text-muted-foreground">
            A beautiful integration panel with featured cards, tabs, search, and app grid
          </p>
        </div>
        
        <div className="bg-card rounded-lg border border-border shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
          <IntegrationPanel />
        </div>
      </div>
    </div>
  );
}
