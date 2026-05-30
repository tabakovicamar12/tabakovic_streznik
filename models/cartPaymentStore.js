const { runAsync, getAsync, allAsync } = require('../database/db');

const COMPLETED_STATUS = 'completed';

async function getUserById(userId) {
    return getAsync(`
        SELECT id, email, role
        FROM user
        WHERE id = ?
    `, [userId]);
}

async function getCompletedMaterialIds(buyerId, materialIds) {
    if (materialIds.length === 0) return [];

    const placeholders = materialIds.map(() => '?').join(', ');
    const rows = await allAsync(`
        SELECT material_id
        FROM purchase
        WHERE buyer_id = ?
          AND status = ?
          AND material_id IN (${placeholders})
    `, [buyerId, COMPLETED_STATUS, ...materialIds]);

    return rows.map(row => row.material_id);
}

async function getCompletedMaterialIdsByUser(buyerId) {
    const rows = await allAsync(`
        SELECT DISTINCT material_id
        FROM purchase
        WHERE buyer_id = ? AND status = ?
        ORDER BY material_id
    `, [buyerId, COMPLETED_STATUS]);

    return rows.map(row => row.material_id);
}

async function createPendingOrder(buyerId, materialIds, sessionId) {
    for (const materialId of materialIds) {
        await runAsync(`
            INSERT INTO purchase (buyer_id, material_id, stripe_session_id, status)
            VALUES (?, ?, ?, 'pending')
        `, [buyerId, materialId, sessionId]);
    }

    return getOrderBySessionId(sessionId);
}

async function getOrderBySessionId(sessionId) {
    return allAsync(`
        SELECT p.*, m.title AS material_title, m.thumbnail_price
        FROM purchase p
        LEFT JOIN material m ON m.id = p.material_id
        WHERE p.stripe_session_id = ?
        ORDER BY p.id
    `, [sessionId]);
}

async function completeOrder(sessionId) {
    await runAsync(`
        UPDATE purchase
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE stripe_session_id = ?
    `, [COMPLETED_STATUS, sessionId]);

    return getOrderBySessionId(sessionId);
}

async function hasCompletedPurchase(buyerId, materialId) {
    const purchase = await getAsync(`
        SELECT id
        FROM purchase
        WHERE buyer_id = ? AND material_id = ? AND status = ?
        LIMIT 1
    `, [buyerId, materialId, COMPLETED_STATUS]);

    return Boolean(purchase);
}

module.exports = {
    COMPLETED_STATUS,
    getUserById,
    getCompletedMaterialIds,
    getCompletedMaterialIdsByUser,
    createPendingOrder,
    getOrderBySessionId,
    completeOrder,
    hasCompletedPurchase
};
