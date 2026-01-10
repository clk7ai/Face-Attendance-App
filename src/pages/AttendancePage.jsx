import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import CameraFeed from '../components/CameraFeed';
import { detectAllFaces, getBestFace, createMatcher, drawDetections } from '../services/faceService';
import { getUsers, markAttendance } from '../services/storageService';
import { ScanFace, UserCheck, LogIn, LogOut } from 'lucide-react';

const AttendancePage = ({ isModelLoaded }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [lastMatch, setLastMatch] = useState(null);
    const [users, setUsers] = useState([]);
    const matcherRef = useRef(null);
    const intervalRef = useRef(null);
    const [mode, setMode] = useState('auto'); // 'auto', 'check-in', 'check-out'

    useEffect(() => {
        const loadedUsers = getUsers();
        setUsers(loadedUsers);
        if (loadedUsers.length > 0 && isModelLoaded) {
            matcherRef.current = createMatcher(loadedUsers);
        }
    }, [isModelLoaded]);

    const startScanning = React.useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(async () => {
            if (!videoRef.current || !canvasRef.current || !matcherRef.current) return;

            const detections = await detectAllFaces(videoRef.current);
            const bestFace = getBestFace(detections);

            // Draw all detections with their match results/percentages
            drawDetections(canvasRef.current, videoRef.current, detections, matcherRef.current);

            if (bestFace) {
                const match = matcherRef.current.findBestMatch(bestFace.descriptor);
                if (match.label !== 'unknown') {
                    handleMatch(match.label);
                }
            }
        }, 800);
    }, [mode]); // Dependencies for startScanning

    const handleMatch = (name) => {
        markAttendance(name, mode);

        setLastMatch({
            name,
            action: mode === 'auto' ? 'Identified' : (mode === 'check-in' ? 'Check In' : 'Check Out'),
            time: new Date().toLocaleTimeString()
        });

        // Clear feedback after 2s
        setTimeout(() => setLastMatch(null), 2000);
    };

    useEffect(() => {
        if (users.length && isModelLoaded) {
            startScanning();
        }
        return () => clearInterval(intervalRef.current);
    }, [users, isModelLoaded, startScanning]);

    return (
        <div className="flex flex-col items-center p-4">
            <div className="glass-panel p-6 w-full max-w-4xl relative">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <ScanFace className="text-primary" size={28} />
                        <h2 className="title text-2xl m-0">Live Attendance</h2>
                    </div>

                    <div className="flex bg-black/30 p-1 rounded-lg border border-gray-700">
                        <button
                            onClick={() => setMode('auto')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'auto' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Auto Scan
                        </button>
                        <button
                            onClick={() => setMode('check-in')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${mode === 'check-in' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <LogIn size={14} /> Check In
                        </button>
                        <button
                            onClick={() => setMode('check-out')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${mode === 'check-out' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <LogOut size={14} /> Check Out
                        </button>
                    </div>
                </div>

                <div className="flex justify-center relative">
                    {isModelLoaded ? (
                        <div className="relative w-full max-w-[640px]">
                            <CameraFeed
                                onVideoReady={(el) => videoRef.current = el}
                                overlayRef={canvasRef}
                            />

                            {/* Mode Indicator Overlay */}
                            <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg flex items-center gap-2 ${mode === 'auto' ? 'bg-blue-500/80 text-white' :
                                mode === 'check-in' ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'
                                }`}>
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                Mode: {mode.replace('-', ' ')}
                            </div>

                            {lastMatch && (
                                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 min-w-[200px] bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-xl shadow-2xl flex flex-col items-center animate-bounce-short">
                                    <UserCheck size={24} className="mb-1 text-green-400" />
                                    <span className="font-bold text-lg">{lastMatch.name}</span>
                                    <span className="text-xs uppercase tracking-wide opacity-80">{lastMatch.action} at {lastMatch.time}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-64 w-full flex items-center justify-center text-muted border border-gray-700 rounded-2xl">
                            Loading Face Models...
                        </div>
                    )}
                </div>

                <div className="mt-4 text-center">
                    <p className="text-sm text-muted">
                        {mode === 'auto' ? "System will track your 'First Seen' and 'Last Seen' times automatically." :
                            mode === 'check-in' ? "Look at camera to mark Start of Day." : "Look at camera to mark End of Day."}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AttendancePage;
