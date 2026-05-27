const fs = require('fs');
const path = require('path');
const { db, runAsync, getAsync, allAsync } = require('../database/db');

const UPLOADS_DIR = path.join(__dirname, '../uploads/materials');

const ensureDirectory = () => {
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
};

ensureDirectory();

async function updateAverageRating(materialId) {
    const { getAsync, runAsync } = require('../database/db');
    
    try {
        const row = await getAsync(`
            SELECT AVG(rating) as prosek 
            FROM review 
            WHERE material_id = ?
        `, [materialId]);
        
        const noviProsek = row && row.prosek ? parseFloat(row.prosek.toFixed(2)) : 0;
        
        await runAsync(`
            UPDATE material 
            SET avg_rating = ? 
            WHERE id = ?
        `, [noviProsek, materialId]);
        
        console.log(`Uspešno osvežen avg_rating za gradivo ${materialId}: ${noviProsek}`);
    } catch (err) {
        console.error("Napaka pri osveževanju avg_rating v materialStore:", err);
    }
}

async function getAllMaterials(filters = {}) {
    try {
        let query = `
            SELECT m.*, s.name as subject_name, u.email as uploader_email
            FROM material m
            LEFT JOIN subject s ON m.subject_id = s.id
            LEFT JOIN user u ON m.uploader_id = u.id
            WHERE 1=1
        `;
        let params = [];

        if (filters.predmet) {
            query += ' AND (s.name LIKE ? OR m.subject_id = ?)';
            params.push(`%${filters.predmet}%`, filters.predmet);
        }

        if (filters.profesor) {
            query += ' AND m.professor_name LIKE ?';
            params.push(`%${filters.profesor}%`);
        }

        if (filters.minOcena) {
            query += ' AND m.avg_rating >= ?';
            params.push(parseFloat(filters.minOcena));
        }

        if (filters.iskanje) {
            query += ' AND (m.title LIKE ? OR m.description LIKE ?)';
            params.push(`%${filters.iskanje}%`, `%${filters.iskanje}%`);
        }

        if (filters.sortPo === 'ocena') {
            query += ' ORDER BY m.avg_rating DESC';
        } else if (filters.sortPo === 'ogledi') {
            query += ' ORDER BY m.view_count DESC';
        } else {
            query += ' ORDER BY m.created_at DESC';
        }

        const rows = await allAsync(query, params);

        return rows.map(row => ({
            id: row.id,
            naziv: row.title,
            opis: row.description,
            predmet: row.subject_name || row.subject_id,
            profesor: row.professor_name,
            cena: row.thumbnail_price,
            ocena: row.avg_rating || 5,
            brojPregledavanja: row.view_count || 0,
            slikaPath: row.preview_path,
            pdfPath: row.file_path,
            korisnikId: row.uploader_id
        }));
    } catch (error) {
        console.error('Napaka pri pridobivanju gradiv:', error);
        return [];
    }
}

async function getMaterialById(id) {
    try {
        const row = await getAsync(`
            SELECT m.*, s.name as subject_name, u.email as uploader_email
            FROM material m
            LEFT JOIN subject s ON m.subject_id = s.id
            LEFT JOIN user u ON m.uploader_id = u.id
            WHERE m.id = ?
        `, [id]);

        if (!row) return null;

        return {
            id: row.id,
            naziv: row.title,
            opis: row.description,
            predmet: row.subject_name || row.subject_id,
            profesor: row.professor_name,
            cena: row.thumbnail_price,
            ocena: row.avg_rating || 5,
            brojPregledavanja: row.view_count || 0,
            slikaPath: row.preview_path,
            pdfPath: row.file_path,
            korisnikId: row.uploader_id
        };
    } catch (error) {
        console.error('Napaka pri pridobivanju gradiva:', error);
        return null;
    }
}

async function createMaterial(materialData, filePath, fileName) {
    try {
        const title = materialData.naziv;
        const description = materialData.opis;
        const thumbnail_price = parseFloat(materialData.cena) || 0;
        const file_path = filePath;
        const preview_path = materialData.slikaPath || null;
        const uploader_id = materialData.korisnikId;
        const subject_id = materialData.predmet;
        const professor_name = materialData.profesor;

        await runAsync(`
            INSERT INTO material (title, description, thumbnail_price, file_path, preview_path, uploader_id, subject_id, professor_name, avg_rating, view_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5, 0)
        `, [title, description, thumbnail_price, file_path, preview_path, uploader_id, subject_id, professor_name]);

        return await getAsync('SELECT * FROM material WHERE uploader_id = ? ORDER BY created_at DESC LIMIT 1', [uploader_id]);
    } catch (error) {
        console.error('Napaka pri ustvarjanju gradiva:', error);
        throw error;
    }
}

