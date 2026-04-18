import mongoose from "mongoose";

const featureSchema = new mongoose.Schema(
  {
    icon: { type: String, required: true }, 
    text: { type: String, required: true },
  },
  { _id: false }
);

const HeroSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, required: true },

    description: { type: String, required: true },

    logoUrl: { type: String }, 
    phoneImage: { type: String, required: true },

    gradient: { type: String, required: true }, 

    features: [featureSchema],

    priority: { type: Number, default: 0 }, 

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const HeroSection = mongoose.model("HeroSection", HeroSectionSchema);