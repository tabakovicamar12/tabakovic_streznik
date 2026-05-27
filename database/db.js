const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/app.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Napaka pri odpiranju baze:', err.message);
    } else {
        console.log('Povezava s podatkovno bazo je vzpostavljena.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run('PRAGMA foreign_keys = ON');

    db.run(`
        CREATE TABLE IF NOT EXISTS university (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'student',
            university_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (university_id) REFERENCES university(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS subject (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            university_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (university_id) REFERENCES university(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS material (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            thumbnail_price REAL NOT NULL,
            file_path TEXT,
            preview_path TEXT,
            avg_rating REAL DEFAULT 0,
            uploader_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            professor_name TEXT,
            view_count TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (uploader_id) REFERENCES user(id),
            FOREIGN KEY (subject_id) REFERENCES subject(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS subscription (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, subject_id),
            FOREIGN KEY (user_id) REFERENCES user(id),
            FOREIGN KEY (subject_id) REFERENCES subject(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS purchase (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            buyer_id INTEGER NOT NULL,
            material_id INTEGER NOT NULL,
            stripe_session_id TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (buyer_id) REFERENCES user(id),
            FOREIGN KEY (material_id) REFERENCES material(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS review (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            material_id INTEGER NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, material_id),
            FOREIGN KEY (user_id) REFERENCES user(id),
            FOREIGN KEY (material_id) REFERENCES material(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS report (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (material_id) REFERENCES material(id),
            FOREIGN KEY (user_id) REFERENCES user(id)
        )
    `);

    console.log('Baza podatkov je inicijalizirana.');
}

const runAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const getAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};


const allAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

module.exports = {
    db,
    runAsync,
    getAsync,
    allAsync
};
