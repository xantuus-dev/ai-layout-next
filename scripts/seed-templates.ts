/**
 * Seed Vertical Templates Script
 *
 * Populates the database with industry-specific agent templates.
 *
 * Usage:
 *   npx tsx scripts/seed-templates.ts [--clear]
 *
 * Options:
 *   --clear  Clear existing templates before seeding
 */

import { PrismaClient } from '@prisma/client';
import { ALL_TEMPLATES } from '../src/lib/templates';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const shouldClear = args.includes('--clear');

  console.log('🌱 Seeding vertical templates...\n');

  try {
    // Clear existing templates if requested
    if (shouldClear) {
      console.log('🧹 Clearing existing templates...');
      const deleted = await prisma.industryTemplate.deleteMany();
      console.log(`   Deleted ${deleted.count} existing templates\n`);
    }

    // Seed each template
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const template of ALL_TEMPLATES) {
      console.log(`📋 Processing: ${template.name}`);

      // Check if template already exists
      const existing = await prisma.industryTemplate.findFirst({
        where: { name: template.name },
      });

      if (existing && !shouldClear) {
        // Update existing template
        await prisma.industryTemplate.update({
          where: { id: existing.id },
          data: {
            description: template.description,
            industry: template.industry,
            icon: template.icon,
            color: template.color,
            agentType: template.agentType,
            systemPrompt: template.systemPrompt,
            suggestedModel: template.suggestedModel,
            requiredTools: template.requiredTools,
            optionalTools: template.optionalTools,
            requiredIntegrations: template.requiredIntegrations,
            sampleWorkflows: template.sampleWorkflows as any,
            customInstructionsTemplate: template.customInstructionsTemplate,
            suggestedKPIs: template.suggestedKPIs,
            defaultConfig: template.defaultConfig as any,
            tier: template.tier,
            featured: template.featured,
            order: template.order,
          },
        });
        console.log(`   ✅ Updated existing template\n`);
        updated++;
      } else if (!existing) {
        // Create new template
        await prisma.industryTemplate.create({
          data: {
            name: template.name,
            description: template.description,
            industry: template.industry,
            icon: template.icon,
            color: template.color,
            agentType: template.agentType,
            systemPrompt: template.systemPrompt,
            suggestedModel: template.suggestedModel,
            requiredTools: template.requiredTools,
            optionalTools: template.optionalTools,
            requiredIntegrations: template.requiredIntegrations,
            sampleWorkflows: template.sampleWorkflows as any,
            customInstructionsTemplate: template.customInstructionsTemplate,
            suggestedKPIs: template.suggestedKPIs,
            defaultConfig: template.defaultConfig as any,
            tier: template.tier,
            featured: template.featured,
            order: template.order,
          },
        });
        console.log(`   ✅ Created new template\n`);
        created++;
      } else {
        console.log(`   ⏭️  Skipped (already exists)\n`);
        skipped++;
      }
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Seeding complete!\n');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total:   ${created + updated + skipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // List all templates in database
    const allTemplates = await prisma.industryTemplate.findMany({
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        industry: true,
        tier: true,
        featured: true,
      },
    });

    console.log('📚 Templates in database:\n');
    allTemplates.forEach((t, i) => {
      const tierBadge = t.tier === 'free' ? '🆓' : t.tier === 'core' ? '💎' : '⭐';
      const featuredBadge = t.featured ? '⭐' : '  ';
      console.log(
        `   ${i + 1}. ${featuredBadge} ${tierBadge} ${t.name} (${t.industry})`
      );
    });
    console.log('');
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
