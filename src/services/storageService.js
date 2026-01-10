const USERS_KEY = 'attendance_app_users';
const SERVER_URL = 'http://localhost:3001';

// Helpers
const getTodayKey = () => `attendance_log_${new Date().toISOString().split('T')[0]}`;

// Server Sync Functions
export const syncToServer = async () => {
    try {
        const users = getUsers();
        const logs = getTodayLogs();

        const response = await fetch(`${SERVER_URL}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users, logs })
        });

        if (response.ok) {
            console.log('Successfully synced to server');
            return true;
        }
    } catch (err) {
        console.error('Failed to sync to server:', err);
    }
    return false;
};

export const fetchFromServer = async () => {
    try {
        const response = await fetch(`${SERVER_URL}/api/sync`);
        if (response.ok) {
            const serverData = await response.json();

            // Merge Users
            const localUsers = getUsers();
            const mergedUsers = [...localUsers];

            serverData.users.forEach(su => {
                const idx = mergedUsers.findIndex(u => u.id === su.id);
                if (idx >= 0) {
                    // Use latest updated version
                    if (!mergedUsers[idx].lastUpdated || su.lastUpdated > mergedUsers[idx].lastUpdated) {
                        mergedUsers[idx] = su;
                    }
                } else {
                    mergedUsers.push(su);
                }
            });
            localStorage.setItem(USERS_KEY, JSON.stringify(mergedUsers));

            // Merge Logs (Today's logs)
            const localLogs = getTodayLogs();
            const mergedLogs = { ...localLogs, ...(serverData.logs || {}) };
            localStorage.setItem(getTodayKey(), JSON.stringify(mergedLogs));

            console.log('Fetched and merged data from server');
            return true;
        }
    } catch (err) {
        console.warn('Could not fetch from server, using local data:', err);
    }
    return false;
};

// User Management
export const getUsers = () => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
};

export const generateUniqueId = (name) => {
    const users = getUsers();
    const cleanName = name.trim().replace(/\s+/g, '_');
    const existingSameName = users.filter(u => u.name.trim().toLowerCase() === name.trim().toLowerCase());
    const serialNo = (existingSameName.length + 1).toString().padStart(3, '0');
    return `${cleanName}_${serialNo}`;
};

export const saveUser = async (user, profileImage) => {
    const now = Date.now();
    const users = getUsers();
    const newUser = {
        ...user,
        hasImage: !!profileImage,
        lastUpdated: now
    };

    // Store profile image separately
    if (profileImage) {
        // 1. Try Local Storage (Optional)
        try {
            localStorage.setItem(`user_image_${user.id}`, profileImage);
        } catch (e) {
            console.warn("Local storage quota exceeded, image not saved locally.");
        }

        // 2. Try Server Upload (Critical)
        try {
            await fetch(`${SERVER_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id.toString(), imageData: profileImage })
            });
            console.log("Image successfully uploaded to server");
        } catch (e) {
            console.error("Failed to upload image to server:", e);
        }
    }

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // Trigger background sync
    syncToServer();
};

export const getUserImage = (userId) => {
    return localStorage.getItem(`user_image_${userId}`);
};

// Attendance Logic
export const clearLocalData = () => {
    // Clear users
    localStorage.removeItem(USERS_KEY);
    // Clear all user images
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('user_image_')) {
            localStorage.removeItem(key);
        }
    });
    // Clear logs
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('attendance_log_')) {
            localStorage.removeItem(key);
        }
    });
    console.log('Local storage cleared');
    window.location.reload(); // Refresh to update UI
};

export const getTodayLogs = () => {
    const data = localStorage.getItem(getTodayKey());
    return data ? JSON.parse(data) : {};
};

export const markAttendance = (name, type = 'auto') => {
    const key = getTodayKey();
    const logs = getTodayLogs();
    const nowISO = new Date().toISOString();
    const nowTimestamp = Date.now();

    const users = getUsers();
    const user = users.find(u => u.name === name);
    const branch = user ? (user.branch || 'Unknown') : 'Unknown';

    if (!logs[name]) {
        logs[name] = {
            name,
            firstSeen: nowISO,
            lastSeen: nowISO,
            manualIn: null,
            manualOut: null,
            branch: branch,
            lastUpdated: nowTimestamp
        };
    }

    const record = logs[name];
    record.lastSeen = nowISO;
    record.lastUpdated = nowTimestamp;

    if (!record.branch) record.branch = branch;

    if (type === 'check-in') {
        record.manualIn = nowISO;
    } else if (type === 'check-out') {
        record.manualOut = nowISO;
    }

    logs[name] = record;
    localStorage.setItem(key, JSON.stringify(logs));

    // Trigger background sync
    syncToServer();

    return record;
};

export const getDailyReport = () => {
    const logs = getTodayLogs();
    return Object.values(logs).map(record => {
        const startTime = record.manualIn || record.firstSeen;
        const endTime = record.manualOut || record.lastSeen;

        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        const durationMs = end - start;

        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);

        return {
            name: record.name,
            branch: record.branch || 'Unknown',
            loginTime: new Date(startTime).toLocaleTimeString(),
            logoutTime: new Date(endTime).toLocaleTimeString(),
            duration: `${hours}h ${minutes}m`,
            status: record.manualOut ? 'Checked Out' : 'Active'
        };
    });
};
