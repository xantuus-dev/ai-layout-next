'use client';

import { useState, useEffect } from 'react';
import {
  Play,
  Plus,
  Trash2,
  Edit,
  Copy,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Workflow as WorkflowIcon,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface WorkflowStep {
  type: string;
  action: any;
  onError?: string;
  maxRetries?: number;
  saveOutput?: boolean;
  outputName?: string;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  isTemplate: boolean;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRunAt?: Date;
  stepCount: number;
  createdAt: Date;
}

interface ExecutionResult {
  success: boolean;
  execution: {
    status: string;
    currentStep: number;
    totalSteps: number;
    executionTrace: any[];
    variables: any;
    aiRecoveries: number;
    duration: number;
  };
}

interface WorkflowManagerProps {
  sessionId: string;
  onCreditsUsed?: (credits: number) => void;
}

export default function WorkflowManager({ sessionId, onCreditsUsed }: WorkflowManagerProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(true);

  // New workflow form
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [newWorkflowSteps, setNewWorkflowSteps] = useState<WorkflowStep[]>([]);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/browser/workflow?templates=true');
      const data = await response.json();

      if (data.success) {
        setWorkflows(
          data.workflows.map((w: any) => ({
            ...w,
            createdAt: new Date(w.createdAt),
            lastRunAt: w.lastRunAt ? new Date(w.lastRunAt) : undefined,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeWorkflow = async (workflowId: string) => {
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const response = await fetch(`/api/browser/workflow/${workflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          variables: {},
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute workflow');
      }

      setExecutionResult(data);

      // Notify parent of credits used
      if (onCreditsUsed && data.execution?.creditsUsed) {
        onCreditsUsed(data.execution.creditsUsed);
      }

      // Reload workflows to update stats
      loadWorkflows();
    } catch (error: any) {
      console.error('Workflow execution error:', error);
      setExecutionResult({
        success: false,
        execution: {
          status: 'failed',
          currentStep: 0,
          totalSteps: 0,
          executionTrace: [],
          variables: {},
          aiRecoveries: 0,
          duration: 0,
        },
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const createWorkflow = async () => {
    if (!newWorkflowName || newWorkflowSteps.length === 0) {
      alert('Please provide a name and at least one step');
      return;
    }

    try {
      const response = await fetch('/api/browser/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWorkflowName,
          description: newWorkflowDescription,
          steps: newWorkflowSteps,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create workflow');
      }

      // Reset form
      setNewWorkflowName('');
      setNewWorkflowDescription('');
      setNewWorkflowSteps([]);
      setIsCreating(false);

      // Reload workflows
      loadWorkflows();
    } catch (error: any) {
      console.error('Workflow creation error:', error);
      alert(`Failed to create workflow: ${error.message}`);
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      const response = await fetch(`/api/browser/workflow?id=${workflowId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadWorkflows();
        if (selectedWorkflow?.id === workflowId) {
          setSelectedWorkflow(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  };

  const addStep = (type: string) => {
    const stepTemplates: Record<string, WorkflowStep> = {
      navigate: {
        type: 'navigate',
        action: { url: 'https://example.com' },
      },
      click: {
        type: 'click',
        action: { selector: 'button' },
      },
      type: {
        type: 'type',
        action: { selector: 'input', value: 'text' },
      },
      extract: {
        type: 'extract',
        action: { selector: 'h1' },
        saveOutput: true,
        outputName: 'result',
      },
      wait: {
        type: 'wait',
        action: { duration: 2000 },
      },
    };

    setNewWorkflowSteps([...newWorkflowSteps, stepTemplates[type]]);
  };

  const removeStep = (index: number) => {
    setNewWorkflowSteps(newWorkflowSteps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: string, value: any) => {
    const updated = [...newWorkflowSteps];
    if (field.startsWith('action.')) {
      const actionField = field.split('.')[1];
      updated[index].action[actionField] = value;
    } else {
      (updated[index] as any)[field] = value;
    }
    setNewWorkflowSteps(updated);
  };

  if (isCreating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create New Workflow</h2>
          <Button variant="ghost" onClick={() => setIsCreating(false)}>
            Cancel
          </Button>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-base">Workflow Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Name</label>
              <Input
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="My Workflow"
                className="bg-slate-900 border-slate-700"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description (optional)</label>
              <Textarea
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
                placeholder="What does this workflow do?"
                className="bg-slate-900 border-slate-700"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Steps ({newWorkflowSteps.length})</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => addStep('navigate')}>
                  + Navigate
                </Button>
                <Button size="sm" variant="outline" onClick={() => addStep('click')}>
                  + Click
                </Button>
                <Button size="sm" variant="outline" onClick={() => addStep('type')}>
                  + Type
                </Button>
                <Button size="sm" variant="outline" onClick={() => addStep('extract')}>
                  + Extract
                </Button>
                <Button size="sm" variant="outline" onClick={() => addStep('wait')}>
                  + Wait
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {newWorkflowSteps.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                Add steps to your workflow using the buttons above
              </p>
            ) : (
              <div className="space-y-3">
                {newWorkflowSteps.map((step, index) => (
                  <div
                    key={index}
                    className="p-3 bg-slate-900 rounded border border-slate-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium">
                        Step {index + 1}: {step.type}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeStep(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2 text-xs">
                      {step.type === 'navigate' && (
                        <Input
                          placeholder="URL"
                          value={step.action.url}
                          onChange={(e) => updateStep(index, 'action.url', e.target.value)}
                          className="bg-slate-800 border-slate-600"
                        />
                      )}
                      {(step.type === 'click' || step.type === 'extract') && (
                        <Input
                          placeholder="CSS Selector"
                          value={step.action.selector}
                          onChange={(e) =>
                            updateStep(index, 'action.selector', e.target.value)
                          }
                          className="bg-slate-800 border-slate-600"
                        />
                      )}
                      {step.type === 'type' && (
                        <>
                          <Input
                            placeholder="CSS Selector"
                            value={step.action.selector}
                            onChange={(e) =>
                              updateStep(index, 'action.selector', e.target.value)
                            }
                            className="bg-slate-800 border-slate-600"
                          />
                          <Input
                            placeholder="Text to type"
                            value={step.action.value}
                            onChange={(e) =>
                              updateStep(index, 'action.value', e.target.value)
                            }
                            className="bg-slate-800 border-slate-600"
                          />
                        </>
                      )}
                      {step.type === 'wait' && (
                        <Input
                          type="number"
                          placeholder="Duration (ms)"
                          value={step.action.duration}
                          onChange={(e) =>
                            updateStep(index, 'action.duration', parseInt(e.target.value))
                          }
                          className="bg-slate-800 border-slate-600"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={createWorkflow} disabled={!newWorkflowName || newWorkflowSteps.length === 0}>
          Create Workflow
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Workflows</h2>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
        </div>
      ) : workflows.length === 0 ? (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="pt-12 pb-12 text-center">
            <WorkflowIcon className="h-16 w-16 mx-auto mb-4 text-slate-400 opacity-50" />
            <p className="text-lg font-medium mb-2">No workflows yet</p>
            <p className="text-sm text-slate-400 mb-4">
              Create your first workflow to automate browser tasks
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((workflow) => (
            <Card
              key={workflow.id}
              className="border-slate-700 bg-slate-800/50 hover:border-slate-600 cursor-pointer"
              onClick={() => setSelectedWorkflow(workflow)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {workflow.icon && <span>{workflow.icon}</span>}
                      {workflow.name}
                      {workflow.isTemplate && (
                        <Badge variant="outline" className="text-xs">
                          Template
                        </Badge>
                      )}
                    </CardTitle>
                    {workflow.description && (
                      <CardDescription className="text-xs mt-1">
                        {workflow.description}
                      </CardDescription>
                    )}
                  </div>
                  {!workflow.isTemplate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkflow(workflow.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{workflow.stepCount} steps</span>
                    {workflow.lastRunAt && (
                      <span>
                        Last run: {workflow.lastRunAt.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {workflow.totalRuns > 0 && (
                    <div className="flex gap-2 text-xs">
                      <Badge variant="secondary">{workflow.totalRuns} runs</Badge>
                      <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                        {workflow.successfulRuns} success
                      </Badge>
                      {workflow.failedRuns > 0 && (
                        <Badge variant="secondary" className="bg-red-500/20 text-red-400">
                          {workflow.failedRuns} failed
                        </Badge>
                      )}
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      executeWorkflow(workflow.id);
                    }}
                    disabled={isExecuting}
                  >
                    {isExecuting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Run Workflow
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Execution Result */}
      {executionResult && (
        <Card
          className={`border-2 ${executionResult.success ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}`}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {executionResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Workflow {executionResult.success ? 'Completed' : 'Failed'}
              </CardTitle>
              <div className="text-right text-xs text-slate-400">
                <Clock className="h-3 w-3 inline mr-1" />
                {executionResult.execution.duration}ms
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                Completed {executionResult.execution.currentStep} of{' '}
                {executionResult.execution.totalSteps} steps
              </p>
              {executionResult.execution.aiRecoveries > 0 && (
                <Badge variant="secondary">
                  {executionResult.execution.aiRecoveries} AI recoveries
                </Badge>
              )}
              {executionResult.execution.executionTrace.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-blue-400">
                    View Execution Log
                  </summary>
                  <div className="mt-2 space-y-1">
                    {executionResult.execution.executionTrace.map((trace: any, i: number) => (
                      <div
                        key={i}
                        className={`text-xs p-2 rounded ${
                          trace.status === 'completed'
                            ? 'bg-green-500/10'
                            : trace.status === 'failed'
                            ? 'bg-red-500/10'
                            : 'bg-slate-700'
                        }`}
                      >
                        Step {trace.stepOrder}: {trace.stepType} - {trace.status}
                        {trace.error && (
                          <p className="text-red-400 mt-1">{trace.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
