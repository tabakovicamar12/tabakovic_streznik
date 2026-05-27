const { runAsync } = require('./database/db');

async function seed() {
    console.log("Dodajanje fakultet v bazo...");
    try {
        await runAsync("INSERT INTO university (id, name) VALUES (1, 'FERI')");
        await runAsync("INSERT INTO university (id, name) VALUES (2, 'EPF')");
        await runAsync("INSERT INTO university (id, name) VALUES (3, 'FRI')");
        
        console.log("Fakultete so uspešno dodane!");
    } catch (err) {
        console.error("Napaka pri dodajanju:", err.message);
    }
    process.exit();
}

seed();