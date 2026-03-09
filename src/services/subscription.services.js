import { Plan } from '../models/plan.model.js';
import { Subscription, Payment } from '../models/subscription.model.js';
import { ApiError } from '../utils/responseHandler.js';
import { buildPayuFormData } from '../utils/payu.js';
import { getStoreById } from './store.services.js';
import config from '../config/config.js';
import { validatePayuResponse } from '../utils/payu.js';
import { resetUsage } from '../services/usage.service.js';

export const getActivePlans = async () => {
  return Plan.find({ isActive: true });
};

export const createSubscription = async (data) => {
  const { planId, storeId } = data;
  const plan = await Plan.findById(planId);
  if (!plan) throw new ApiError(404, 'Plan not found');

  // First, check for existing active subscription
  const activeSubscription = await getCurrentSubscription(storeId);

  if (activeSubscription && activeSubscription.price > 0) {
    // If there's an active paid subscription, use createUpcomingSubscription
    return createUpcomingSubscription({
      planId,
      storeId,
    });
  }

  // Only cancel active subscription if we're not creating an upcoming one
  await Subscription.findOneAndUpdate({ store: storeId, status: 'active' }, { $set: { status: 'canceled' } });

  // Create new active subscription
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + plan.durationDays);

  return Subscription.create({
    store: storeId,
    plan: planId,
    planName: plan.name,
    price: plan.price,
    durationDays: plan.durationDays,
    baseUsageLimits: plan.usageLimits,
    startDate,
    endDate,
    status: 'active',
  });
};

export const createOrRenewFreePlan = async (storeId) => {
  const freePlan = await Plan.findOne({ price: 0, isActive: true });
  if (!freePlan) {
    throw new ApiError(404, 'Free plan not found');
  }

  const today = new Date();
  let subscription = await Subscription.findOne({
    store: storeId,
    plan: freePlan._id,
  });
  if (subscription) {
    if (subscription.status === 'active' && subscription.endDate >= today) return { subscription, renewed: false };
  }
  // Renew: update existing subscription
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + freePlan.durationDays);

  const newSubscription = await Subscription.findOneAndUpdate(
    { store: storeId, plan: freePlan._id },
    {
      planName: freePlan.name,
      price: freePlan.price,
      durationDays: freePlan.durationDays,
      baseUsageLimits: freePlan.usageLimits,
      startDate,
      endDate,
      status: 'active',
    },
    { upsert: true, new: true }
  );

  return { subscription: newSubscription, renewed: true };
};

/**
 * Initiate payment
 * @param {ObjectId} planId - Plan ID
 * @param {ObjectId} storeId - Store ID
 * @param {string} type - Payment type: 'subscription' or 'topup'
 * @returns {Promise<{ txnid: string, paymentUrl: string, formData: Object }>} Payment details
 * @throws {Error} If plan or store not found
 */
export const initiatePayment = async (planId, storeId) => {
  try {
    if (!planId || !storeId) {
      throw new Error('Missing required fields');
    }
    const [plan, store] = await Promise.all([Plan.findById(planId), getStoreById(storeId)]);
    if (!plan || !store) {
      throw new Error('Plan or store not found');
    }

    // Generate unique txnid
    const txnid = 'txn_' + Date.now();
    const baseUrl = config.appBaseUrl;

    const amountWithGst = plan.price + plan.price * 0.18;
    const formData = buildPayuFormData({
      txnid,
      amount: amountWithGst.toFixed(2),
      productinfo: plan.name,
      firstname: store.name,
      email: store.email,
      phone: store.contactNo,
      surl: `${baseUrl}/api/subscription/verify-payment`,
      furl: `${baseUrl}/api/subscription/verify-payment`,
      udf1: plan._id || '',
      udf2: store._id || '',
      udf3: plan.planType || '',
    });

    await Payment.create({
      store: storeId,
      subscription: null,
      amount: amountWithGst.toFixed(2),
      currency: 'INR',
      method: 'PayU',
      transactionId: txnid,
      status: 'pending',
    });

    const paymentUrl = config.payu.testMode ? 'https://test.payu.in/_payment' : 'https://secure.payu.in/_payment';

    return { txnid, paymentUrl, formData };
  } catch (error) {
    throw new Error(error);
  }
};

