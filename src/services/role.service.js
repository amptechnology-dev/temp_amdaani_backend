import { Role } from '../models/role.model.js';

export const getRoles = async () => {
  const roles = await Role.find({ name: 'staff' }).select('-permissions');
  return roles;
};
