const AUTH_KEY = 'faceguard_auth_session_v2';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

const ADMINS_KEY = 'faceguard_admins_v2';

// Default admins if none exist
const DEFAULT_ADMINS = [
    { username: 'admin', password: 'admin123', role: 'super_admin', entity: 'All' },
    { username: 'malkajgiri', password: 'malkajgiri123', role: 'branch_admin', entity: 'Malkajgiri' },
    { username: 'manikonda', password: 'manikonda123', role: 'branch_admin', entity: 'Manikonda' }
];

// Helper to get all admins (Now Async)
export const getAdmins = async () => {
    try {
        const res = await fetch(`${SERVER_URL}/api/admins`);
        if (res.ok) return await res.json();
        return [];
    } catch (e) {
        console.error("Failed to fetch admins", e);
        return [];
    }
};

const SERVER_URL = 'http://localhost:3001';

// Removed syncAdminsToServer and syncAdminsFromRemote as they are obsolete.

const handleResponse = async (res) => {
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return await res.json();
    } else {
        const text = await res.text();
        console.error("Non-JSON Response:", text);
        if (text.includes("<!DOCTYPE html>")) {
            throw new Error("Server endpoint not found. Please RESTART the node server.");
        }
        throw new Error(text || "Unknown Server Error");
    }
};

export const addAdmin = async (newAdmin) => {
    try {
        const res = await fetch(`${SERVER_URL}/api/admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAdmin)
        });
        const data = await handleResponse(res);
        return data;
    } catch (e) {
        return { success: false, error: e.message };
    }
};

export const deleteAdmin = async (username) => {
    try {
        await fetch(`${SERVER_URL}/api/admin/${username}`, { method: 'DELETE' });
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
};

export const login = async (username, password) => {
    try {
        const res = await fetch(`${SERVER_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await handleResponse(res);

        if (data.success) {
            const session = {
                authenticated: true,
                username: data.user.username,
                role: data.user.role,
                entity: data.user.entity,
                loginTime: Date.now(),
                expiresAt: Date.now() + SESSION_DURATION
            };
            localStorage.setItem(AUTH_KEY, JSON.stringify(session));
            return { success: true };
        } else {
            return { success: false, error: data.error };
        }
    } catch (e) {
        return { success: false, error: 'Server connection failed' };
    }
};

export const logout = () => {
    localStorage.removeItem(AUTH_KEY);
};

export const isAuthenticated = () => {
    const sessionData = localStorage.getItem(AUTH_KEY);
    if (!sessionData) return false;

    try {
        const session = JSON.parse(sessionData);
        const now = Date.now();

        // Check if session has expired
        if (now > session.expiresAt) {
            logout();
            return false;
        }

        return session.authenticated === true;
    } catch (e) {
        logout();
        return false;
    }
};

export const getSession = () => {
    const sessionData = localStorage.getItem(AUTH_KEY);
    if (!sessionData) return null;

    try {
        return JSON.parse(sessionData);
    } catch (e) {
        return null;
    }
};

export const getRemainingTime = () => {
    const session = getSession();
    if (!session) return 0;

    const remaining = session.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
};

export const getCurrentUser = () => {
    return getSession();
};
