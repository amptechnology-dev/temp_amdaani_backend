import { Role } from '../models/role.model.js';

export const getRoles = async () => {
  const roles = await Role.find({
    name: { $nin: ['owner', 'super-admin'] },
  }).select('-permissions');
  const formattedRoles = roles.map((role) => {
    const roleObj = role.toObject();
    roleObj.name =
      roleObj.name.charAt(0).toUpperCase() + roleObj.name.slice(1);
    return roleObj;
  });
  return formattedRoles;
};
