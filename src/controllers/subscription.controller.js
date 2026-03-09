import expressAsyncHandler from 'express-async-handler';
import * as subscriptionService from '../services/subscription.services.js';
import { getUsage, resetUsage } from '../services/usage.service.js';
import { ApiResponse } from '../utils/responseHandler.js';
// import pick from '../utils/pick.js';

export const getActivePlans = expressAsyncHandler(async (req, res) => {
  const plans = await subscriptionService.getActivePlans();
  return new ApiResponse(200, plans, 'Plans fetched successfully!').send(res);
});
export const createOrRenewFreePlan = expressAsyncHandler(async (req, res) => {
  const subscription = await subscriptionService.createOrRenewFreePlan(req.user.store);
  if (subscription.renewed) await resetUsage(subscription.subscription._id);
  return new ApiResponse(200, subscription, 'Subscription created successfully!').send(res);
});
export const initiatePayment = expressAsyncHandler(async (req, res) => {
  const payment = await subscriptionService.initiatePayment(req.body.planId, req.user.store);
  return new ApiResponse(200, payment, 'Payment initiated successfully!').send(res);
});
export const verifyPayment = expressAsyncHandler(async (req, res) => {
  const subscription = await subscriptionService.verifyAndCreateSubscription(req.body);
  if (!subscription) {
    return res.redirect(`billing://payment-failure?txnid=${req.body.txnid}&amount=${req.body.amount}&status=failure`);
    //     return res.send(`
    //     <html>
    //      <head>
    //         <meta http-equiv="refresh" content="0;url=billing://payment-success?txnid=${req.body.txnid}&amount=${req.body.amount}&status=success" />
    //       </head>
    //         <body>
    //             Redirecting...
    //         </body>
    //     </html>
    // `);
  }
  // return new ApiResponse(200, subscription, 'Payment verified successfully!').send(res);
  return res.redirect(`billing://payment-success?txnid=${req.body.txnid}&amount=${req.body.amount}&status=success`);
});
export const getActiveSubscription = expressAsyncHandler(async (req, res) => {
  const subscription = await subscriptionService.getCurrentSubscription(req.user.store);
  if (!subscription) return new ApiResponse(200, null, 'No active subscription found for this store!').send(res);

  const usage = await getUsage(subscription._id);
  return new ApiResponse(200, { subscription, usage }, 'Subscription fetched successfully!').send(res);
});
export const getPayments = expressAsyncHandler(async (req, res) => {
  const payments = await subscriptionService.getPayments(req.user.store);
  return new ApiResponse(200, payments, 'Payments fetched successfully!').send(res);
});
export const getLastSubscription = expressAsyncHandler(async (req, res) => {
  const subscription = await subscriptionService.getLastSubscription(req.user.store);
  return new ApiResponse(200, subscription, 'Subscription fetched successfully!').send(res);
});
export const getUpcomingSubscriptions = expressAsyncHandler(async (req, res) => {
  const subscriptions = await subscriptionService.getUpcomingSubscriptions(req.user.store);
  return new ApiResponse(200, subscriptions, 'Subscriptions fetched successfully!').send(res);
});
