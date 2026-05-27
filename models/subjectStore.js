const { db, runAsync, getAsync, allAsync } = require('../database/db');

async function createSubject(name, universityId) {
    try {
        await runAsync(`
            INSERT INTO subject (name, university_id)
            VALUES (?, ?)
        `, [name, universityId]);

        const subject = await getAsync(
            'SELECT * FROM subject WHERE name = ? AND university_id = ?',
            [name, universityId]
        );
        return subject;
    } catch (error) {
        console.error('Napaka pri ustvarjanju predmeta:', error);
        throw error;
    }
}

async function getSubjectById(subjectId) {
    try {
        return await getAsync(`
            SELECT s.*, u.name as university_name
            FROM subject s
            LEFT JOIN university u ON s.university_id = u.id
            WHERE s.id = ?
        `, [subjectId]);
    } catch (error) {
        console.error('Napaka pri pridobivanju predmeta:', error);
        return null;
    }
}

async function getSubjectsByUniversity(universityId) {
    try {
        return await allAsync(
            'SELECT * FROM subject WHERE university_id = ? ORDER BY name',
            [universityId]
        );
    } catch (error) {
        console.error('Napaka pri pridobivanju predmetov:', error);
        return [];
    }
}

async function getAllSubjects() {
    try {
        return await allAsync(`
            SELECT s.*, u.name as university_name
            FROM subject s
            LEFT JOIN university u ON s.university_id = u.id
            ORDER BY u.name, s.name
        `);
    } catch (error) {
        console.error('Napaka pri pridobivanju predmetov:', error);
        return [];
    }
}

async function updateSubject(subjectId, updates) {
    try {
        const allowedFields = ['name'];
        let query = 'UPDATE subject SET ';
        let params = [];
        let setClauses = [];

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                setClauses.push(`${field} = ?`);
                params.push(updates[field]);
            }
        });

        if (setClauses.length === 0) return await getSubjectById(subjectId);

        query += setClauses.join(', ') + ' WHERE id = ?';
        params.push(subjectId);

        await runAsync(query, params);
        return await getSubjectById(subjectId);
    } catch (error) {
        console.error('Napaka pri posodobitvi predmeta:', error);
        throw error;
    }
}

async function deleteSubject(subjectId) {
    try {
        await runAsync('DELETE FROM subject WHERE id = ?', [subjectId]);
        return true;
    } catch (error) {
        console.error('Napaka pri brisanju predmeta:', error);
        throw error;
    }
}

module.exports = {
    createSubject,
    getSubjectById,
    getSubjectsByUniversity,
    getAllSubjects,
    updateSubject,
    deleteSubject
};
