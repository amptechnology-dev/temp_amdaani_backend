import mongoose from "mongoose";

const statSchema = new mongoose.Schema(
  {
    number: { type: String, required: true },
    label: { type: String, required: true },
    icon: { type: String, required: true },
  },
  { _id: false }
);

const valueSchema = new mongoose.Schema(
  {
    icon: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    color: { type: String },
  },
  { _id: false }
);

const aboutSchema = new mongoose.Schema(
  {
    badgeTitle: { type: String, default: "About Amdaani" },

    heading: { type: String, required: true },

    highlightText: { type: String },

    description: { type: String },

    stats: [statSchema],

    missionTitle: { type: String },

    missionDescription: { type: String },

    missionPoints: [{ type: String }],

    values: [valueSchema],

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const About = mongoose.model("About", aboutSchema);