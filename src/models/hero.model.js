import mongoose from "mongoose";

const HeroSectionSchema = new mongoose.Schema(
  {
    phoneImage: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

export const HeroSection = mongoose.model("HeroSection", HeroSectionSchema);