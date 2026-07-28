// services/planContextService.js
import { Plan } from '../models/plan.model.js';

let cachedContext = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const formatPrice = (price, currency) => {
  if (!price || price === 0) return 'Free';
  return `${currency || 'INR'} ${price}`;
};

const formatPlanForAI = (plan) => {
  const lines = [];

  lines.push(`Plan Name: ${plan.name}`);
  lines.push(`Type: ${plan.planType === 'topup' ? 'Top-up (add-on)' : 'Regular subscription'}`);
  lines.push(`Price: ${formatPrice(plan.price, plan.currency)}`);
  lines.push(`Duration: ${plan.durationDays} day(s)`);

  if (plan.description) {
    lines.push(`Description: ${plan.description}`);
  }

  if (plan.usageLimits) {
    const invoiceLimit = plan.usageLimits.unlimited
      ? 'Unlimited invoices'
      : `Up to ${plan.usageLimits.invoices ?? 'N/A'} invoices`;
    lines.push(`Invoice Limit: ${invoiceLimit}`);
  }

  if (Array.isArray(plan.features) && plan.features.length > 0) {
    const featureLines = plan.features.map((feature) => {
      const status = feature.available ? '✓ Included' : '✗ Not included';
      const note = feature.note ? ` (${feature.note})` : '';
      return `  - ${feature.name}: ${status}${note}`;
    });
    lines.push(`Features:\n${featureLines.join('\n')}`);
  }

  return lines.join('\n');
};

export const getPlanContextForAI = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();

  if (!forceRefresh && cachedContext && cacheExpiresAt > now) {
    return cachedContext;
  }

  const plans = await Plan.find({ isActive: true }).sort({ price: 1 }).lean();

  if (!plans.length) {
    cachedContext =
      'No active pricing plans are currently available in the system.';
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedContext;
  }

  const regularPlans = plans.filter((plan) => plan.planType !== 'topup');
  const topupPlans = plans.filter((plan) => plan.planType === 'topup');

  const sections = [];

  sections.push(
    'You have access to the following CURRENT and ACCURATE Amdaani pricing plans. ' +
      'Always use this data when answering questions about pricing, plans, or which ' +
      'plan suits a user. Do NOT invent prices or features that are not listed here. ' +
      'When a user asks which plan is best for them, ask (or infer from context) their ' +
      'monthly invoice volume / business size, then recommend the most cost-effective ' +
      'plan that covers their invoice limit, explaining the reasoning briefly.'
  );

  if (regularPlans.length) {
    sections.push(
      '--- REGULAR SUBSCRIPTION PLANS ---\n' +
        regularPlans.map(formatPlanForAI).join('\n\n')
    );
  }

  if (topupPlans.length) {
    sections.push(
      '--- TOP-UP / ADD-ON PLANS (purchased on top of a regular plan) ---\n' +
        topupPlans.map(formatPlanForAI).join('\n\n')
    );
  }

  cachedContext = sections.join('\n\n');
  cacheExpiresAt = now + CACHE_TTL_MS;

  return cachedContext;
};

export const invalidatePlanContextCache = () => {
  cachedContext = null;
  cacheExpiresAt = 0;
};