const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'db.json');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure directories and files exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], logs: {} }));

const getData = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { users: [], logs: {} };
        }
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        if (!fileContent.trim()) return { users: [], logs: {} };
        return JSON.parse(fileContent);
    } catch (error) {
        fs.appendFileSync(path.join(__dirname, 'server_debug.log'), `[${new Date().toISOString()}] DB Read Error: ${error.stack}\n`);
        console.error("Error reading DB:", error);
        return { users: [], logs: {}, error: "DB Read Fail" };
    }
};

const saveData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing DB:", error);
    }
};

// APIs
app.get('/api/sync', (req, res) => {
    try {
        const data = getData();
        res.json(data);
    } catch (e) {
        fs.appendFileSync(path.join(__dirname, 'server_debug.log'), `[${new Date().toISOString()}] GET /api/sync Error: ${e.stack}\n`);
        console.error("GET /api/sync error:", e);
        res.status(500).json({ error: e.toString() });
    }
});

// Auth API
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const db = getData();
        const admin = (db.admins || []).find(a => a.username === username && a.password === password);

        if (admin) {
            res.json({
                success: true,
                user: {
                    username: admin.username,
                    role: admin.role,
                    entity: admin.entity
                }
            });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ error: e.toString() });
    }
});

app.get('/api/admins', (req, res) => {
    try {
        const db = getData();
        // Return admins but hide passwords for security if possible, 
        // though the Admin Page might need them for management (or just don't show them).
        // For now, sending as is since it's an internal tool, but purely for display.
        res.json(db.admins || []);
    } catch (e) {
        res.status(500).json({ error: e.toString() });
    }
});

app.post('/api/admin', (req, res) => {
    try {
        const newAdmin = req.body;
        const db = getData();
        if (!db.admins) db.admins = [];

        if (db.admins.find(a => a.username === newAdmin.username)) {
            return res.status(400).json({ success: false, error: 'Username already exists' });
        }

        db.admins.push(newAdmin);
        saveData(db);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.toString() });
    }
});

app.delete('/api/admin/:username', (req, res) => {
    try {
        const { username } = req.params;
        const db = getData();
        if (!db.admins) return res.json({ success: true });

        db.admins = db.admins.filter(a => a.username !== username);
        saveData(db);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.toString() });
    }
});

app.post('/api/sync', (req, res) => {
    try {
        const { users, logs } = req.body; // Remove 'admins' from sync body acceptance


        // Validation for Users (Legacy support)
        if (users && !Array.isArray(users)) {
            console.warn("Invalid users data received:", typeof users);
            return res.status(400).json({ error: "Invalid users array" });
        }

        const db = getData();
        const now = Date.now();

        // 1. Merge Users
        let mergedUsers = [...(db.users || [])];
        if (users) {
            users.forEach(u => {
                const idx = mergedUsers.findIndex(mu => mu.id === u.id);
                if (idx >= 0) {
                    if (!mergedUsers[idx].lastUpdated || (u.lastUpdated && u.lastUpdated > mergedUsers[idx].lastUpdated)) {
                        mergedUsers[idx] = u;
                    }
                } else {
                    mergedUsers.push(u);
                }
            });
        }

        // 2. Merge Admins (If provided)
        // For admins, we assume client authoritative for now (or simple replacement if provided)
        // Since admin management is less frequent, we can just update if provided, 
        // avoiding complex merge logic for now, or do similar simple merge.
        let mergedAdmins = db.admins || [];
        if (admins && Array.isArray(admins)) {
            // We just replace the admin list if provided from a Super Admin action?
            // Safer: Update/Add.
            admins.forEach(newAdmin => {
                const idx = mergedAdmins.findIndex(a => a.username === newAdmin.username);
                if (idx >= 0) {
                    mergedAdmins[idx] = newAdmin;
                } else {
                    mergedAdmins.push(newAdmin);
                }
            });

            // Handle Deletions? 
            // If the client sends the *entire* list of authoritative admins, we should replace it.
            // But if multiple clients, this is risky. 
            // For this specific app context (single admin usage likely), let's assume valid list.
            // However, to be safe with the `sync` endpoint name, we usually expect delta updates.
            // BUT, `deleteAdmin` removes locally. If we only "add/update", we can't delete on server.

            // Decision: Let's assume the request body contains the *current authoritative list* of admins if it comes from the Admin Page.
            // Actually, `post /api/sync` was designed as a merge.
            // Let's add a `deleteAdmins` flag or just override if specifically requested?
            // To match user request "deletion should happen at server", let's make `admins` authoritative override if provided.
            mergedAdmins = admins;
        }

        const mergedLogs = { ...(db.logs || {}), ...(logs || {}) };

        const newData = { users: mergedUsers, log: mergedLogs, admins: mergedAdmins, lastSync: now };
        saveData(newData);
        res.json({ message: 'Sync successful', timestamp: now });
    } catch (e) {
        fs.appendFileSync(path.join(__dirname, 'server_debug.log'), `[${new Date().toISOString()}] POST /api/sync Error: ${e.stack}\n`);
        console.error("POST /api/sync error:", e);
        res.status(500).json({ error: e.toString() });
    }
});

app.post('/api/upload-image', (req, res) => {
    const { userId, imageData, type } = req.body;
    if (!userId || !imageData) {
        console.log('Upload failed: Missing data');
        return res.status(400).send('Missing data');
    }

    const userUploadsDir = path.join(uploadsDir, userId);
    if (!fs.existsSync(userUploadsDir)) fs.mkdirSync(userUploadsDir, { recursive: true });

    let filename;
    if (type === 'attendance') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `attendance_${timestamp}.jpg`;
    } else {
        // Default to registration (profile) image
        filename = 'registration.jpg';
    }

    console.log(`Receiving ${type || 'registration'} image for user: ${userId}`);
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const filePath = path.join(userUploadsDir, filename);

    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
            console.error(`Write failed for ${userId}:`, err);
            return res.status(500).send(err);
        }
        res.json({ message: 'Image uploaded', url: `/uploads/${userId}/${filename}` });
    });
});

app.post('/api/log-error', (req, res) => {
    const { error, errorInfo } = req.body;
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ERROR: ${error}\nINFO: ${JSON.stringify(errorInfo)}\n--------------------------\n`;

    fs.appendFile(path.join(__dirname, 'server_error_logs.txt'), logEntry, (err) => {
        if (err) console.error("Failed to write to error log", err);
    });
    console.error("CLIENT ERROR:", error);
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