export const verifyAndCreateSubscription = async (paymentResponse) => {
  try {
    const isValid = validatePayuResponse(paymentResponse);
    if (!isValid) throw new ApiError(400, 'Invalid payment response');

    if (paymentResponse.status === 'success') {
      const paymentType = paymentResponse.udf3 || 'subscription';
      let subscription;

      if (paymentType === 'topup') {
        const storeId = paymentResponse.udf2;

        // Check if store has active subscription
        const activeSubscription = await getCurrentSubscription(storeId);
        if (!activeSubscription || activeSubscription.price === 0) {
          throw new ApiError(400, 'Cannot topup without active subscription or free plan');
        }

        subscription = await applyTopUp(activeSubscription._id, paymentResponse.udf1);
      } else {
        // Create new subscription
        subscription = await createSubscription({
          planId: paymentResponse.udf1,
          storeId: paymentResponse.udf2,
        });
        await resetUsage(subscription._id);
      }

      const payment = await Payment.findOneAndUpdate(
        { transactionId: paymentResponse.txnid },
        {
          $set: {
            subscription: subscription._id,
            status: 'success',
            paidAt: new Date(),
            method: `PayU - ${paymentResponse.mode}`,
          },
        },
        { new: true }
      );
      if (!payment) {
        await Subscription.findByIdAndDelete(subscription._id);
        throw new ApiError(400, 'Payment Verification Failed!', [
          { message: 'Payment not found with transaction ID.' },
        ]);
      }
      return subscription;
    } else {
      await Payment.findOneAndUpdate(
        { transactionId: paymentResponse.txnid },
        { $set: { status: 'failed', notes: paymentResponse.error_Message } },
        { new: true }
      );
      return null;
    }
  } catch (error) {
    throw error;
  }
};

export const getCurrentSubscription = async (storeId) => {
  const subscription = await Subscription.findOne({
    store: storeId,
    status: 'active',
    endDate: { $gte: new Date() },
  }).populate('plan');
  return subscription;
};

export const updateSubscription = async (subscriptionId, data) => {
  return Subscription.findByIdAndUpdate(subscriptionId, data, { new: true });
};

export const getPayments = async (storeId) => {
  return Payment.find({ store: storeId }).populate('subscription').lean();
};

async function applyTopUp(subscriptionId, topUpPlanId) {
  const subscription = await Subscription.findById(subscriptionId);
  const topUpPlan = await Plan.findById(topUpPlanId);

  if (topUpPlan.planType !== 'topup') {
    throw new Error('Selected plan is not a top-up');
  }

  subscription.topUps.push({
    plan: topUpPlanId,
    appliedAt: new Date(),
    // expiresAt: subscription.endDate, //NOTE: Topup expires at subscription end date so no need to set expiresAt
    usageLimits: topUpPlan.usageLimits,
  });

  return subscription.save();
}

export const getLastSubscription = async (storeId) => {
  const subscription = await Subscription.findOne({
    store: storeId,
    status: { $in: ['expired', 'canceled'] },
  })
    .sort({ endDate: -1 })
    .limit(1)
    .populate('plan');
  return subscription;
};

const createUpcomingSubscription = async (data) => {
  const { planId, storeId } = data;
  const plan = await Plan.findById(planId);
  if (!plan) throw new ApiError(404, 'Plan not found');

  // Fetch current active subscription
  const activeSubscription = await getCurrentSubscription(storeId);
  if (!activeSubscription) {
    throw new ApiError(400, 'Cannot create upcoming subscription without an active subscription');
  }

  let startDate = new Date(activeSubscription.endDate);
  startDate.setDate(startDate.getDate() + 1); // Move to next day
  startDate.setHours(0, 0, 0, 0); // Set to start of day
  let endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + plan.durationDays);
  const lastUpcomingSubscription = await getUpcomingSubscriptions(storeId);
  if (lastUpcomingSubscription.length > 0) {
    startDate = new Date(lastUpcomingSubscription[lastUpcomingSubscription.length - 1].endDate);
    startDate.setDate(startDate.getDate() + 1); // Move to next day
    startDate.setHours(0, 0, 0, 0); // Set to start of day
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + plan.durationDays);
  }

  return Subscription.create({
    store: storeId,
    plan: planId,
    planName: plan.name,
    price: plan.price,
    durationDays: plan.durationDays,
    baseUsageLimits: plan.usageLimits,
    startDate,
    endDate,
    status: 'upcoming',
  });
};

export const getUpcomingSubscriptions = async (storeId) => {
  const subscription = await Subscription.find({
    store: storeId,
    status: 'upcoming',
  }).populate('plan');
  return subscription;
};
