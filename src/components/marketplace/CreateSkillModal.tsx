'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';

interface CreateSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: 'productivity', label: 'Productivity', icon: '⚡' },
  { value: 'data', label: 'Data & Analytics', icon: '📊' },
  { value: 'communication', label: 'Communication', icon: '💬' },
  { value: 'integration', label: 'Integrations', icon: '🔗' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎮' },
];

const PRICING_MODELS = [
  { value: 'free', label: 'Free' },
  { value: 'one-time', label: 'One-time Purchase' },
  { value: 'subscription', label: 'Subscription' },
];

const SKILL_TYPES = [
  { value: 'config', label: 'Config-based (Workflow)', description: 'Pre-defined workflow using existing tools' },
  { value: 'javascript', label: 'JavaScript', description: 'Custom JavaScript code' },
];

export default function CreateSkillModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSkillModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'productivity',
    icon: '🔧',
    pricingModel: 'free',
    price: 0,
    skillType: 'config',
    tags: [] as string[],
    requiredTools: [] as string[],
    requiredIntegrations: [] as string[],
    estimatedCreditCost: 10,
  });

  const [tagInput, setTagInput] = useState('');
  const [toolInput, setToolInput] = useState('');
  const [integrationInput, setIntegrationInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build skill definition based on type
      const skillDefinition = formData.skillType === 'config'
        ? {
            steps: [
              {
                action: 'example.action',
                description: 'Example step - configure in advanced settings',
                tool: 'http',
                params: {},
                estimatedCredits: 10,
                estimatedDuration: 5000,
              },
            ],
          }
        : {
            code: `// Your JavaScript code here
// Available: input, tools
return {
  success: true,
  message: 'Skill executed successfully',
};`,
          };

      const payload = {
        ...formData,
        price: formData.pricingModel === 'free' ? 0 : formData.price * 100, // Convert to cents
        skillDefinition,
        parameters: [],
      };

      const response = await fetch('/api/marketplace/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create skill');
      }

      alert('Skill created successfully! (Status: draft - will need approval)');
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error creating skill:', error);
      alert((error as Error).message || 'Failed to create skill');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      category: 'productivity',
      icon: '🔧',
      pricingModel: 'free',
      price: 0,
      skillType: 'config',
      tags: [],
      requiredTools: [],
      requiredIntegrations: [],
      estimatedCreditCost: 10,
    });
    setTagInput('');
    setToolInput('');
    setIntegrationInput('');
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const addTool = () => {
    if (toolInput.trim() && !formData.requiredTools.includes(toolInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        requiredTools: [...prev.requiredTools, toolInput.trim()],
      }));
      setToolInput('');
    }
  };

  const removeTool = (tool: string) => {
    setFormData((prev) => ({
      ...prev,
      requiredTools: prev.requiredTools.filter((t) => t !== tool),
    }));
  };

  const addIntegration = () => {
    if (integrationInput.trim() && !formData.requiredIntegrations.includes(integrationInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        requiredIntegrations: [...prev.requiredIntegrations, integrationInput.trim()],
      }));
      setIntegrationInput('');
    }
  };

  const removeIntegration = (integration: string) => {
    setFormData((prev) => ({
      ...prev,
      requiredIntegrations: prev.requiredIntegrations.filter((i) => i !== integration),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Create New Skill
            </h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Basic Information
            </h3>

            <div>
              <Label htmlFor="name">Skill Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Email Campaign Automator"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Automatically send personalized email campaigns..."
                required
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="icon">Icon (Emoji)</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, icon: e.target.value }))
                  }
                  placeholder="🔧"
                  maxLength={2}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Skill Type */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Skill Type
            </h3>

            <div>
              <Label htmlFor="skillType">Type *</Label>
              <Select
                value={formData.skillType}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, skillType: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-gray-500">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pricing
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pricingModel">Pricing Model *</Label>
                <Select
                  value={formData.pricingModel}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, pricingModel: value }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.pricingModel !== 'free' && (
                <div>
                  <Label htmlFor="price">
                    Price (${formData.pricingModel === 'subscription' ? '/month' : ''})
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        price: parseFloat(e.target.value) || 0,
                      }))
                    }
                    placeholder="9.99"
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="estimatedCreditCost">Estimated Credit Cost per Execution</Label>
              <Input
                id="estimatedCreditCost"
                type="number"
                min="1"
                value={formData.estimatedCreditCost}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    estimatedCreditCost: parseInt(e.target.value) || 10,
                  }))
                }
                className="mt-1"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tags & Requirements
            </h3>

            <div>
              <Label htmlFor="tags">Tags</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="automation, email, marketing"
                />
                <Button type="button" onClick={addTag} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-purple-900 dark:hover:text-purple-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="tools">Required Tools</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="tools"
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTool())}
                  placeholder="browser, http, email"
                />
                <Button type="button" onClick={addTool} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.requiredTools.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.requiredTools.map((tool) => (
                    <span
                      key={tool}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    >
                      {tool}
                      <button
                        type="button"
                        onClick={() => removeTool(tool)}
                        className="hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="integrations">Required Integrations</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="integrations"
                  value={integrationInput}
                  onChange={(e) => setIntegrationInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIntegration())}
                  placeholder="gmail, slack, google"
                />
                <Button type="button" onClick={addIntegration} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.requiredIntegrations.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.requiredIntegrations.map((integration) => (
                    <span
                      key={integration}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    >
                      {integration}
                      <button
                        type="button"
                        onClick={() => removeIntegration(integration)}
                        className="hover:text-green-900 dark:hover:text-green-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.name || !formData.description}
              className="flex-1 gradient-primary hover:gradient-primary-hover"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Skill'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
