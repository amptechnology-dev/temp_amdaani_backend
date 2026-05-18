import { UserTracking } from '../models/userTracking.model.js';
import { User } from '../models/user.model.js';

export const getUserTrackingDashboard =
  async () => {

    // ----------------------------------
    // Today date range
    // ----------------------------------
    const todayStart =
      new Date();

    todayStart.setHours(
      0,
      0,
      0,
      0
    );

    const todayEnd =
      new Date();

    todayEnd.setHours(
      23,
      59,
      59,
      999
    );

    // ==================================
    // 1. VERIFIED BUT NOT REGISTERED
    // ==================================
    const verifiedNotRegistered =
      await UserTracking.find({
        otpVerified: true,
        registered: false,
      })
        .select(
          'contactNo otpVerifiedAt createdAt'
        )
        .sort({
          createdAt: -1,
        });

    const todayVerifiedNotRegisteredCount =
      await UserTracking.countDocuments(
        {
          otpVerified: true,
          registered: false,
          otpVerifiedAt: {
            $gte:
              todayStart,
            $lte:
              todayEnd,
          },
        }
      );

    // ==================================
    // 2. REGISTERED BUT NO PLAN
    // ==================================
    const registeredNoPlanTracking =
      await UserTracking.find({
        registered: true,
        planPurchased: false,
        userId: {
          $exists: true,
        },
      }).select(
        'userId registeredAt'
      );

    const registeredNoPlanIds =
      registeredNoPlanTracking.map(
        (item) =>
          item.userId
      );

    const registeredNoPlanUsers =
      await User.find({
        _id: {
          $in:
            registeredNoPlanIds,
        },
      })
        .populate(
          'store'
        )
        .populate(
          'role'
        )
        .sort({
          createdAt: -1,
        });

    const todayRegisteredNoPlanCount =
      await UserTracking.countDocuments(
        {
          registered: true,
          planPurchased: false,
          registeredAt: {
            $gte:
              todayStart,
            $lte:
              todayEnd,
          },
        }
      );

    // ==================================
    // 3. REGISTERED + PLAN PURCHASED
    // ==================================
    const registeredWithPlanTracking =
      await UserTracking.find({
        registered: true,
        planPurchased: true,
        userId: {
          $exists: true,
        },
      }).select(
        'userId planPurchasedAt'
      );

    const registeredWithPlanIds =
      registeredWithPlanTracking.map(
        (item) =>
          item.userId
      );

    const registeredWithPlanUsers =
      await User.find({
        _id: {
          $in:
            registeredWithPlanIds,
        },
      })
        .populate(
          'store'
        )
        .populate(
          'role'
        )
        .sort({
          createdAt: -1,
        });

    const todayRegisteredWithPlanCount =
      await UserTracking.countDocuments(
        {
          registered: true,
          planPurchased: true,
          planPurchasedAt:
            {
              $gte:
                todayStart,
              $lte:
                todayEnd,
            },
        }
      );

    // ==================================
    // RESPONSE
    // ==================================
    return {

      verifiedNotRegistered:
        {
          count:
            verifiedNotRegistered.length,

          todayCount:
            todayVerifiedNotRegisteredCount,

          data:
            verifiedNotRegistered.map(
              (
                item
              ) => ({
                phone:
                  item.contactNo,

                otpVerifiedAt:
                  item.otpVerifiedAt,
              })
            ),
        },

      registeredNoPlan:
        {
          count:
            registeredNoPlanUsers.length,

          todayCount:
            todayRegisteredNoPlanCount,

          data:
            registeredNoPlanUsers,
        },

      registeredWithPlan:
        {
          count:
            registeredWithPlanUsers.length,

          todayCount:
            todayRegisteredWithPlanCount,

          data:
            registeredWithPlanUsers,
        },
    };
  };