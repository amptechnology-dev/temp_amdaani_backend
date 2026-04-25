import { Store } from "../models/store.model";

export const generateReferralCode = async (Store) => {
    let code;
    let exists = true;

    while (exists) {
        code = "STR-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        const store = await Store.findOne({ referralCode: code });
        if (!store) exists = false;
    }

    return code;
};