async function updateMaterial(id, updates) {
    try {
        const fieldMapping = {
            naziv: 'title',
            opis: 'description',
            cena: 'thumbnail_price',
            profesor: 'professor_name',
            slikaPath: 'preview_path',
            pdfPath: 'file_path'
        };

        let query = 'UPDATE material SET ';
        let params = [];
        let setClauses = [];

        Object.keys(fieldMapping).forEach(sloField => {
            const sqlField = fieldMapping[sloField];
            if (updates[sloField] !== undefined) {
                setClauses.push(`${sqlField} = ?`);
                params.push(updates[sloField]);
            }
        });

        if (setClauses.length === 0) return await getMaterialById(id);

        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        query += setClauses.join(', ') + ' WHERE id = ?';
        params.push(id);

        await runAsync(query, params);
        return await getMaterialById(id);
    } catch (error) {
        console.error('Napaka pri posodobitvi gradiva:', error);
        throw error;
    }
}

async function deleteMaterial(id) {
    try {
        const material = await getMaterialById(id);
        if (!material) return false;

        if (material.pdfPath && fs.existsSync(material.pdfPath)) {
            fs.unlinkSync(material.pdfPath);
        }
        if (material.slikaPath && fs.existsSync(material.slikaPath)) {
            fs.unlinkSync(material.slikaPath);
        }

        await runAsync('DELETE FROM material WHERE id = ?', [id]);
        return true;
    } catch (error) {
        console.error('Napaka pri brisanju gradiva:', error);
        throw error;
    }
}

async function downloadMaterial(id) {
    try {
        const material = await getMaterialById(id);
        if (!material || !material.pdfPath) return null;

        if (!fs.existsSync(material.pdfPath)) {
            return null;
        }

        await runAsync('UPDATE material SET view_count = view_count + 1 WHERE id = ?', [id]);

        return {
            filePath: material.pdfPath,
            fileName: `${material.naziv}.pdf`
        };
    } catch (error) {
        console.error('Napaka pri prenosu gradiva:', error);
        throw error;
    }
}

async function incrementViewCount(id) {
    try {
        await runAsync('UPDATE material SET view_count = view_count + 1 WHERE id = ?', [id]);
    } catch (error) {
        console.error('Napaka pri posodobitvi ogledov:', error);
    }
}

async function searchMaterials(queryText) {
    try {
        const rows = await allAsync(`
            SELECT m.*, s.name as subject_name
            FROM material m
            LEFT JOIN subject s ON m.subject_id = s.id
            WHERE m.title LIKE ? OR m.description LIKE ? OR s.name LIKE ? OR m.professor_name LIKE ?
            ORDER BY m.avg_rating DESC
        `, [`%${queryText}%`, `%${queryText}%`, `%${queryText}%`, `%${queryText}%`]);

        return rows.map(row => ({
            id: row.id,
            naziv: row.title,
            opis: row.description,
            predmet: row.subject_name || row.subject_id,
            profesor: row.professor_name,
            cena: row.thumbnail_price,
            ocena: row.avg_rating || 5,
            brojPregledavanja: row.view_count || 0
        }));
    } catch (error) {
        console.error('Napaka pri iskanju gradiv:', error);
        return [];
    }
}

async function getStatistics() {
    const { getAsync, allAsync } = require('../database/db'); 
    try {
        const totalMaterials = await getAsync('SELECT COUNT(*) as count FROM material');
        const avgRating = await getAsync('SELECT AVG(avg_rating) as avg FROM material');
        const totalPregledi = await getAsync('SELECT SUM(view_count) as total_views FROM material');
        const totalReviews = await getAsync('SELECT COUNT(*) as count FROM review');
        
        const predmeti = await allAsync('SELECT DISTINCT title FROM material WHERE title IS NOT NULL LIMIT 10'); 
        const profesorji = await allAsync('SELECT DISTINCT professor_name FROM material WHERE professor_name IS NOT NULL LIMIT 10');

        return {
            sporocilo: 'Statistika gradiva',
            skupnoGradiva: totalMaterials?.count || 0,
            povprečnaOcena: (avgRating?.avg || 0).toFixed(2),
            skupnoPregledi: totalPregledi?.total_views || 0,
            skupnoReviews: totalReviews?.count || 0,
            predmeti: predmeti.map(p => p.title),
            profesorji: profesorji.map(prof => prof.professor_name)
        };
    } catch (error) {
        console.error('Napaka pri pridobivanju statistike:', error);
        return { 
            skupnoGradiva: 0, 
            povprečnaOcena: 0, 
            skupnoPregledi: 0, 
            skupnoReviews: 0, 
            predmeti: [], 
            profesorji: [] 
        };
    }
}

async function generateCSVReport() {
    try {
        const rows = await allAsync('SELECT * FROM material');
        
        let csv = 'ID,Naziv,Profesor,Cena,Ocena,Pregledi\n';
        rows.forEach(m => {
            csv += `"${m.id}","${m.title}","${m.professor_name}",${m.thumbnail_price},${m.avg_rating || 5},${m.view_count || 0}\n`;
        });

        return csv;
    } catch (error) {
        console.error('Napaka pri generiranju CSV:', error);
        return 'ID,Naziv,Profesor,Cena,Ocena,Pregledi\n';
    }
}

module.exports = {
    getAllMaterials,
    getMaterialById,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    downloadMaterial,
    incrementViewCount,
    searchMaterials,
    getStatistics,
    generateCSVReport,
    updateAverageRating,
    UPLOADS_DIR
};