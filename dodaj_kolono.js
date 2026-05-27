const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/app.db'); 

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

async function dodajStolpec() {
    try {
        await runAsync("ALTER TABLE material ADD COLUMN slika TEXT DEFAULT 'placeholder.jpg'");
        console.log("Stolpec 'slika' uspešno dodan.");
    } catch (err) {
        console.error("Napaka:", err.message);
    }
}

dodajStolpec();