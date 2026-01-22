'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Wand2 } from 'lucide-react';

interface TemplateVariable {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  options?: string[];
}

interface TemplateVariableInputProps {
  template: {
    id: string;
    title: string;
    description: string;
    template: string;
    variables: TemplateVariable[];
  };
  onApply: (filledTemplate: string) => void;
  onCancel: () => void;
}

export function TemplateVariableInput({
  template,
  onApply,
  onCancel,
}: TemplateVariableInputProps) {
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [previewText, setPreviewText] = useState('');

  useEffect(() => {
    // Initialize with placeholders
    const initialValues: Record<string, string> = {};
    template.variables.forEach((variable) => {
      initialValues[variable.name] = '';
    });
    setVariableValues(initialValues);
    updatePreview(initialValues);
  }, [template]);

  const updatePreview = (values: Record<string, string>) => {
    let preview = template.template;

    // Replace variables with values or keep as highlighted placeholders
    template.variables.forEach((variable) => {
      const value = values[variable.name];
      const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
      preview = preview.replace(regex, value || `{{${variable.name}}}`);
    });

    setPreviewText(preview);
  };

  const handleVariableChange = (name: string, value: string) => {
    const newValues = { ...variableValues, [name]: value };
    setVariableValues(newValues);
    updatePreview(newValues);
  };

  const handleApply = () => {
    // Check if all required variables are filled
    const allFilled = template.variables.every(
      (variable) => variableValues[variable.name]?.trim() !== ''
    );

    if (!allFilled) {
      // Show warning but still allow applying
      if (!confirm('Some variables are not filled. Continue anyway?')) {
        return;
      }
    }

    onApply(previewText);
  };

  // Render preview with highlighted variables
  const renderPreviewWithHighlights = () => {
    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    const regex = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = regex.exec(previewText)) !== null) {
      // Add text before the variable
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {previewText.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Add the highlighted variable
      const variableName = match[1];
      const variable = template.variables.find((v) => v.name === variableName);

      parts.push(
        <span
          key={`var-${match.index}`}
          className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium text-sm border border-blue-200 dark:border-blue-800"
        >
          {variable?.label || variableName}
        </span>
      );

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < previewText.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {previewText.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return (
    <Card className="mb-4 border-blue-500 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-blue-500" />
            <div>
              <CardTitle className="text-lg">{template.title}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Variable Inputs */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Fill in the variables:
          </h4>
          {template.variables.map((variable) => (
            <div key={variable.name} className="space-y-1.5">
              <Label htmlFor={variable.name} className="text-sm">
                {variable.label}
              </Label>
              {variable.type === 'select' && variable.options ? (
                <select
                  id={variable.name}
                  value={variableValues[variable.name] || ''}
                  onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  {variable.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={variable.name}
                  type={variable.type === 'number' ? 'number' : 'text'}
                  placeholder={variable.placeholder || `Enter ${variable.label.toLowerCase()}`}
                  value={variableValues[variable.name] || ''}
                  onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                  className="w-full"
                />
              )}
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Preview:
          </h4>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
            {renderPreviewWithHighlights()}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleApply} className="flex-1">
            Apply Template
          </Button>
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
