/**
 * Vertical Template Types
 *
 * Type definitions for industry-specific agent templates.
 */

export interface TemplateWorkflow {
  id: string;
  name: string;
  description: string;
  trigger: 'manual' | 'scheduled' | 'event';
  schedule?: string; // Cron expression if scheduled
  steps: TemplateWorkflowStep[];
}

export interface TemplateWorkflowStep {
  order: number;
  tool: string; // Tool name (e.g., "browser.navigate", "email.send")
  description: string;
  params: Record<string, any>;
  estimatedCredits: number;
}

export interface VerticalTemplate {
  // Identity
  name: string;
  description: string;
  industry: string;
  icon: string;
  color: string;

  // Agent configuration
  agentType: string;
  systemPrompt: string;
  suggestedModel: string;

  // Requirements
  requiredTools: string[];
  optionalTools: string[];
  requiredIntegrations: string[];

  // Workflows
  sampleWorkflows: TemplateWorkflow[];

  // Custom instructions template
  customInstructionsTemplate: string;

  // Success metrics
  suggestedKPIs: string[];

  // Default configuration
  defaultConfig: {
    maxSteps?: number;
    maxCreditsPerTask?: number;
    timeoutSeconds?: number;
    retryAttempts?: number;
    requireApproval?: boolean;
  };

  // Tier and visibility
  tier: 'free' | 'core' | 'ultra';
  featured: boolean;
  order: number;
}

export type IndustryType =
  | 'ecommerce'
  | 'content-creation'
  | 'real-estate'
  | 'recruiting'
  | 'finance'
  | 'marketing'
  | 'customer-support'
  | 'sales'
  | 'operations'
  | 'legal';
