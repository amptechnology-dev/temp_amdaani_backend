import { VendorPayment } from '../models/vendorPayment.model.js';

export const createVendorPayment = async (paymentData, session = null) => {
  const payment = new VendorPayment(paymentData);
  return await payment.save(session ? { session } : undefined);
};

export const getVendorPaymentsByPurchase = async (purchaseId) => {
  return VendorPayment.find({ purchase: purchaseId }).sort({ paymentDate: -1 });
};

export const updateVendorPaymentStatus = async (paymentId, status) => {
  return VendorPayment.findByIdAndUpdate(paymentId, { status }, { new: true });
};

export const getVendorPaymentsByStore = async (storeId, startDate, endDate) => {
  startDate = new Date(startDate);
  startDate.setHours(0, 0, 0, 0);
  endDate = new Date(endDate);
  endDate.setHours(23, 59, 59, 999);

  return VendorPayment.find({
    store: storeId,
    paymentDate: { $gte: startDate, $lte: endDate },
  })
    .populate('purchase', 'invoiceNumber vendorName vendorMobile')
    .sort({ paymentDate: -1 });
};

export const cancelVendorPayment = async (paymentId) => {
  return VendorPayment.findByIdAndUpdate(paymentId, { status: 'cancelled' }, { new: true });
};

export const deleteVendorPayment = async (paymentId) => {
  return await VendorPayment.findByIdAndDelete(paymentId).populate('purchase', 'totalAmount amountPaid amountDue');
};

export const cancelAllPaymentsForPurchase = async (purchaseId) => {
  return await VendorPayment.updateMany({ purchase: purchaseId }, { $set: { status: 'cancelled' } });
};
