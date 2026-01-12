'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, Send, X, HardDrive, Mail, Calendar as CalendarIcon } from 'lucide-react';
import { GoogleIntegrationBadge } from './GoogleIntegrationBadge';
import { GoogleConnectPrompt } from './GoogleConnectPrompt';

interface Variable {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface TemplateVariableFormProps {
  template: {
    id: string;
    title: string;
    description: string | null;
    template: string;
    variables: Variable[];
    tier: string;
    category?: {
      name: string;
      icon: string | null;
    } | null;
    requiresGoogleDrive: boolean;
    requiresGmail: boolean;
    requiresCalendar: boolean;
  };
  onClose: () => void;
  onUseTemplate: (populatedPrompt: string) => void;
}

export function TemplateVariableForm({
  template,
  onClose,
  onUseTemplate,
}: TemplateVariableFormProps) {
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [populatedPrompt, setPopulatedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [userIntegrations, setUserIntegrations] = useState<{
    googleDriveEnabled: boolean;
    googleGmailEnabled: boolean;
    googleCalendarEnabled: boolean;
  } | null>(null);
  const [showConnectPrompt, setShowConnectPrompt] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Initialize variable values
  useEffect(() => {
    const initialValues: Record<string, string> = {};
    template.variables.forEach((variable) => {
      initialValues[variable.name] = '';
    });
    setVariableValues(initialValues);
  }, [template]);

  // Load user's integration status
  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const session = await response.json();
        if (session?.user) {
          setUserIntegrations({
            googleDriveEnabled: session.user.googleDriveEnabled || false,
            googleGmailEnabled: session.user.googleGmailEnabled || false,
            googleCalendarEnabled: session.user.googleCalendarEnabled || false,
          });
        }
      } catch (error) {
        console.error('Error loading integrations:', error);
      }
    };
    loadIntegrations();
  }, []);

  // Update populated prompt whenever variables change
  useEffect(() => {
    let prompt = template.template;

    // Replace all {{variable}} placeholders
    template.variables.forEach((variable) => {
      const value = variableValues[variable.name] || '';
      const placeholder = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');

      if (value) {
        prompt = prompt.replace(placeholder, value);
      } else {
        // Show placeholder in brackets if not filled
        prompt = prompt.replace(placeholder, `[${variable.label || variable.name}]`);
      }
    });

    setPopulatedPrompt(prompt);
  }, [variableValues, template]);

  const handleVariableChange = (name: string, value: string) => {
    setVariableValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(populatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseTemplate = () => {
    // Check if all required variables are filled
    const missingRequired = template.variables
      .filter((v) => v.required && !variableValues[v.name])
      .map((v) => v.label || v.name);

    if (missingRequired.length > 0) {
      alert(`Please fill in required fields: ${missingRequired.join(', ')}`);
      return;
    }

    // Increment usage count
    fetch(`/api/templates/${template.id}`, {
      method: 'POST',
    }).catch(console.error);

    onUseTemplate(populatedPrompt);
    onClose();
  };

  const handleSaveToDrive = async () => {
    if (!userIntegrations?.googleDriveEnabled) {
      setShowConnectPrompt(true);
      return;
    }

    setActionLoading('drive');
    try {
      const response = await fetch('/api/integrations/drive/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.title}.txt`,
          content: populatedPrompt,
          mimeType: 'text/plain',
        }),
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      alert(`Saved to Google Drive! File ID: ${data.file.id}`);
    } catch (error) {
      console.error('Error saving to Drive:', error);
      alert('Failed to save to Google Drive. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendViaGmail = async () => {
    if (!userIntegrations?.googleGmailEnabled) {
      setShowConnectPrompt(true);
      return;
    }

    const to = prompt('Enter recipient email address:');
    if (!to) return;

    const subject = prompt('Enter email subject:', template.title);
    if (!subject) return;

    setActionLoading('gmail');
    try {
      const response = await fetch('/api/integrations/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          body: populatedPrompt,
          isHtml: false,
        }),
      });

      if (!response.ok) throw new Error('Send failed');

      alert('Email sent successfully via Gmail!');
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateCalendarEvent = async () => {
    if (!userIntegrations?.googleCalendarEnabled) {
      setShowConnectPrompt(true);
      return;
    }

    const title = prompt('Enter event title:', template.title);
    if (!title) return;

    const startTime = prompt('Enter start time (YYYY-MM-DD HH:MM):',
      new Date(Date.now() + 3600000).toISOString().slice(0, 16).replace('T', ' '));
    if (!startTime) return;

    setActionLoading('calendar');
    try {
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + 3600000); // +1 hour

      const response = await fetch('/api/integrations/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            summary: title,
            description: populatedPrompt,
            start: {
              dateTime: startDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: endDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        }),
      });

      if (!response.ok) throw new Error('Create event failed');

      alert('Calendar event created successfully!');
    } catch (error) {
      console.error('Error creating calendar event:', error);
      alert('Failed to create calendar event. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const renderVariableInput = (variable: Variable) => {
    const value = variableValues[variable.name] || '';

    switch (variable.type) {
      case 'textarea':
        return (
          <Textarea
            id={variable.name}
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            placeholder={variable.placeholder || ''}
            rows={4}
            className="resize-none"
          />
        );

      case 'number':
        return (
          <Input
            id={variable.name}
            type="number"
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            placeholder={variable.placeholder || ''}
          />
        );

      case 'select':
        return (
          <Select
            value={value}
            onValueChange={(val) => handleVariableChange(variable.name, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={variable.placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {variable.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'text':
      default:
        return (
          <Input
            id={variable.name}
            type="text"
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            placeholder={variable.placeholder || ''}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {template.title}
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {template.tier.toUpperCase()}
                </Badge>
                {template.category && (
                  <Badge variant="outline" className="text-xs">
                    {template.category.icon} {template.category.name}
                  </Badge>
                )}
              </div>
              {template.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {template.description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="ml-4"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content - Two Columns */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-y-auto">
          {/* Left Column - Variable Inputs */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Fill in the details
            </h3>

            {template.variables.length === 0 ? (
              <p className="text-gray-500 text-sm">
                This template has no variables. You can use it as-is.
              </p>
            ) : (
              template.variables.map((variable) => (
                <div key={variable.name} className="space-y-2">
                  <Label htmlFor={variable.name} className="flex items-center gap-2">
                    {variable.label || variable.name}
                    {variable.required && (
                      <span className="text-red-500 text-sm">*</span>
                    )}
                  </Label>
                  {renderVariableInput(variable)}
                </div>
              ))
            )}
          </div>

          {/* Right Column - Preview */}
          <div className="lg:sticky lg:top-0 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preview</CardTitle>
                <CardDescription>
                  See how your prompt will look
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 min-h-[200px] max-h-[400px] overflow-y-auto">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                    {populatedPrompt}
                  </pre>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>

                {/* Integration Actions */}
                {(template.requiresGoogleDrive || template.requiresGmail || template.requiresCalendar) && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
                      Quick Actions:
                    </p>
                    <div className="flex flex-col gap-2">
                      {template.requiresGoogleDrive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSaveToDrive}
                          disabled={actionLoading !== null}
                          className="justify-start"
                        >
                          <HardDrive className="w-4 h-4 mr-2" />
                          {actionLoading === 'drive' ? 'Saving...' : 'Save to Drive'}
                        </Button>
                      )}
                      {template.requiresGmail && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSendViaGmail}
                          disabled={actionLoading !== null}
                          className="justify-start"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          {actionLoading === 'gmail' ? 'Sending...' : 'Send via Gmail'}
                        </Button>
                      )}
                      {template.requiresCalendar && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCreateCalendarEvent}
                          disabled={actionLoading !== null}
                          className="justify-start"
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {actionLoading === 'calendar' ? 'Creating...' : 'Create Calendar Event'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Google Connect Prompt */}
            {showConnectPrompt && (
              <div className="mt-4">
                <GoogleConnectPrompt
                  services={[
                    ...(template.requiresGoogleDrive ? ['drive' as const] : []),
                    ...(template.requiresGmail ? ['gmail' as const] : []),
                    ...(template.requiresCalendar ? ['calendar' as const] : []),
                  ]}
                  title="Connect Google Services"
                  description="This template requires Google services to use these features."
                  inline
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {template.variables.filter((v) => v.required).length > 0 && (
                <span>* Required fields</span>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleUseTemplate} className="bg-blue-500 hover:bg-blue-600">
                <Send className="w-4 h-4 mr-2" />
                Use Template
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
