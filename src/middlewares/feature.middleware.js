import expressAsyncHandler from 'express-async-handler';
import { storeHasFeature } from '../services/subscription.services.js';
import { ApiError } from '../utils/responseHandler.js';

const FEATURE_LABELS = {
  manageStaff: 'Manage Staff',
  stockManagement: 'Stock Management',
  orders: 'Orders',
  reports: 'Reports',
  purchaseManagement: 'Purchase Management',
};

export const requireFeature = (featureKey) =>
  expressAsyncHandler(async (req, res, next) => {
    if (req.user?.role?.name === 'super-admin') return next();

    const allowed = await storeHasFeature(req.user.store, featureKey);
    if (!allowed) {
      throw new ApiError(403, `${FEATURE_LABELS[featureKey] || featureKey} is not available in your plan`, [
        { source: 'plan', field: featureKey, message: 'FEATURE_LOCKED' },
      ]);
    }
    next();
  });