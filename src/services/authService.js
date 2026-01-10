const AUTH_KEY = 'faceguard_auth_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

// Simple password validation (in production, this should be server-side with hashing)
const ADMIN_PASSWORD = 'admin123'; // TODO: Move to environment variable

export const login = (password) => {
    if (password === ADMIN_PASSWORD) {
        const session = {
            authenticated: true,
            loginTime: Date.now(),
            expiresAt: Date.now() + SESSION_DURATION
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
        return { success: true };
    }
    return { success: false, error: 'Invalid password' };
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
