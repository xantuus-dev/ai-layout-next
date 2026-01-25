# Multi-Provider AI Architecture

## Overview

Xantuus AI now supports **multiple AI providers** in a single platform, allowing your small business customers to leverage the best models from Anthropic, OpenAI, and Google.

---

## Supported Providers & Models

### 🤖 **Anthropic (Claude)**
- **Claude Opus 4.5** - Most capable for complex work (15 credits/1K tokens)
- **Claude Sonnet 4.5** - Best for everyday tasks (3 credits/1K tokens)
- **Claude Haiku 4.5** - Fastest for quick answers (1 credit/1K tokens)

### 🧠 **OpenAI (GPT)**
- **GPT-4 Turbo** - Best for code and reasoning (10 credits/1K tokens)
- **GPT-4o** - Multimodal powerhouse (5 credits/1K tokens)
- **GPT-4o Mini** - Fast and affordable (0.15 credits/1K tokens)
- **GPT-3.5 Turbo** - Legacy fast model (0.5 credits/1K tokens)

### 🎯 **Google (Gemini)**
- **Gemini 2.0 Flash** - Ultra-fast multimodal (0.075 credits/1K tokens) - **CHEAPEST!**
- **Gemini 1.5 Pro** - Long context powerhouse (1.25 credits/1K tokens)
- **Gemini 1.5 Flash** - Fast and efficient (0.075 credits/1K tokens)

---

## Setup Instructions

### 1. Required (Default)

You already have Anthropic configured:
```bash
ANTHROPIC_API_KEY="sk-ant-..."
```

### 2. Optional: Add OpenAI

Get your API key at: https://platform.openai.com/api-keys

Add to `.env.local`:
```bash
OPENAI_API_KEY="sk-..."
```

Add to Vercel production:
```bash
echo "YOUR_OPENAI_API_KEY" | vercel env add OPENAI_API_KEY production
```

### 3. Optional: Add Google

Get your API key at: https://aistudio.google.com/app/apikey

Add to `.env.local`:
```bash
GOOGLE_AI_API_KEY="AI..."
```

Add to Vercel production:
```bash
echo "YOUR_GOOGLE_API_KEY" | vercel env add GOOGLE_AI_API_KEY production
```

### 4. Restart Dev Server

```bash
npm run dev
```

You'll see initialization logs:
```
✅ Anthropic provider registered
✅ OpenAI provider registered
✅ Google provider registered
🤖 AI Router initialized with 3 provider(s) and 10 model(s)
```

---

## Architecture

### Directory Structure
```
src/lib/ai-providers/
├── types.ts           # TypeScript interfaces
├── anthropic.ts       # Anthropic provider adapter
├── openai.ts          # OpenAI provider adapter
├── google.ts          # Google provider adapter
├── router.ts          # Multi-provider orchestration
└── index.ts           # Public exports
```

### How It Works

```
User Request
    ↓
Chat API (/api/chat)
    ↓
AI Router (aiRouter)
    ↓
Provider Adapter (Anthropic | OpenAI | Google)
    ↓
AI Model API
    ↓
Response + Usage Tracking
```

### Key Components

**1. Provider Adapters**
- Each provider has a dedicated adapter class
- Implements `AIProvider` interface
- Handles provider-specific API calls
- Normalizes responses to common format

**2. AI Router** (`src/lib/ai-providers/router.ts`)
- Manages all registered providers
- Routes requests to appropriate provider
- Handles fallback logic
- Provides unified API

**3. Chat API** (`src/app/api/chat/route.ts`)
- Uses AI Router instead of direct provider calls
- Automatically tracks usage across all providers
- Records provider information in usage logs

**4. Frontend** (`src/components/ui/claude-style-chat-input.tsx`)
- Shows all available models from all providers
- Displays provider badges (Anthropic, OpenAI, Google)
- Shows model-specific badges (Premium, Fastest, Cheapest, etc.)

---

## Credit Pricing

### Budget Tier (0.075-1 credit/1K tokens)
- Gemini 2.0 Flash: **0.075** (Cheapest!)
- Gemini 1.5 Flash: **0.075**
- GPT-4o Mini: **0.15**
- GPT-3.5 Turbo: **0.5**
- Claude Haiku 4.5: **1**

### Standard Tier (3-5 credits/1K tokens)
- Claude Sonnet 4.5: **3**
- GPT-4o: **5**

### Premium Tier (10-15 credits/1K tokens)
- GPT-4 Turbo: **10**
- Claude Opus 4.5: **15**

