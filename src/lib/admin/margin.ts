import { prisma } from '@/lib/prisma';
import { aiRouter } from '@/lib/ai-providers';
import { getPriceTier } from '@/lib/pricing-config';
import { getPlanById } from '@/lib/plans';

export interface ModelMarginRow {
  model: string;
  provider: string | null;
  requests: number;
  creditsCharged: number;
  realCost: number;
  impliedRevenue: number;
  /** cost / creditsCharged — the minimum $-per-credit rate needed to break even on this model */
  breakEvenRatePerCredit: number | null;
}

export interface CustomerMarginRow {
  userId: string;
  name: string | null;
  email: string | null;
  plan: string;
  creditsCharged: number;
  realCost: number;
  impliedRevenue: number;
}

export interface MarginReport {
  periodDays: number;
  generatedAt: string;
  totals: {
    requests: number;
    creditsCharged: number;
    realCost: number;
    impliedRevenue: number;
    impliedMargin: number; // impliedRevenue - realCost
  };
  byModel: ModelMarginRow[];
  topCustomersByCost: CustomerMarginRow[];
  caveats: string[];
}

/**
 * "Implied revenue" is a heuristic, not a ledger of actual dollars: it
 * multiplies credits charged for a piece of usage by the $-per-credit rate
 * implied by the user's current plan/tier price. A flat-fee subscriber who
 * doesn't use their whole allowance doesn't literally generate this revenue
 * per-request — this answers "at this plan's price, was this usage worth
 * more or less than it cost us to deliver," which is the actual margin
 * question that matters before scaling a tier or adding a model.
 */
function ratePerCreditForUser(user: { plan: string; monthlyCredits: number }): number {
  const tier = getPriceTier(user.monthlyCredits);
  if (tier && tier.monthlyPrice > 0 && tier.credits > 0) {
    return tier.monthlyPrice / tier.credits;
  }

  const plan = getPlanById(user.plan);
  if (plan && plan.price > 0 && plan.credits > 0) {
    return plan.price / plan.credits;
  }

  return 0; // free plan, or no matching paid tier — no implied revenue
}

function extractTokenSplit(
  metadata: unknown,
  totalTokens: number
): { inputTokens: number; outputTokens: number; estimated: boolean } {
  if (metadata && typeof metadata === 'object') {
    const meta = metadata as Record<string, unknown>;
    if (typeof meta.inputTokens === 'number' && typeof meta.outputTokens === 'number') {
      return { inputTokens: meta.inputTokens, outputTokens: meta.outputTokens, estimated: false };
    }
  }
  // No recorded split (e.g. non-chat usage types) — assume an even split.
  // Flagged via `estimated` so the report can disclose how much of the
  // cost figure rests on this assumption rather than real data.
  return { inputTokens: totalTokens / 2, outputTokens: totalTokens / 2, estimated: true };
}

export async function getMarginReport(periodDays: number = 30): Promise<MarginReport> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const records = await prisma.usageRecord.findMany({
    where: { createdAt: { gte: since }, model: { not: null } },
    select: { userId: true, model: true, tokens: true, credits: true, metadata: true },
  });

  const userIds = Array.from(new Set(records.map((r) => r.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, plan: true, monthlyCredits: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const modelRows = new Map<string, ModelMarginRow>();
  const customerRows = new Map<string, CustomerMarginRow>();

  let estimatedSplitCount = 0;
  const unpricedModels = new Set<string>();

  for (const record of records) {
    const modelId = record.model!;
    const modelInfo = aiRouter.getModel(modelId);
    const user = userById.get(record.userId);
    const rate = user ? ratePerCreditForUser(user) : 0;
    const impliedRevenue = record.credits * rate;

    let cost = 0;
    if (modelInfo) {
      const { inputTokens, outputTokens, estimated } = extractTokenSplit(record.metadata, record.tokens);
      if (estimated) estimatedSplitCount++;
      cost =
        (inputTokens / 1_000_000) * modelInfo.inputCostPer1M +
        (outputTokens / 1_000_000) * modelInfo.outputCostPer1M;
    } else {
      unpricedModels.add(modelId);
    }

    const modelRow = modelRows.get(modelId) ?? {
      model: modelId,
      provider: modelInfo?.provider ?? null,
      requests: 0,
      creditsCharged: 0,
      realCost: 0,
      impliedRevenue: 0,
      breakEvenRatePerCredit: null,
    };
    modelRow.requests += 1;
    modelRow.creditsCharged += record.credits;
    modelRow.realCost += cost;
    modelRow.impliedRevenue += impliedRevenue;
    modelRows.set(modelId, modelRow);

    if (user) {
      const customerRow = customerRows.get(user.id) ?? {
        userId: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        creditsCharged: 0,
        realCost: 0,
        impliedRevenue: 0,
      };
      customerRow.creditsCharged += record.credits;
      customerRow.realCost += cost;
      customerRow.impliedRevenue += impliedRevenue;
      customerRows.set(user.id, customerRow);
    }
  }

  for (const row of modelRows.values()) {
    row.breakEvenRatePerCredit = row.creditsCharged > 0 ? row.realCost / row.creditsCharged : null;
  }

  const byModel = Array.from(modelRows.values()).sort((a, b) => b.realCost - a.realCost);
  const topCustomersByCost = Array.from(customerRows.values())
    .sort((a, b) => b.realCost - a.realCost)
    .slice(0, 15);

  const totals = byModel.reduce(
    (acc, row) => ({
      requests: acc.requests + row.requests,
      creditsCharged: acc.creditsCharged + row.creditsCharged,
      realCost: acc.realCost + row.realCost,
      impliedRevenue: acc.impliedRevenue + row.impliedRevenue,
      impliedMargin: 0,
    }),
    { requests: 0, creditsCharged: 0, realCost: 0, impliedRevenue: 0, impliedMargin: 0 }
  );
  totals.impliedMargin = totals.impliedRevenue - totals.realCost;

  const caveats: string[] = [];
  if (estimatedSplitCount > 0) {
    caveats.push(
      `${estimatedSplitCount} of ${records.length} record(s) had no recorded input/output token split and used an estimated 50/50 split for cost calculation.`
    );
  }
  if (unpricedModels.size > 0) {
    caveats.push(
      `${unpricedModels.size} model(s) have no configured cost data and are excluded from cost totals: ${Array.from(unpricedModels).join(', ')}`
    );
  }
  caveats.push(
    "'Implied revenue' is credits charged x the $/credit rate implied by each user's plan price — not a record of actual dollars billed per request."
  );

  return {
    periodDays,
    generatedAt: new Date().toISOString(),
    totals,
    byModel,
    topCustomersByCost,
    caveats,
  };
}
