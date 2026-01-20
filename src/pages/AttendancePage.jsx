import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import CameraFeed from '../components/CameraFeed';
import { detectAllFaces, getBestFace, createMatcher, drawDetections, checkMatchThreshold } from '../services/faceService';
import { getUsers, markAttendance } from '../services/storageService';
import { ScanFace, UserCheck, LogIn, LogOut } from 'lucide-react';

const AttendancePage = ({ isModelLoaded }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isScanComplete, setIsScanComplete] = useState(false);

    // Restore missing states
    const [lastMatch, setLastMatch] = useState(null);
    const [users, setUsers] = useState([]);
    const matcherRef = useRef(null);
    const intervalRef = useRef(null);
    const [mode, setMode] = useState('auto'); // 'auto', 'check-in', 'check-out'

    useEffect(() => {
        const loadUsers = () => {
            const loadedUsers = getUsers();
            setUsers(prev => {
                if (prev.length !== loadedUsers.length) return loadedUsers;
                return prev;
            });

            if (loadedUsers.length > 0 && isModelLoaded) {
                matcherRef.current = createMatcher(loadedUsers);
            }
        };

        loadUsers();
        // Check for new users every 30 seconds (after App.jsx syncs)
        const refreshInterval = setInterval(loadUsers, 30000);
        return () => clearInterval(refreshInterval);
    }, [isModelLoaded]);

    const startScanning = React.useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (isScanComplete) return;

        intervalRef.current = setInterval(async () => {
            if (!videoRef.current || !canvasRef.current || videoRef.current.paused) return;

            // Debug: Check video state
            // console.log("Video State:", videoRef.current.readyState, videoRef.current.videoWidth, videoRef.current.videoHeight);

            try {
                const detections = await detectAllFaces(videoRef.current);
                console.log("Detections:", detections.length);

                const bestFace = getBestFace(detections);
                drawDetections(canvasRef.current, videoRef.current, detections, matcherRef.current);

                if (bestFace && matcherRef.current) {
                    const match = matcherRef.current.findBestMatch(bestFace.descriptor);

                    // Use centralized threshold check (defaults to >20% accuracy with 0.7 distance)
                    const isMatch = checkMatchThreshold(match.distance, 20);

                    if (match.label !== 'unknown' && isMatch) {
                        console.log("Match Found:", match.label);

                        // Capture image before freezing if score is decent
                        let captureImage = null;
                        if (bestFace.detection.score > 0.5) {
                            const canvas = document.createElement('canvas');
                            canvas.width = videoRef.current.videoWidth;
                            canvas.height = videoRef.current.videoHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.translate(canvas.width, 0);
                            ctx.scale(-1, 1);
                            ctx.drawImage(videoRef.current, 0, 0);
                            captureImage = canvas.toDataURL('image/jpeg', 0.8);
                        }

                        // Stop detection loop IMMEDIATELY
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        intervalRef.current = null;

                        handleMatch(match.label, captureImage);
                    }
                }
            } catch (err) {
                console.error("Detection Error:", err);
            }
        }, 800);
    }, [mode, isScanComplete]);

    const handleMatch = (name, captureImage) => {
        markAttendance(name, mode, captureImage);

        // Freeze logic (controlled by isScanComplete -> isActive=false in CameraFeed)
        setIsScanComplete(true);
        // if (videoRef.current) videoRef.current.pause(); // Handled by CameraFeed unmounting stream
        if (intervalRef.current) clearInterval(intervalRef.current);

        setLastMatch({
            name,
            action: mode === 'auto' ? 'Identified' : (mode === 'check-in' ? 'Check In' : 'Check Out'),
            time: new Date().toLocaleTimeString()
        });
    };

    const resetScan = () => {
        // Reset (Setting isScanComplete=false will re-activate CameraFeed)
        setLastMatch(null);
        setIsScanComplete(false);
        // if (videoRef.current) videoRef.current.play(); // Handled by CameraFeed re-mounting stream
        startScanning();
    };


    useEffect(() => {
        // Start scanning if models loaded and NOT complete (users not strictly required for detection)
        if (isModelLoaded && !isScanComplete) {
            startScanning();
        }
        return () => clearInterval(intervalRef.current);
    }, [users, isModelLoaded, startScanning, isScanComplete]);

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
                            disabled={isScanComplete}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'auto' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'} ${isScanComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            Auto Scan
                        </button>
                        <button
                            onClick={() => setMode('check-in')}
                            disabled={isScanComplete}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${mode === 'check-in' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'} ${isScanComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <LogIn size={14} /> Check In
                        </button>
                        <button
                            onClick={() => setMode('check-out')}
                            disabled={isScanComplete}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${mode === 'check-out' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'} ${isScanComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                isActive={!isScanComplete}
                            />

                            {/* Mode Indicator Overlay */}
                            <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg flex items-center gap-2 ${mode === 'auto' ? 'bg-blue-500/80 text-white' :
                                mode === 'check-in' ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'
                                }`}>
                                <div className={`w-2 h-2 rounded-full bg-white ${isScanComplete ? '' : 'animate-pulse'}`} />
                                Mode: {mode.replace('-', ' ')}
                            </div>

                            {lastMatch && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
                                    <div className="bg-white/10 p-8 rounded-2xl border border-white/20 shadow-2xl flex flex-col items-center gap-4 max-w-sm">
                                        <div className="p-4 bg-green-500/20 rounded-full text-green-400 mb-2">
                                            <UserCheck size={48} />
                                        </div>
                                        <div>
                                            <h3 className="text-3xl font-bold text-white mb-1">{lastMatch.name}</h3>
                                            <p className="text-lg text-green-300 font-medium">{lastMatch.action}</p>
                                            <p className="text-sm text-gray-400">{lastMatch.time}</p>
                                        </div>

                                        <button
                                            onClick={resetScan}
                                            className="mt-4 btn-primary w-full py-3 text-lg justify-center shadow-xl shadow-blue-500/20 hover:scale-105"
                                        >
                                            Start New Scan
                                        </button>
                                    </div>
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
                        {isScanComplete ? "Attendance Marked. Click 'Start New Scan' to continue." :
                            (mode === 'auto' ? "System will track your 'First Seen' and 'Last Seen' times automatically." :
                                mode === 'check-in' ? "Look at camera to mark Start of Day." : "Look at camera to mark End of Day.")
                        }
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AttendancePage;
