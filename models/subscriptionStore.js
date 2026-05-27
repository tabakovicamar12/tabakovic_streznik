const { db, runAsync, getAsync, allAsync } = require('../database/db');

async function subscribeToSubject(userId, subjectId) {
    try {
        const existing = await getAsync(
            'SELECT * FROM subscription WHERE user_id = ? AND subject_id = ?',
            [userId, subjectId]
        );

        if (existing) {
            return { error: 'Že ste naročeni na ta predmet' };
        }

        await runAsync(`
            INSERT INTO subscription (user_id, subject_id)
            VALUES (?, ?)
        `, [userId, subjectId]);

        return await getAsync(
            'SELECT * FROM subscription WHERE user_id = ? AND subject_id = ?',
            [userId, subjectId]
        );
    } catch (error) {
        console.error('Napaka pri naročanju:', error);
        throw error;
    }
}

async function unsubscribeFromSubject(userId, subjectId) {
    try {
        await runAsync(
            'DELETE FROM subscription WHERE user_id = ? AND subject_id = ?',
            [userId, subjectId]
        );
        return true;
    } catch (error) {
        console.error('Napaka pri odnaročanju:', error);
        throw error;
    }
}

async function getUserSubscriptions(userId) {
    try {
        return await allAsync(`
            SELECT s.*, sub.name as subject_name, u.name as university_name
            FROM subscription s
            LEFT JOIN subject sub ON s.subject_id = sub.id
            LEFT JOIN university u ON sub.university_id = u.id
            WHERE s.user_id = ?
            ORDER BY sub.name
        `, [userId]);
    } catch (error) {
        console.error('Napaka pri pridobivanju naročnin:', error);
        return [];
    }
}

async function getSubjectSubscribers(subjectId) {
    try {
        return await allAsync(`
            SELECT s.*, u.email, u.id as user_id
            FROM subscription s
            LEFT JOIN user u ON s.user_id = u.id
            WHERE s.subject_id = ?
            ORDER BY u.email
        `, [subjectId]);
    } catch (error) {
        console.error('Napaka pri pridobivanju naročnikov:', error);
        return [];
    }
}

async function isSubscribed(userId, subjectId) {
    try {
        const subscription = await getAsync(
            'SELECT * FROM subscription WHERE user_id = ? AND subject_id = ?',
            [userId, subjectId]
        );
        return !!subscription;
    } catch (error) {
        console.error('Napaka pri preverjanju naročnine:', error);
        return false;
    }
}

async function getSubscriptionStats(subjectId) {
    try {
        const result = await getAsync(
            'SELECT COUNT(*) as count FROM subscription WHERE subject_id = ?',
            [subjectId]
        );
        return {
            totalSubscribers: result?.count || 0
        };
    } catch (error) {
        console.error('Napaka pri pridobivanju statistike:', error);
        return {};
    }
}

module.exports = {
    subscribeToSubject,
    unsubscribeFromSubject,
    getUserSubscriptions,
    getSubjectSubscribers,
    isSubscribed,
    getSubscriptionStats
};
