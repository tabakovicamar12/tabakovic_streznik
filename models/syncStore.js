const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const SYNC_FILE = path.join(DATA_DIR, 'sync-log.json');

const ensureDataDir = () => {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
};

const loadSyncLog = () => {
    ensureDataDir();
    if (fs.existsSync(SYNC_FILE)) {
        const data = fs.readFileSync(SYNC_FILE, 'utf-8');
        return JSON.parse(data || '{}');
    }
    return {};
};

const saveSyncLog = (syncLog) => {
    ensureDataDir();
    fs.writeFileSync(SYNC_FILE, JSON.stringify(syncLog, null, 2), 'utf-8');
};

const getLastSync = (uporabnikId) => {
    const syncLog = loadSyncLog();
    return syncLog[uporabnikId] || null;
};

const updateSync = (uporabnikId, spremembe) => {
    const syncLog = loadSyncLog();
    
    syncLog[uporabnikId] = {
        zadnjaSinhronizacija: new Date().toISOString(),
        spremembe: spremembe || {}
    };
    
    saveSyncLog(syncLog);
    return syncLog[uporabnikId];
};

const recordChange = (type, id, data) => {
    const syncLog = loadSyncLog();
    
    const spremembe = {
        tip: type,
        id: id,
        podatki: data,
        datumSpremembe: new Date().toISOString()
    };
    
    return spremembe;
};

module.exports = {
    getLastSync,
    updateSync,
    recordChange
};
