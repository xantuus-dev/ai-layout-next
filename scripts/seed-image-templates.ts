/**
 * Seed script for image generation templates
 * Run with: npx ts-node scripts/seed-image-templates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEMPLATES = [
  // Pitch Deck Templates
  {
    name: 'Professional Pitch Deck Slide',
    category: 'pitch-deck',
    description: 'Professional background for pitch deck slides with modern design',
    prompt:
      'Modern professional PowerPoint slide background with {{theme}} theme, clean minimalist design, suitable for business presentations, high quality, 4K',
    defaultWidth: 1920,
    defaultHeight: 1080,
    icon: '📊',
  },
  {
    name: 'Tech Startup Hero Image',
    category: 'pitch-deck',
    description: 'Eye-catching hero image for tech startup pitch decks',
    prompt:
      'Stunning hero image for {{startup_type}} startup pitch deck, {{theme}} color scheme, modern design, {{industry}} focused, professional photography, high quality',
    defaultWidth: 1920,
    defaultHeight: 1080,
    icon: '🚀',
  },
  {
    name: 'Product Showcase Slide',
    category: 'pitch-deck',
    description: 'Professional product showcase for presentations',
    prompt:
      '{{product_name}} product showcase on {{background}}, {{lighting}} lighting, professional product photography, clean {{style}} style, high resolution',
    defaultWidth: 1024,
    defaultHeight: 768,
    icon: '📱',
  },

  // Social Media Templates
  {
    name: 'Social Media Post - Instagram',
    category: 'social-media',
    description: 'Square Instagram post optimized for social media',
    prompt:
      '{{topic}} Instagram post, vibrant {{color}} color scheme, eye-catching design, trending style, engagement focused, modern typography',
    defaultWidth: 1080,
    defaultHeight: 1080,
    icon: '📸',
  },
  {
    name: 'LinkedIn Banner',
    category: 'social-media',
    description: 'Professional LinkedIn banner image',
    prompt:
      'Professional LinkedIn banner for {{role}} with {{brand}} branding, {{theme}} color scheme, corporate design, clean layout',
    defaultWidth: 1500,
    defaultHeight: 500,
    icon: '💼',
  },
  {
    name: 'Twitter/X Post',
    category: 'social-media',
    description: 'Engaging Twitter post image',
    prompt:
      'Twitter post about {{topic}}, {{style}} design, engaging visual, {{mood}} tone, modern aesthetics, high contrast for mobile',
    defaultWidth: 1024,
    defaultHeight: 512,
    icon: '𝕏',
  },

  // Team & Culture
  {
    name: 'Team Portrait Background',
    category: 'team',
    description: 'Professional background for team photos',
    prompt:
      'Professional office team portrait background, {{lighting}} lighting, {{theme}} theme, spacious room, modern company aesthetics, {{mood}} atmosphere',
    defaultWidth: 1920,
    defaultHeight: 1080,
    icon: '👥',
  },
  {
    name: 'Office Culture Photo',
    category: 'team',
    description: 'Authentic office culture and workplace image',
    prompt:
      '{{team_type}} team in modern {{office_type}} office space, {{atmosphere}} atmosphere, natural lighting, collaborative environment, {{vibe}} energy',
    defaultWidth: 1024,
    defaultHeight: 768,
    icon: '🏢',
  },

  // Product & Marketing
  {
    name: 'Product Feature Highlight',
    category: 'product',
    description: 'Highlight specific product features',
    prompt:
      '{{product}} {{feature}} highlighted in {{style}} design, {{color}} color scheme, modern presentation, professional mockup, clean background',
    defaultWidth: 1024,
    defaultHeight: 1024,
    icon: '✨',
  },
  {
    name: 'Marketing Campaign Banner',
    category: 'product',
    description: 'Eye-catching marketing campaign banner',
    prompt:
      '{{campaign_name}} marketing banner, {{color}} dominant colors, {{style}} design style, promotional focused, high impact visuals',
    defaultWidth: 1920,
    defaultHeight: 400,
    icon: '📢',
  },
  {
    name: 'Customer Success Story',
    category: 'product',
    description: 'Visual for customer success/testimonial',
    prompt:
      'Customer success story visual for {{product_name}}, professional case study style, {{theme}} color scheme, data visualization, modern design',
    defaultWidth: 1024,
    defaultHeight: 768,
    icon: '⭐',
  },

  // Event & Conference
  {
    name: 'Conference Slide Template',
    category: 'events',
    description: 'Professional conference presentation slide',
    prompt:
      '{{event_name}} conference slide background, professional {{theme}} theme, speaker presentation style, modern event design',
    defaultWidth: 1920,
    defaultHeight: 1080,
    icon: '🎤',
  },
  {
    name: 'Webinar Thumbnail',
    category: 'events',
    description: 'Eye-catching webinar thumbnail',
    prompt:
      '{{topic}} webinar thumbnail, eye-catching design, {{color}} color palette, engaging typography, {{style}} aesthetic',
    defaultWidth: 1280,
    defaultHeight: 720,
    icon: '🎥',
  },
];

async function main() {
  console.log('🌱 Seeding image templates...');

  // Clear existing templates
  await prisma.imageTemplate.deleteMany({});

  // Create templates
  for (const template of TEMPLATES) {
    try {
      const created = await prisma.imageTemplate.create({
        data: {
          ...template,
          isPublic: true,
        },
      });
      console.log(`✅ Created: ${created.name}`);
    } catch (error) {
      console.error(`❌ Failed to create ${template.name}:`, error);
    }
  }

  console.log(`\n🎉 Seeded ${TEMPLATES.length} image templates!`);
  console.log(
    'Templates are organized by category: pitch-deck, social-media, team, product, events'
  );
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
