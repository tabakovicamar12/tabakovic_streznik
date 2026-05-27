const { db, runAsync, getAsync, allAsync } = require('../database/db');

async function createPurchase(buyerId, materialId, amount, stripeSessionId = null) {
    try {
        await runAsync(`
            INSERT INTO purchase (buyer_id, material_id, stripe_session_id, status)
            VALUES (?, ?, ?, 'pending')
        `, [buyerId, materialId, stripeSessionId]);

        const purchase = await getAsync(
            'SELECT * FROM purchase WHERE buyer_id = ? AND material_id = ? ORDER BY created_at DESC LIMIT 1',
            [buyerId, materialId]
        );
        return purchase;
    } catch (error) {
        throw error;
    }
}

async function getPurchasesByUserId(buyerId) {
    try {
        return await allAsync(`
            SELECT p.*, m.title as material_title, m.thumbnail_price
            FROM purchase p
            LEFT JOIN material m ON p.material_id = m.id
            WHERE p.buyer_id = ? AND p.status IN ('completed', 'confirmed')
            ORDER BY p.created_at DESC
        `, [buyerId]);
    } catch (error) {
        return [];
    }
}

async function getPurchaseById(purchaseId) {
    try {
        return await getAsync(`
            SELECT p.*, m.title as material_title, m.file_path, u.email as buyer_email
            FROM purchase p
            LEFT JOIN material m ON p.material_id = m.id
            LEFT JOIN user u ON p.buyer_id = u.id
            WHERE p.id = ?
        `, [purchaseId]);
    } catch (error) {
        return null;
    }
}

async function updatePurchaseStatus(purchaseId, status) {
    try {
        await runAsync(
            'UPDATE purchase SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, purchaseId]
        );
        return await getPurchaseById(purchaseId);
    } catch (error) {
        throw error;
    }
}

async function getPurchaseBySessionId(sessionId) {
    try {
        return await getAsync(
            'SELECT * FROM purchase WHERE stripe_session_id = ?',
            [sessionId]
        );
    } catch (error) {
        return null;
    }
}

async function recordDownload(purchaseId) {
    try {
        await runAsync(
            'UPDATE purchase SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, purchaseId]
        );
        return await getPurchaseById(purchaseId);
    } catch (error) {
        throw error;
    }
}

async function getAllPurchases(filters = {}) {
    try {
        let query = `
            SELECT p.*, m.title as material_title, u.email as buyer_email, s.name as subject_name
            FROM purchase p
            LEFT JOIN material m ON p.material_id = m.id
            LEFT JOIN user u ON p.buyer_id = u.id
            LEFT JOIN subject s ON m.subject_id = s.id
            WHERE 1=1
        `;
        let params = [];

        if (filters.status) {
            query += ' AND p.status = ?';
            params.push(filters.status);
        }

        if (filters.materialId) {
            query += ' AND p.material_id = ?';
            params.push(filters.materialId);
        }

        query += ' ORDER BY p.created_at DESC';

        return await allAsync(query, params);
    } catch (error) {
        return [];
    }
}

async function getPurchaseStats() {
    try {
        const totalPurchases = await getAsync('SELECT COUNT(*) as count FROM purchase');
        const completedPurchases = await getAsync('SELECT COUNT(*) as count FROM purchase WHERE status = ?', ['completed']);
        const totalRevenue = await getAsync('SELECT SUM(p.thumbnail_price) as total FROM purchase p LEFT JOIN material m ON p.material_id = m.id WHERE p.status = ?', ['completed']);

        return {
            totalPurchases: totalPurchases?.count || 0,
            completedPurchases: completedPurchases?.count || 0,
            totalRevenue: totalRevenue?.total || 0
        };
    } catch (error) {
        return {};
    }
}

module.exports = {
    createPurchase,
    getPurchasesByUserId,
    getPurchaseById,
    updatePurchaseStatus,
    getPurchaseBySessionId,
    recordDownload,
    getAllPurchases,
    getPurchaseStats
};