import mongoose from "mongoose";

const helplineSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      trim: true,
    },

    socialLinks: {
      facebook: {
        type: String,
        trim: true,
      },

      instagram: {
        type: String,
        trim: true,
      },

      youtube: {
        type: String,
        trim: true,
      },

      linkedin: {
        type: String,
        trim: true,
      },
    },

    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Helpline = mongoose.model("Helpline", helplineSchema);