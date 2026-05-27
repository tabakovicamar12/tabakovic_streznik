const { db, runAsync, getAsync, allAsync } = require('../database/db');

async function subscribe(uporabnikId, subscription) {
    try {
        await runAsync(`
            INSERT INTO push_subscription (user_id, endpoint, expiration_time, p256dh, auth, active)
            VALUES (?, ?, ?, ?, ?, 1)
        `, [uporabnikId, subscription.endpoint, subscription.expirationTime, subscription.keys?.p256dh, subscription.keys?.auth]);

        return await getAsync('SELECT * FROM push_subscription WHERE user_id = ? ORDER BY id DESC LIMIT 1', [uporabnikId]);
    } catch (error) {
        throw error;
    }
}

async function getSubscriptionsByUserId(uporabnikId) {
    try {
        return await allAsync('SELECT * FROM push_subscription WHERE user_id = ? AND active = 1', [uporabnikId]);
    } catch (error) {
        return [];
    }
}

async function getAllActiveSubscriptions() {
    try {
        return await allAsync('SELECT * FROM push_subscription WHERE active = 1');
    } catch (error) {
        return [];
    }
}

async function unsubscribe(subscriptionId) {
    try {
        await runAsync('UPDATE push_subscription SET active = 0 WHERE id = ?', [subscriptionId]);
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    subscribe,
    getSubscriptionsByUserId,
    getAllActiveSubscriptions,
    unsubscribe
};