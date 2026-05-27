
const { db, runAsync, getAsync, allAsync } = require('../database/db');
const bcrypt = require('bcryptjs');


async function getUserByEmail(email) {
    try {
        return await getAsync('SELECT * FROM user WHERE email = ?', [email]);
    } catch (error) {
        console.error('Napaka pri pridobivanju uporabnika:', error);
        return null;
    }
}

async function getUserById(id) {
    try {
        return await getAsync('SELECT * FROM user WHERE id = ?', [id]);
    } catch (error) {
        console.error('Napaka pri pridobivanju uporabnika:', error);
        return null;
    }
}

async function createUser(email, password, universityId = null) {
    try {
        const existing = await getUserByEmail(email);
        if (existing) {
            return { error: 'Uporabnik z to e-pošto že obstaja' };
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await runAsync(
            'INSERT INTO user (email, password_hash, role, university_id) VALUES (?, ?, ?, ?)',
            [email, passwordHash, 'student', universityId]
        );

        const user = await getUserByEmail(email);
        return { 
            id: user.id, 
            email: user.email, 
            role: user.role,
            university_id: user.university_id
        };
    } catch (error) {
        console.error('Napaka pri ustvarjanju uporabnika:', error);
        throw error;
    }
}


async function verifyPassword(email, password) {
    try {
        const user = await getUserByEmail(email);
        if (!user) {
            return { valid: false, error: 'Uporabnik ne obstaja' };
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (isValid) {
            return { 
                valid: true, 
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    university_id: user.university_id
                }
            };
        } else {
            return { valid: false, error: 'Nepravilno geslo' };
        }
    } catch (error) {
        console.error('Napaka pri preverjanju gesla:', error);
        throw error;
    }
}

async function updateUserRole(userId, role) {
    try {
        await runAsync(
            'UPDATE user SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [role, userId]
        );
        return await getUserById(userId);
    } catch (error) {
        console.error('Napaka pri posodobitvi vloge:', error);
        throw error;
    }
}


async function getUsersByUniversity(universityId) {
    try {
        return await allAsync('SELECT * FROM user WHERE university_id = ?', [universityId]);
    } catch (error) {
        console.error('Napaka pri pridobivanju uporabnikov:', error);
        return [];
    }
}

async function updatePassword(userId, newPassword) {
    try {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await runAsync(
            'UPDATE user SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [passwordHash, userId]
        );
        return true;
    } catch (error) {
        console.error('Napaka pri posodobitvi gesla:', error);
        throw error;
    }
}

async function deleteUser(userId) {
    try {
        await runAsync('DELETE FROM user WHERE id = ?', [userId]);
        return true;
    } catch (error) {
        console.error('Napaka pri brisanju uporabnika:', error);
        throw error;
    }
}

module.exports = {
    getUserByEmail,
    getUserById,
    createUser,
    verifyPassword,
    updateUserRole,
    getUsersByUniversity,
    updatePassword,
    deleteUser
};
