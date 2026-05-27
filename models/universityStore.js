const { db, runAsync, getAsync, allAsync } = require('../database/db');

async function createUniversity(name) {
    try {
        const existing = await getAsync('SELECT * FROM university WHERE name = ?', [name]);
        if (existing) {
            return { error: 'Univerza že obstaja' };
        }

        await runAsync('INSERT INTO university (name) VALUES (?)', [name]);

        return await getAsync('SELECT * FROM university WHERE name = ?', [name]);
    } catch (error) {
        console.error('Napaka pri ustvarjanju univerze:', error);
        throw error;
    }
}

async function getUniversityById(universityId) {
    try {
        return await getAsync('SELECT * FROM university WHERE id = ?', [universityId]);
    } catch (error) {
        console.error('Napaka pri pridobivanju univerze:', error);
        return null;
    }
}

async function getUniversityByName(name) {
    try {
        return await getAsync('SELECT * FROM university WHERE name = ?', [name]);
    } catch (error) {
        console.error('Napaka pri pridobivanju univerze:', error);
        return null;
    }
}

async function getAllUniversities() {
    try {
        return await allAsync('SELECT * FROM university ORDER BY name');
    } catch (error) {
        console.error('Napaka pri pridobivanju univerz:', error);
        return [];
    }
}

async function updateUniversity(universityId, updates) {
    try {
        const allowedFields = ['name'];
        let query = 'UPDATE university SET ';
        let params = [];
        let setClauses = [];

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                setClauses.push(`${field} = ?`);
                params.push(updates[field]);
            }
        });

        if (setClauses.length === 0) return await getUniversityById(universityId);

        query += setClauses.join(', ') + ' WHERE id = ?';
        params.push(universityId);

        await runAsync(query, params);
        return await getUniversityById(universityId);
    } catch (error) {
        console.error('Napaka pri posodobitvi univerze:', error);
        throw error;
    }
}

async function deleteUniversity(universityId) {
    try {
        await runAsync('DELETE FROM university WHERE id = ?', [universityId]);
        return true;
    } catch (error) {
        console.error('Napaka pri brisanju univerze:', error);
        throw error;
    }
}

module.exports = {
    createUniversity,
    getUniversityById,
    getUniversityByName,
    getAllUniversities,
    updateUniversity,
    deleteUniversity
};
