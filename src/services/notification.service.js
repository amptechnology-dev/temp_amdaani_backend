import admin from "firebase-admin";
import { Device } from "../models/device.model.js";

export const sendPushNotification = async (storeId, title, body) => {

  const devices = await Device.find({ store: storeId });

  const tokens = devices.map(d => d.fcmToken);

  if (!tokens.length) return;

  const message = {
    notification: {
      title,
      body
    },
    tokens
  };

  await admin.messaging().sendEachForMulticast(message);
};