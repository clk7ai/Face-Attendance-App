import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/authService';
import { Shield, Lock, AlertCircle, Eye, EyeOff, User } from 'lucide-react';

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        setTimeout(async () => {
            const result = await login(username, password);

            if (result.success) {
                navigate('/');
            } else {
                setError(result.error);
                setPassword('');
            }
            setIsLoading(false);
        }, 500); // Small delay for better UX
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            <div className="glass-panel p-8 w-full max-w-md">
                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 bg-primary/20 rounded-full text-blue-400 mb-4">
                        <Shield size={48} />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                        FaceGuard Admin
                    </h1>
                    <p className="text-gray-400 text-sm">Sign in to access dashboard</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="text-sm text-muted uppercase tracking-wider font-semibold flex items-center gap-2 mb-3">
                            <User size={14} /> Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter admin username"
                            disabled={isLoading}
                            className="w-full bg-black/20 border border-gray-700 rounded-lg p-3 text-white focus:border-primary outline-none disabled:opacity-50"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="text-sm text-muted uppercase tracking-wider font-semibold flex items-center gap-2 mb-3">
                            <Lock size={14} /> Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                disabled={isLoading}
                                className="w-full bg-black/20 border border-gray-700 rounded-lg p-3 pr-12 text-white focus:border-primary outline-none disabled:opacity-50"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-center gap-2 text-red-400">
                            <AlertCircle size={18} />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={!username || !password || isLoading}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Verifying...
                            </>
                        ) : (
                            <>
                                <Lock size={18} />
                                Login
                            </>
                        )}
                    </button>
                </form>

                {/* Footer Note */}
                <div className="mt-8 pt-6 border-t border-white/5">
                    <p className="text-xs text-gray-500 text-center">
                        Contact Super Admin for access.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
