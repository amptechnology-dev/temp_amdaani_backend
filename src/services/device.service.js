import { Device } from "../models/device.model.js";

export const registerDevice = async (storeId, fcmToken) => {

    const device = await Device.findOneAndUpdate(
        { fcmToken },
        {
            store: storeId,
            fcmToken
        },
        {
            upsert: true,
            new: true
        }
    );

    return device;

};