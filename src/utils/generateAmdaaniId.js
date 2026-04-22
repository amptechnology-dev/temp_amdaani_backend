import { Counter } from "../models/counter.model.js";

export const generateAmdaaniId = async (session) => {
  const counter = await Counter.findOneAndUpdate(
    { key: "amdaaniUserId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  const number = String(counter.seq).padStart(5, "0");

  return `AMD${number}`;
};