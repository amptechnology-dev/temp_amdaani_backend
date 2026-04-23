import cron from "node-cron";
import { Subscription } from "../models/subscription.model.js";
import { NotificationSetting } from "../models/NotificationSetting.model.js";
import { sendPushNotification } from "../services/notification.service.js";

cron.schedule("0 9 * * *", async () => {
    console.log("Running subscription notification job");

    const setting = await NotificationSetting.findOne({
        type: "subscription_expiry",
        enabled: true,
    });

    if (!setting) return;

    const today = new Date();

    for (const day of setting.daysBefore) {

        const targetDate = new Date();
        targetDate.setDate(today.getDate() + day);

        const subscriptions = await Subscription.find({
            endDate: {
                $gte: new Date(targetDate.setHours(0, 0, 0)),
                $lte: new Date(targetDate.setHours(23, 59, 59))
            }
        }).populate("store");

        for (const sub of subscriptions) {

            let message = "";

            if (day > 0) {
                message = `Your subscription will expire in ${day} days`;
            }
            else if (day === 0) {
                message = `Your subscription expires today`;
            }
            else {
                message = `Your subscription has expired`;
            }

            await sendPushNotification(
                sub.store,
                "Subscription Alert",
                message
            );

        }
    }

});