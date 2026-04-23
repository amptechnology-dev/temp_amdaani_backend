import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema({
  store: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: "Store"
  },
  fcmToken: String
});

export const Device = mongoose.model("Device", DeviceSchema);