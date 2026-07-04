import expressAsyncHandler from "express-async-handler";
import mongoose from "mongoose";
import * as orderService from "../services/order.service.js";
import { ApiResponse, ApiError } from "../utils/responseHandler.js";
import pick from "../utils/pick.js";
import { updateUsage } from "../services/usage.service.js";
import { Role } from "../models/role.model.js";
import { roles } from "../config/roles.js";

export const createOrder = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  req.body.userId = req.user.id;

  const order = await orderService.createOrder(req.body);

  if (req.subscription) {
    await updateUsage(req.subscription._id, {
      $inc: {
        ordersUsed: 1,
      },
    });
  }

  return new ApiResponse(
    201,
    order,
    "Order created successfully"
  ).send(res);
});

export const updateOrder = expressAsyncHandler(async (req, res) => {
  const order = await orderService.updateOrder(req.params.id, req.body);

  if (!order) {
    throw new ApiError(404, "Order not found!", [
      {
        source: "params",
        field: "id",
        message: "Order not found",
      },
    ]);
  }

  return new ApiResponse(
    200,
    order,
    "Order updated successfully"
  ).send(res);
});

export const getOrderById = expressAsyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);

  if (!order) {
    throw new ApiError(404, "Order not found!", [
      {
        source: "params",
        field: "id",
        message: "Order not found",
      },
    ]);
  }

  return new ApiResponse(
    200,
    order,
    "Order fetched successfully"
  ).send(res);
});

export const getOrders = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, [
    "status",
    "customer",
    "orderNumber",
  ]);

  const options = pick(req.query, [
    "page",
    "limit",
    "sortBy",
    "order",
  ]);

  const { range } = req.query;

  filters.store = new mongoose.Types.ObjectId(req.user.store);

  const isStaff = req.user?.role?.name === roles.STAFF;

  if (isStaff) {
    filters.userId = new mongoose.Types.ObjectId(req.user._id);
  }

  const now = new Date();

  let startDate;
  let endDate;

  if (range === "thisMonth") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );
  }

  if (range === "previousMonth") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59
    );
  }

  if (range === "year") {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(
      now.getFullYear(),
      11,
      31,
      23,
      59,
      59
    );
  }

  if (startDate && endDate) {
    filters.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const orders = await orderService.queryOrders(filters, options);

  return new ApiResponse(
    200,
    orders,
    "Orders fetched successfully"
  ).send(res);
});

export const changeOrderStatus = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;

  const { status, cancelReason } = req.body;

  const order = await orderService.changeOrderStatus(
    id,
    status,
    req.user._id,
    cancelReason
  );

  if (!order) {
    throw new ApiError(404, "Order not found!", [
      {
        source: "params",
        field: "id",
        message: "Order not found",
      },
    ]);
  }

  return new ApiResponse(
    200,
    order,
    "Order status updated successfully"
  ).send(res);
});

export const createInvoiceFromOrder = expressAsyncHandler(async (req, res) => {
  const invoice = await orderService.createInvoiceFromOrder(
    req.params.orderId,
    req.user.store,
    req.user._id,
    req.body.invoiceNumber 
  );

  return new ApiResponse(
    201,
    invoice,
    "Invoice created successfully"
  ).send(res);
});