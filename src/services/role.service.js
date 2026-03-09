import { Role } from '../models/role.model.js';

export const getRoles = async () => {
  return Role.find();
};
