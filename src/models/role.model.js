import mongoose from 'mongoose';
import { roles, permissions } from '../config/roles.js';

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: Object.values(roles),
  },
  permissions: {
    type: [String],
    required: true,
    validate: {
      validator: function (v) {
        return v.every((permission) => Object.values(permissions).includes(permission));
      },
      message: (props) => `${props.value} contains invalid permission(s)`,
    },
  },
});

export const Role = mongoose.model('Role', roleSchema);
