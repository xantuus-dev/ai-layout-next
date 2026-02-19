/**
 * Vertical Templates Index
 *
 * Exports all industry-specific agent templates.
 */

import { ecommerceManagerTemplate } from './ecommerce-manager';
import { contentCreatorTemplate } from './content-creator';
import { realEstateAgentTemplate } from './real-estate-agent';
import { recruiterAssistantTemplate } from './recruiter-assistant';
import { financialAnalystTemplate } from './financial-analyst';
import { VerticalTemplate, IndustryType } from './types';

/**
 * All available vertical templates
 */
export const ALL_TEMPLATES: VerticalTemplate[] = [
  ecommerceManagerTemplate,
  contentCreatorTemplate,
  realEstateAgentTemplate,
  recruiterAssistantTemplate,
  financialAnalystTemplate,
];

/**
 * Templates sorted by display order
 */
export const FEATURED_TEMPLATES = ALL_TEMPLATES.filter((t) => t.featured).sort(
  (a, b) => a.order - b.order
);

/**
 * Templates grouped by industry
 */
export const TEMPLATES_BY_INDUSTRY: Record<IndustryType, VerticalTemplate[]> = {
  ecommerce: [ecommerceManagerTemplate],
  'content-creation': [contentCreatorTemplate],
  'real-estate': [realEstateAgentTemplate],
  recruiting: [recruiterAssistantTemplate],
  finance: [financialAnalystTemplate],
  marketing: [],
  'customer-support': [],
  sales: [],
  operations: [],
  legal: [],
};

/**
 * Templates grouped by tier
 */
export const TEMPLATES_BY_TIER = {
  free: ALL_TEMPLATES.filter((t) => t.tier === 'free'),
  core: ALL_TEMPLATES.filter((t) => t.tier === 'core'),
  ultra: ALL_TEMPLATES.filter((t) => t.tier === 'ultra'),
};

/**
 * Get template by industry
 */
export function getTemplatesByIndustry(industry: IndustryType): VerticalTemplate[] {
  return TEMPLATES_BY_INDUSTRY[industry] || [];
}

/**
 * Get template by name
 */
export function getTemplateByName(name: string): VerticalTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.name === name);
}

/**
 * Get templates available for a specific tier
 */
export function getTemplatesForTier(
  tier: 'free' | 'core' | 'ultra'
): VerticalTemplate[] {
  if (tier === 'ultra') {
    return ALL_TEMPLATES; // Ultra has access to all
  }
  if (tier === 'core') {
    return ALL_TEMPLATES.filter((t) => t.tier === 'free' || t.tier === 'core');
  }
  return ALL_TEMPLATES.filter((t) => t.tier === 'free');
}

// Re-export types
export * from './types';

// Re-export individual templates
export {
  ecommerceManagerTemplate,
  contentCreatorTemplate,
  realEstateAgentTemplate,
  recruiterAssistantTemplate,
  financialAnalystTemplate,
};
