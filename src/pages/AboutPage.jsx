import React from 'react';
import { Info, Github, Shield, Cpu } from 'lucide-react';

const AboutPage = () => {
    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-primary/20 rounded-full text-blue-400">
                    <Shield size={48} />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    FaceGuard Attendance
                </h1>
                <p className="text-gray-400 max-w-lg">
                    A secure, real-time face recognition attendance system built for modern workplaces.
                    Powered by edge-AI to ensure privacy and speed.
                </p>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-gray-500">
                    v1.0.0 (Stable) • React + Capacitor
                </span>
            </div>

            {/* Grid Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-6 space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
                        <Cpu size={20} className="text-indigo-400" /> Technology Stack
                    </h2>
                    <ul className="space-y-3 text-gray-300 text-sm">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                            Face-API.js (TensorFlow.js)
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                            React 19 + Vite
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                            Tailwind CSS
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                            Capacitor (Native Mobile)
                        </li>
                    </ul>
                </div>

                <div className="glass-panel p-6 space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
                        <Info size={20} className="text-emerald-400" /> Features
                    </h2>
                    <ul className="space-y-3 text-gray-300 text-sm">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            Real-time Detection
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            Anti-spoofing Liveness Check
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            Offline Capable (PWA/Native)
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            CSV Reporting
                        </li>
                    </ul>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-8 border-t border-white/5">
                <p className="text-gray-500 text-sm">Designed & Developed by AI Assistant</p>
            </div>
        </div>
    );
};

export default AboutPage;
