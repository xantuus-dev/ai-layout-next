'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, Send, X, HardDrive, Mail, Calendar as CalendarIcon, Edit3, RotateCcw, Wand2 } from 'lucide-react';
import { GoogleIntegrationBadge } from './GoogleIntegrationBadge';
import { GoogleConnectPrompt } from './GoogleConnectPrompt';
import { TemplateVariableHighlighter } from './TemplateVariableHighlighter';

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
  const [editedPrompt, setEditedPrompt] = useState('');
  const [editMode, setEditMode] = useState(false);
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
    if (!editMode) {
      setEditedPrompt(prompt);
    }
  }, [variableValues, template, editMode]);

  const handleVariableChange = (name: string, value: string) => {
    setVariableValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCopy = () => {
    const textToCopy = editMode ? editedPrompt : populatedPrompt;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleEditMode = () => {
    if (!editMode) {
      // Entering edit mode - sync edited prompt with populated
      setEditedPrompt(populatedPrompt);
    }
    setEditMode(!editMode);
  };

  const handleResetToTemplate = () => {
    setEditedPrompt(populatedPrompt);
  };

  const handleUseTemplate = () => {
    const finalPrompt = editMode ? editedPrompt : populatedPrompt;

    // Check if all required variables are filled (only in variable mode)
    if (!editMode) {
      const missingRequired = template.variables
        .filter((v) => v.required && !variableValues[v.name])
        .map((v) => v.label || v.name);

      if (missingRequired.length > 0) {
        alert(`Please fill in required fields: ${missingRequired.join(', ')}`);
        return;
      }
    }

    // Increment usage count
    fetch(`/api/templates/${template.id}`, {
      method: 'POST',
    }).catch(console.error);

    onUseTemplate(finalPrompt);
    onClose();
  };

  const handleSaveToDrive = async () => {
    if (!userIntegrations?.googleDriveEnabled) {
      setShowConnectPrompt(true);
      return;
    }

    const finalPrompt = editMode ? editedPrompt : populatedPrompt;

    setActionLoading('drive');
    try {
      const response = await fetch('/api/integrations/drive/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.title}.txt`,
          content: finalPrompt,
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

    const finalPrompt = editMode ? editedPrompt : populatedPrompt;

    setActionLoading('gmail');
    try {
      const response = await fetch('/api/integrations/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          body: finalPrompt,
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

    const finalPrompt = editMode ? editedPrompt : populatedPrompt;

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
            description: finalPrompt,
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-850">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {template.title}
                </h2>
                <Badge variant="secondary" className="text-xs font-semibold px-2 py-1">
                  {template.tier.toUpperCase()}
                </Badge>
                {template.category && (
                  <Badge variant="outline" className="text-xs px-2 py-1">
                    {template.category.icon} {template.category.name}
                  </Badge>
                )}
              </div>
              {template.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {template.description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="ml-4 hover:bg-white/50 dark:hover:bg-gray-800/50"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {editMode ? 'Edit Mode - Customize your prompt freely' : 'Variable Mode - Fill in the template fields'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {editMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetToTemplate}
                  className="text-xs"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              )}
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={handleToggleEditMode}
                className={editMode ? "bg-blue-500 hover:bg-blue-600" : ""}
              >
                <Edit3 className="w-4 h-4 mr-2" />
                {editMode ? 'Back to Variables' : 'Edit Prompt'}
              </Button>
            </div>
          </div>
        </div>

        {/* Content - Two Columns */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-y-auto">
          {/* Left Column - Variable Inputs or Edit Mode Info */}
          <div className="space-y-4">
            {!editMode ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Fill in the details
                  </h3>
                </div>

                {template.variables.length === 0 ? (
                  <Card className="border-2 border-dashed">
                    <CardContent className="p-6">
                      <p className="text-gray-500 text-sm text-center">
                        This template has no variables. You can use it as-is or switch to Edit Mode to customize.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  template.variables.map((variable) => (
                    <div key={variable.name} className="space-y-2 p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                      <Label htmlFor={variable.name} className="flex items-center gap-2 font-medium">
                        {variable.label || variable.name}
                        {variable.required && (
                          <span className="text-red-500 text-sm font-bold">*</span>
                        )}
                      </Label>
                      {renderVariableInput(variable)}
                      {variable.placeholder && (
                        <p className="text-xs text-gray-500 mt-1">
                          {variable.placeholder}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Edit your prompt
                  </h3>
                </div>
                <Card className="border-2 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-6 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You're now in edit mode. Make any changes you want to the prompt below. Your edits will be used when you click "Use Template".
                    </p>
                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="text-blue-500">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                          Tip: Switch back to Variable Mode to update the template fields automatically.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Right Column - Preview/Editor */}
          <div className="lg:sticky lg:top-0 lg:self-start">
            <Card className="shadow-lg border-2">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {editMode ? (
                        <>
                          <Edit3 className="w-5 h-5 text-purple-500" />
                          Edit Prompt
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-5 h-5 text-blue-500" />
                          Preview
                        </>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {editMode ? 'Customize your prompt directly' : 'See how your prompt will look'}
                    </CardDescription>
                  </div>
                  <Badge variant={editMode ? "default" : "secondary"} className={editMode ? "bg-purple-500" : ""}>
                    {editMode ? 'Editable' : 'Live Preview'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {editMode ? (
                  <Textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    className="min-h-[300px] max-h-[500px] font-mono text-sm border-2 border-purple-200 dark:border-purple-800 focus:border-purple-400 dark:focus:border-purple-600 resize-none"
                    placeholder="Edit your prompt here..."
                  />
                ) : (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 min-h-[300px] max-h-[500px] overflow-y-auto">
                    <div className="text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                      <TemplateVariableHighlighter
                        text={populatedPrompt}
                        variables={template.variables}
                      />
                    </div>
                  </div>
                )}

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
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wide">
                      Quick Actions
                    </p>
                    <div className="flex flex-col gap-2">
                      {template.requiresGoogleDrive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSaveToDrive}
                          disabled={actionLoading !== null}
                          className="justify-start hover:bg-blue-50 dark:hover:bg-blue-900/20"
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
                          className="justify-start hover:bg-red-50 dark:hover:bg-red-900/20"
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
                          className="justify-start hover:bg-green-50 dark:hover:bg-green-900/20"
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
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {!editMode && template.variables.filter((v) => v.required).length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-red-500 font-bold">*</span>
                  Required fields
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} size="lg">
                Cancel
              </Button>
              <Button
                onClick={handleUseTemplate}
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold px-6 shadow-lg hover:shadow-xl transition-all"
              >
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
