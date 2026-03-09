import { getCurrentSubscription } from '../services/subscription.services.js';
import { ApiError } from '../utils/responseHandler.js';

export const checkActiveSubscription = async (req, res, next) => {
  const subscription = await getCurrentSubscription(req.user.store);
  if (!subscription || subscription.status !== 'active' || subscription.endDate < new Date()) {
    throw new ApiError(403, 'Subscription expired!');
  }
  req.subscription = subscription;
  next();
};
