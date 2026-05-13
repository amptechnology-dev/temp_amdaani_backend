import mongoose from "mongoose";

const helplineSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
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