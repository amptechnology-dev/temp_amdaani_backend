import mongoose from 'mongoose';

const userStoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.SchemaTypes.ObjectId, ref: 'User', required: true },
    store: { type: mongoose.SchemaTypes.ObjectId, ref: 'Store', required: true },
    role: { type: mongoose.SchemaTypes.ObjectId, ref: 'Role', required: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userStoreSchema.index({ user: 1, store: 1 }, { unique: true });

export const UserStore = mongoose.model('UserStore', userStoreSchema);