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

const getData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// APIs
app.get('/api/sync', (req, res) => {
    res.json(getData());
});

app.post('/api/sync', (req, res) => {
    const { users, logs } = req.body;
    const db = getData();
    const now = Date.now();

    // Simple Merge Strategy: Latest update wins (based on lastUpdated if present, or just trust client for now)
    // In a real app, we'd compare timestamps per record.

    // Here we just replace/merge the arrays
    const mergedUsers = [...db.users];
    users.forEach(u => {
        const idx = mergedUsers.findIndex(mu => mu.id === u.id);
        if (idx >= 0) {
            if (!mergedUsers[idx].lastUpdated || u.lastUpdated > mergedUsers[idx].lastUpdated) {
                mergedUsers[idx] = u;
            }
        } else {
            mergedUsers.push(u);
        }
    });

    const mergedLogs = { ...db.logs, ...logs }; // Simple merge for logs

    const newData = { users: mergedUsers, logs: mergedLogs, lastSync: now };
    saveData(newData);
    res.json({ message: 'Sync successful', timestamp: now });
});

app.post('/api/upload-image', (req, res) => {
    const { userId, imageData } = req.body;
    if (!userId || !imageData) {
        console.log('Upload failed: Missing data');
        return res.status(400).send('Missing data');
    }

    console.log(`Receiving image for user: ${userId}`);
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const filePath = path.join(uploadsDir, `${userId}.jpg`);

    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
            console.error(`Write failed for ${userId}:`, err);
            return res.status(500).send(err);
        }
        console.log(`Successfully saved image for ${userId}`);
        res.json({ message: 'Image uploaded', url: `/uploads/${userId}.jpg` });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
