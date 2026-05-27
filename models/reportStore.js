const { db, runAsync, getAsync, allAsync } = require('../database/db');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

const ensureDataDir = () => {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
};

const loadReports = () => {
    ensureDataDir();
    if (fs.existsSync(REPORTS_FILE)) {
        const data = fs.readFileSync(REPORTS_FILE, 'utf-8');
        return JSON.parse(data || '[]');
    }
    return [];
};

const saveReports = (reports) => {
    ensureDataDir();
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf-8');
};


async function createReport(materialId, userId, reason, description = null) {
    try {
        await runAsync(`
            INSERT INTO report (material_id, user_id, reason, description, status)
            VALUES (?, ?, ?, ?, 'pending')
        `, [materialId, userId, reason, description]);

        return await getAsync(
            'SELECT * FROM report WHERE material_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
            [materialId, userId]
        );
    } catch (error) {
        throw error;
    }
}

async function getReportById(reportId) {
    try {
        return await getAsync(`
            SELECT r.*, m.title as material_title, u.email as reporter_email
            FROM report r
            LEFT JOIN material m ON r.material_id = m.id
            LEFT JOIN user u ON r.user_id = u.id
            WHERE r.id = ?
        `, [reportId]);
    } catch (error) {
        return null;
    }
}

async function getReportsByMaterial(materialId) {
    try {
        return await allAsync(`
            SELECT r.*, u.email as reporter_email
            FROM report r
            LEFT JOIN user u ON r.user_id = u.id
            WHERE r.material_id = ?
            ORDER BY r.created_at DESC
        `, [materialId]);
    } catch (error) {
        return [];
    }
}

async function getAllReports(filters = {}) {
    try {
        let query = `
            SELECT r.*, m.title as material_title, u.email as reporter_email
            FROM report r
            LEFT JOIN material m ON r.material_id = m.id
            LEFT JOIN user u ON r.user_id = u.id
            WHERE 1=1
        `;
        let params = [];

        if (filters.status) {
            query += ' AND r.status = ?';
            params.push(filters.status);
        }

        if (filters.reason) {
            query += ' AND r.reason = ?';
            params.push(filters.reason);
        }

        query += ' ORDER BY r.created_at DESC';
        return await allAsync(query, params);
    } catch (error) {
        return [];
    }
}

async function updateReportStatus(reportId, status) {
    try {
        await runAsync(
            'UPDATE report SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, reportId]
        );
        return await getReportById(reportId);
    } catch (error) {
        throw error;
    }
}

async function deleteReport(reportId) {
    try {
        await runAsync('DELETE FROM report WHERE id = ?', [reportId]);
        return true;
    } catch (error) {
        throw error;
    }
}

async function getReportStats() {
    try {
        const pending = await getAsync('SELECT COUNT(*) as count FROM report WHERE status = ?', ['pending']);
        const reviewed = await getAsync('SELECT COUNT(*) as count FROM report WHERE status = ?', ['reviewed']);
        const resolved = await getAsync('SELECT COUNT(*) as count FROM report WHERE status = ?', ['resolved']);

        return {
            pendingReports: pending?.count || 0,
            reviewedReports: reviewed?.count || 0,
            resolvedReports: resolved?.count || 0
        };
    } catch (error) {
        return {};
    }
}

const createReportJSON = (uporabnikId, gradivoId, razlog, opis) => {
    const reports = loadReports();
    const nova = {
        id: Date.now().toString(),
        uporabnikId,
        gradivoId,
        razlog,
        opis,
        status: 'čakajoče',
        datumPrijave: new Date().toISOString(),
        datumPregleda: null,
        pregledanOd: null,
        odgovor: null
    };
    reports.push(nova);
    saveReports(reports);
    return nova;
};

const getReportsByUserIdJSON = (uporabnikId) => {
    const reports = loadReports();
    return reports.filter(r => r.uporabnikId === uporabnikId);
};

module.exports = {
    createReport,
    getReportById,
    getReportsByMaterial,
    getAllReports,
    updateReportStatus,
    deleteReport,
    getReportStats,
    json: {
        createReport: createReportJSON,
        getReportsByUserId: getReportsByUserIdJSON
    }
};