const fs = require('fs');
const path = require('path');
const cartPaymentStore = require('./cartPaymentStore');

const MATERIALS_DIR = path.join(__dirname, '../uploads/materials');

function resolveMaterialFile(storedPath) {
    if (!storedPath) return null;
    if (fs.existsSync(storedPath)) return storedPath;

    const localPath = path.join(MATERIALS_DIR, path.basename(storedPath));
    return fs.existsSync(localPath) ? localPath : null;
}

async function canDownload(user, material) {
    if (Number(material.cena) <= 0) return true;
    if (!user) return false;
    if (user.role === 'admin' || user.id === material.korisnikId) return true;

    return cartPaymentStore.hasCompletedPurchase(user.id, material.id);
}

module.exports = {
    resolveMaterialFile,
    canDownload
};
