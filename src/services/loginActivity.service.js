import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';
import { LoginActivity } from '../models/loginActivity.model.js';

export const saveLoginActivity = async (
    userId,
    req
) => {
    try {
        const parser = new UAParser(req.headers['user-agent']);

        const ua = parser.getResult();

        const ip =
            req.headers['x-forwarded-for'] ||
            req.socket.remoteAddress;

        const geo = geoip.lookup(ip);

        await LoginActivity.create({
            user: userId,
            ipAddress: ip,

            browser: ua.browser.name,

            os: ua.os.name,

            device:
                ua.device.model ||
                ua.device.type ||
                'Desktop',

            location: {
                city: geo?.city || 'Unknown',
                country: geo?.country || 'Unknown',
            },

            loginAt: new Date(),
        });
    } catch (error) {
        console.log('Login activity error', error);
    }
};

export const getLoginHistoryService =
    async (
        userId,
        limit = 20
    ) => {

        const activities =
            await LoginActivity.find({
                user: userId,
            })
                .sort({
                    loginAt: -1,
                })
                .limit(limit);

        return activities;
    };