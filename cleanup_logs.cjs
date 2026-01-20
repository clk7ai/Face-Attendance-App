const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'server', 'db.json');

try {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const entitiesToRemove = ['Malkajgiri', 'Manikonda'];

    console.log("Cleaning Logs...");
    if (db.logs) { // Log structure is Object, not Array
        Object.keys(db.logs).forEach(key => {
            const entry = db.logs[key];
            if (entitiesToRemove.includes(entry.entity)) {
                console.log(`Deleting Log: ${key}`);
                delete db.logs[key];
            }
        });
    }

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log("Cleanup Logs Done");
} catch (e) {
    console.error("Error cleaning DB:", e);
}
