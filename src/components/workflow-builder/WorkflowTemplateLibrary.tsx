/**
 * Workflow Template Library Component
 *
 * Displays pre-built workflow templates that users can configure and load
 * into the canvas with a single click.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  Clock,
  Sparkles,
  X,
  Loader2,
} from 'lucide-react';
import { getWorkflowTemplates, getTemplateById, convertPriceMonitorToVisualNodes } from '@/lib/workflow-builder/agent-plan-to-visual-converter';
import { useWorkflowBuilderStore } from '@/stores/workflow-builder-store';

interface WorkflowTemplateLibraryProps {
  open: boolean;
  onClose: () => void;
}

export function WorkflowTemplateLibrary({
  open,
  onClose,
}: WorkflowTemplateLibraryProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState(false);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const templates = getWorkflowTemplates();
  const selectedTemplate = selectedTemplateId ? getTemplateById(selectedTemplateId) : null;

  const { setNodes, setWorkflowName, setWorkflowDescription } = useWorkflowBuilderStore();

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setConfiguring(true);
    setConfig({});
    setErrors({});
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const validateConfig = (): boolean => {
    if (!selectedTemplate) return false;

    const newErrors: Record<string, string> = {};

    selectedTemplate.configurable.forEach((field: any) => {
      if (field.required && !config[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }

      // Type-specific validation
      if (config[field.key]) {
        if (field.type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(config[field.key])) {
            newErrors[field.key] = 'Invalid email format';
          }
        }
        if (field.type === 'text' && field.key.includes('Url')) {
          try {
            new URL(config[field.key]);
          } catch {
            newErrors[field.key] = 'Invalid URL format';
          }
        }
        if (field.type === 'number') {
          const num = parseFloat(config[field.key]);
          if (isNaN(num) || num <= 0) {
            newErrors[field.key] = 'Must be a positive number';
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUseTemplate = () => {
    if (!selectedTemplate || !validateConfig()) {
      return;
    }

    // Convert template to canvas nodes based on template type
    let nodes: any[];
    if (selectedTemplate.id === 'price-monitor-template') {
      nodes = convertPriceMonitorToVisualNodes({
        competitorUrl: config.competitorUrl,
        priceSelector: config.priceSelector,
        thresholdPrice: parseFloat(config.thresholdPrice),
        alertEmail: config.alertEmail,
      });
    } else {
      // Handle other template types in the future
      nodes = [];
    }

    // Update workflow builder store
    setNodes(nodes);
    setWorkflowName(selectedTemplate.name);
    setWorkflowDescription(selectedTemplate.description);

    // Close dialogs
    setConfiguring(false);
    setSelectedTemplateId(null);
    onClose();
  };

  const handleCloseConfig = () => {
    setConfiguring(false);
    setSelectedTemplateId(null);
    setConfig({});
    setErrors({});
  };

  return (
    <>
      {/* Template Library Dialog */}
      <Dialog open={open && !configuring} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Workflow Templates
            </DialogTitle>
            <DialogDescription>
              Start with a pre-built workflow and customize it to your needs
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleTemplateSelect(template.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        {template.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      <span>{template.estimatedCredits} credits</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>~{Math.round(template.estimatedDuration / 1000)}s</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Badge
                    variant={
                      template.difficulty === 'beginner'
                        ? 'default'
                        : template.difficulty === 'intermediate'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {template.difficulty}
                  </Badge>
                </CardFooter>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Configuration Dialog */}
      <Dialog open={configuring} onOpenChange={(open) => !open && handleCloseConfig()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Configure: {selectedTemplate?.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseConfig}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              Fill in the configuration to customize this workflow
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4 py-4">
              {selectedTemplate.configurable.map((field: any) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Input
                    id={field.key}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={config[field.key] || ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value)}
                    className={errors[field.key] ? 'border-destructive' : ''}
                  />
                  {field.description && (
                    <p className="text-xs text-muted-foreground">
                      {field.description}
                    </p>
                  )}
                  {errors[field.key] && (
                    <p className="text-xs text-destructive">
                      {errors[field.key]}
                    </p>
                  )}
                </div>
              ))}

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">What this workflow will do:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Navigate to the competitor's product page</li>
                  <li>Wait for the price element to load</li>
                  <li>Extract the current price from the page</li>
                </ol>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    <span>~{selectedTemplate.estimatedCredits} credits per run</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>~{Math.round(selectedTemplate.estimatedDuration / 1000)} seconds</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseConfig}>
              Cancel
            </Button>
            <Button onClick={handleUseTemplate}>
              Use Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
