const { db, runAsync, getAsync, allAsync } = require('../database/db');
const materialStore = require('./materialStore');

async function createReview(userId, materialId, rating, comment = null) {
    try {
        const existing = await getAsync(
            'SELECT * FROM review WHERE user_id = ? AND material_id = ?',
            [userId, materialId]
        );

        if (existing) {
            return { error: 'Recenzija že obstaja' };
        }

        if (rating < 1 || rating > 5) {
            return { error: 'Ocena mora biti med 1 in 5' };
        }

        await runAsync(`
            INSERT INTO review (user_id, material_id, rating, comment)
            VALUES (?, ?, ?, ?)
        `, [userId, materialId, rating, comment]);

        await materialStore.updateAverageRating(materialId);

        return await getAsync(
            'SELECT * FROM review WHERE user_id = ? AND material_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId, materialId]
        );
    } catch (error) {
        throw error;
    }
}

async function getReviewsByMaterialId(materialId) {
    try {
        return await allAsync(`
            SELECT r.*, u.email as user_email
            FROM review r
            LEFT JOIN user u ON r.user_id = u.id
            WHERE r.material_id = ?
            ORDER BY r.created_at DESC
        `, [materialId]);
    } catch (error) {
        return [];
    }
}

async function getReviewsByUserId(userId) {
    try {
        return await allAsync(`
            SELECT r.*, m.title as material_title
            FROM review r
            LEFT JOIN material m ON r.material_id = m.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
        `, [userId]);
    } catch (error) {
        return [];
    }
}

async function getReviewById(reviewId) {
    try {
        return await getAsync(`
            SELECT r.*, u.email as user_email, m.title as material_title
            FROM review r
            LEFT JOIN user u ON r.user_id = u.id
            LEFT JOIN material m ON r.material_id = m.id
            WHERE r.id = ?
        `, [reviewId]);
    } catch (error) {
        return null;
    }
}

async function updateReview(reviewId, rating, comment = null) {
    try {
        const review = await getReviewById(reviewId);
        if (!review) return null;

        if (rating < 1 || rating > 5) {
            return { error: 'Ocena mora biti med 1 in 5' };
        }

        await runAsync(`
            UPDATE review SET rating = ?, comment = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [rating, comment, reviewId]);

        await materialStore.updateAverageRating(review.material_id);
        return await getReviewById(reviewId);
    } catch (error) {
        throw error;
    }
}

async function deleteReview(reviewId) {
    try {
        const review = await getReviewById(reviewId);
        if (!review) return false;

        await runAsync('DELETE FROM review WHERE id = ?', [reviewId]);
        await materialStore.updateAverageRating(review.material_id);
        return true;
    } catch (error) {
        throw error;
    }
}

async function getReviewsWithStats(materialId) {
    try {
        const reviews = await getReviewsByMaterialId(materialId);
        if (reviews.length === 0) {
            return { reviews: [], stats: { totalReviews: 0, averageRating: 0, ratingDistribution: {} } };
        }

        const ratingDist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => { ratingDist[r.rating]++; });

        const averageRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2);

        return {
            reviews,
            stats: {
                totalReviews: reviews.length,
                averageRating: parseFloat(averageRating),
                ratingDistribution: ratingDist
            }
        };
    } catch (error) {
        return { reviews: [], stats: {} };
    }
}

module.exports = {
    createReview,
    getReviewsByMaterialId,
    getReviewsByUserId,
    getReviewById,
    updateReview,
    deleteReview,
    getReviewsWithStats
};