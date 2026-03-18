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
                name: roles.STAFF,
                permissions: [
                    permissions.CAN_MANAGE_STORE,
                    permissions.CAN_MANAGE_PRODUCTS,
                    permissions.CAN_MANAGE_CATEGORIES,
                    permissions.CAN_MANAGE_SETTINGS,
                    permissions.CAN_MANAGE_STOCKS,
                    permissions.CAN_MANAGE_SUBSCRIPTIONS,
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