---

## Small Business Value Propositions

### 💰 **Cost Optimization**
Use expensive models only when needed:
- Quick tasks → Gemini Flash (0.075 credits/1K)
- Everyday work → Claude Sonnet (3 credits/1K)
- Complex reasoning → Claude Opus (15 credits/1K)

### 🔄 **Redundancy & Reliability**
If one provider has downtime, automatically switch to another.

### 🎯 **Best Tool for the Job**
- **Code generation** → GPT-4 Turbo
- **Long context analysis** → Claude Sonnet/Opus or Gemini Pro
- **Multimodal tasks** → GPT-4o or Gemini
- **Fast simple tasks** → Gemini Flash

### 📈 **Future-Proof**
New models automatically available as they're released.

### 🔐 **No Vendor Lock-In**
Not dependent on a single AI provider.

---

## Usage Examples

### For Developers

```typescript
import { aiRouter } from '@/lib/ai-providers';

// Chat with any model
const response = await aiRouter.chat('gpt-4o', {
  messages: [{ role: 'user', content: 'Explain quantum computing' }],
  maxTokens: 4096,
});

// Get all available models
const models = aiRouter.getAllModels();

// Estimate credits
const credits = aiRouter.estimateCredits('gemini-2.0-flash-exp', 1000);

// Get cheapest model
const cheapest = aiRouter.getCheapestModel();

// Get provider status
const status = aiRouter.getStatus();
```

### For Users

Users can select any model from the dropdown in the chat interface:
1. Click the model selector
2. See all available models organized by provider
3. View badges showing special features (Fastest, Cheapest, Premium, etc.)
4. Select the best model for their task

---

## Recommended Pricing Tiers

### **Starter ($29/month)**
- 20,000 credits
- Access to budget models (Gemini, GPT-3.5, Haiku)
- Perfect for solopreneurs

### **Professional ($99/month)**
- 80,000 credits
- Access to ALL models
- Priority support
- Target: Small teams (2-10 people)

### **Business ($299/month)**
- 300,000 credits
- All models + custom integrations
- Dedicated support
- API access
- Target: Growing businesses (10-50 people)

---

## Monitoring & Analytics

All usage is automatically tracked:
- Provider used
- Model used
- Tokens consumed
- Credits deducted
- Timestamp

View in `/settings/usage` dashboard.

---

## Adding New Providers

To add a new provider (e.g., Mistral, Cohere):

1. **Create provider adapter** (`src/lib/ai-providers/mistral.ts`)
```typescript
export class MistralProvider implements AIProvider {
  // Implement interface...
}
```

2. **Register in router** (`src/lib/ai-providers/router.ts`)
```typescript
const mistral = new MistralProvider();
if (mistral.isConfigured()) {
  this.registerProvider(mistral);
}
```

3. **Add environment variable**
```bash
MISTRAL_API_KEY="..."
```

4. **Update frontend model list** (optional, or fetch dynamically)

---

## Troubleshooting

### Models Not Showing Up

Check console for initialization logs:
```bash
npm run dev
```

Look for:
```
✅ Anthropic provider registered
⚠️  OpenAI provider not configured (missing OPENAI_API_KEY)
```

### API Key Issues

Verify environment variables:
```bash
# Local
cat .env.local | grep API_KEY

# Production (Vercel)
vercel env ls
```

### Model Not Found Error

Ensure you're using the full model ID:
- ✅ `claude-sonnet-4-5-20250929`
- ❌ `sonnet-4.5` (legacy, still supported for backward compatibility)

---

## Performance Considerations

- **Provider initialization** happens once at startup
- **Model routing** is near-instant (Map lookup)
- **No performance penalty** for multi-provider support
- **Fallback logic** can be enabled for high-availability needs

---

## Security

- API keys stored securely in environment variables
- Never exposed to frontend
- Each provider isolated in separate adapter
- Requests validated and authenticated at API level

---

## Future Enhancements

- [ ] **Auto-routing** - Automatically select cheapest/fastest model for task
- [ ] **Load balancing** - Distribute requests across providers
- [ ] **Cost analytics** - Track spending by provider
- [ ] **Model comparison** - A/B test different models
- [ ] **Custom pricing** - Negotiate rates with providers

---

## Support

For questions or issues:
- GitHub: https://github.com/yourusername/ai-layout-next/issues
- Email: support@yourdomain.com

---

**Built with ❤️ for small businesses**
