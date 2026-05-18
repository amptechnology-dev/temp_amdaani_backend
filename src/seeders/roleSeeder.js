import mongoose from "mongoose";
import { Role } from "../models/role.model.js";
import { roles, permissions } from "../config/roles.js";

const seedRoles = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("MongoDB connected...");
        const roleData = [
            {
                name: roles.OWNER,
                permissions: [permissions.ALL],
            },
            {
                name: roles.SUPERADMIN,
                permissions: [permissions.ALL],
            },
            {
                name: roles.MANAGER,
                permissions: [permissions.ALL]
            },
            {
                name: roles.PARTNER,
                permissions: [permissions.ALL]
            },
            {
                name: roles.STAFF,
                permissions: [
                    permissions.CAN_MANAGE_PRODUCTS,
                    permissions.CAN_MANAGE_CATEGORIES,
                    permissions.CAN_MANAGE_STOCKS,
                    permissions.CAN_CANCEL_INVOICES,
                    permissions.CAN_VIEW_PURCHASES,
                    permissions.CAN_CREATE_INVOICES,
                    permissions.CAN_EDIT_INVOICES,
                    permissions.CAN_VIEW_INVOICES,
                ],
            },
        ];
        for (const role of roleData) {
            await Role.updateOne(
                { name: role.name },
                { $set: role },
                { upsert: true }
            );
        }
        console.log("Roles seeded successfully ✅");
        process.exit();
    } catch (error) {
        console.error("Seeder error ❌", error);
        process.exit(1);
    }
};

seedRoles();