import { NotificationSetting } from "../models/notificationSetting.model.js";

export const createSetting = async (payload) => {

  const existingSetting = await NotificationSetting.findOne({
    type: payload.type
  });

  if (existingSetting) {
    throw new Error("Notification setting already exists. Please update it instead.");
  }

  return NotificationSetting.create(payload);

};

export const getSettings = async () => {
  return NotificationSetting.find();
};

export const getSettingById = async (id) => {
  return NotificationSetting.findById(id);
};

export const updateSetting = async (id, payload) => {
  return NotificationSetting.findByIdAndUpdate(
    id,
    payload,
    { new: true }
  );
};

export const deleteSetting = async (id) => {
  return NotificationSetting.findByIdAndDelete(id);
};