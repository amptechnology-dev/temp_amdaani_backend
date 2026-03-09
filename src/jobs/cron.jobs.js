import Baker from 'cronbake';
import { Subscription } from '../models/subscription.model';
import logger from '../config/logger';

const baker = Baker.create();

// Check subscriptions
baker.add({
  name: 'checkSubscriptions',
  cron: '@daily',
  callback: async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Expire old subscriptions
    const expired = await Subscription.updateMany(
      { endDate: { $lt: today }, status: 'active' },
      { $set: { status: 'expired' } }
    );

    // Activate upcoming subscriptions
    const activated = await Subscription.updateMany(
      { startDate: { $lte: today }, endDate: { $gte: today }, status: 'upcoming' },
      { $set: { status: 'active' } }
    );

    logger.info(`Subscription Checked: Expired ${expired.modifiedCount}, Activated ${activated.modifiedCount}`);
  },
  onError: (error) => {
    logger.error('Subscription Check Error:', error);
  },
});

export default baker;
