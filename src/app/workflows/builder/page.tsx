/**
 * Visual Workflow Builder Page
 *
 * Main entry point for the drag-and-drop workflow builder
 * - Authentication required
 * - Handles save/load workflow operations
 * - Integrates with existing workflow API
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WorkflowBuilderCanvas } from '@/components/workflow-builder/WorkflowBuilderCanvas';
import { useWorkflowBuilderStore } from '@/stores/workflow-builder-store';
import { createWorkflowData, validateWorkflow } from '@/lib/workflow-builder/workflow-converter';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function WorkflowBuilderPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const nodes = useWorkflowBuilderStore((state) => state.nodes);
  const workflowName = useWorkflowBuilderStore((state) => state.workflowName);
  const setWorkflowMetadata = useWorkflowBuilderStore((state) => state.setWorkflowMetadata);
  const loadWorkflow = useWorkflowBuilderStore((state) => state.loadWorkflow);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get workflow ID from URL params (for editing existing workflow)
  const workflowId = searchParams.get('id');
  const templateId = searchParams.get('template');

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/');
    }
  }, [sessionStatus, router]);

  // Load workflow if ID provided
  useEffect(() => {
    if (sessionStatus === 'authenticated' && workflowId) {
      loadWorkflowFromDatabase(workflowId);
    } else if (sessionStatus === 'authenticated' && templateId) {
      loadTemplate(templateId);
    } else if (sessionStatus === 'authenticated') {
      setLoading(false);
    }
  }, [sessionStatus, workflowId, templateId]);

  /**
   * Load workflow from database
   */
  const loadWorkflowFromDatabase = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/workflows/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load workflow');
      }

      const data = await response.json();

      // Convert database format to canvas nodes
      // TODO: Implement convertFromWorkflowSteps when database integration is ready
      loadWorkflow({
        id: data.id,
        name: data.name,
        description: data.description || '',
        nodes: [], // Will be populated from data.steps
      });

    } catch (err: any) {
      console.error('Load workflow error:', err);
      setError(err.message || 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load template
   */
  const loadTemplate = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/workflows/templates/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load template');
      }

      const data = await response.json();

      // Load template into canvas
      loadWorkflow({
        id: '',
        name: `${data.name} (Copy)`,
        description: data.description || '',
        nodes: [], // Will be populated from template
      });

    } catch (err: any) {
      console.error('Load template error:', err);
      setError(err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save workflow to database
   */
  const handleSave = async (name: string, description: string) => {
    try {
      setError(null);
      setSuccess(null);

      // Update metadata in store
      setWorkflowMetadata(name, description);

      // Validate workflow
      const validation = validateWorkflow(nodes, name);
      if (!validation.valid) {
        setError(validation.errors.join(', '));
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Workflow warnings:', validation.warnings);
      }

      // Create workflow data
      const workflowData = createWorkflowData(nodes, name, description);

      // Save to database
      const response = await fetch('/api/workflows', {
        method: workflowId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...workflowData,
          id: workflowId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save workflow');
      }

      const savedWorkflow = await response.json();

      setSuccess('Workflow saved successfully!');
      setTimeout(() => setSuccess(null), 3000);

      // Update URL if this was a new workflow
      if (!workflowId && savedWorkflow.id) {
        router.push(`/workflows/builder?id=${savedWorkflow.id}`);
      }

    } catch (err: any) {
      console.error('Save workflow error:', err);
      setError(err.message || 'Failed to save workflow');
    }
  };

  /**
   * Test run workflow via AI Agent
   */
  const handleTestRun = async () => {
    try {
      setError(null);
      setSuccess(null);

      // Validate first
      const validation = validateWorkflow(nodes, workflowName || 'Test');
      if (!validation.valid) {
        setError(validation.errors.join(', '));
        return;
      }

      // Execute via AI agent
      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          workflowName: workflowName || 'Test Workflow',
          workflowDescription: 'Test execution from visual builder',
          workflowId,
          isTest: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Execution failed');
      }

      const result = await response.json();

      setSuccess(`Workflow executing! Task ID: ${result.taskId}`);

      // Start monitoring execution
      startExecutionMonitoring(result.executionId);

    } catch (err: any) {
      console.error('Test run error:', err);
      setError(err.message || 'Test run failed');
    }
  };

  /**
   * Monitor execution in real-time
   */
  const startExecutionMonitoring = (executionId: string) => {
    const startExecution = useWorkflowBuilderStore.getState().startExecution;
    const updateExecutionStates = useWorkflowBuilderStore.getState().updateExecutionStates;
    const stopExecution = useWorkflowBuilderStore.getState().stopExecution;

    startExecution(executionId);

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/workflows/execution/${executionId}`);
        if (!response.ok) {
          clearInterval(interval);
          return;
        }

        const data = await response.json();

        // Update node states in canvas
        if (data.execution?.executionTrace) {
          updateExecutionStates(data.execution.executionTrace);
        }

        // Stop monitoring when complete
        if (data.execution?.status === 'completed' || data.execution?.status === 'failed') {
          clearInterval(interval);
          stopExecution();

          if (data.execution.status === 'completed') {
            setSuccess('Workflow completed successfully!');
          } else {
            setError(`Workflow failed: ${data.execution.error || 'Unknown error'}`);
          }
        }
      } catch (err) {
        console.error('Monitoring error:', err);
        clearInterval(interval);
      }
    }, 1000); // Poll every second
  };

  // Loading state
  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Error/Success Alerts */}
      {error && (
        <Alert variant="destructive" className="m-4 mb-0">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="m-4 mb-0 border-green-500 bg-green-50 text-green-900">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Main Builder */}
      <div className="flex-1">
        <WorkflowBuilderCanvas
          workflowId={workflowId || undefined}
          onSave={handleSave}
          onTestRun={handleTestRun}
        />
      </div>
    </div>
  );
}
