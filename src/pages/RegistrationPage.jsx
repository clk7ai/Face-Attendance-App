import React, { useRef, useState, useEffect } from 'react';
import CameraFeed from '../components/CameraFeed';
import { detectFace, fileToImage, drawDetections, detectAllFaces, getBestFace, createMatcher } from '../services/faceService';
import { saveUser, generateUniqueId, getUsers } from '../services/storageService';
import { UserPlus, Check, AlertCircle, Loader2, Building2, Upload, Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const RegistrationPage = ({ isModelLoaded }) => {
    const [name, setName] = useState('');
    const [branch, setBranch] = useState('Malkajgiri');
    const [isscanning, setIsscanning] = useState(false);
    const [mode, setMode] = useState('live'); // 'live' | 'upload'
    const [status, setStatus] = useState(null); // { type: 'success' | 'error', msg: '' }
    const [previewImage, setPreviewImage] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [frozenDetection, setFrozenDetection] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const detectionInterval = useRef(null);
    const navigate = useNavigate();

    const captureFace = async () => {
        if (!videoRef.current) return false;

        try {
            const detections = await detectAllFaces(videoRef.current);
            const best = getBestFace(detections);

            if (!best) {
                setStatus({ type: 'error', msg: 'No human face detected. Please face the camera.' });
                return false;
            }

            // --- DE-DUPLICATION CHECK ---
            const existingUsers = getUsers();
            if (existingUsers.length > 0) {
                const matcher = createMatcher(existingUsers);
                const match = matcher.findBestMatch(best.descriptor);

                // 95% confidence = distance of approx 0.03 (since max is 0.6 for 'unknown')
                // similarity = (1 - dist/0.6) * 100. So 95% means dist = 0.6 * (1 - 0.95) = 0.03
                if (match.label !== 'unknown' && match.distance < 0.03) {
                    console.warn(`Duplicate face detected: matched ${match.label} with distance ${match.distance}`);
                    setStatus({
                        type: 'error',
                        msg: `User already registered as "${match.label}". Duplicate registrations are not allowed.`
                    });
                    return false;
                }
            }
            // ---------------------------

            // Capture the image from video
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            // Apply horizontal flip to match mirrored view
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoRef.current, 0, 0);

            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            setPreviewImage(imageData);
            setFrozenDetection(best);
            setStatus({ type: 'success', msg: 'Face captured! Please review and finalize.' });
            return true;
        } catch (err) {
            console.error("Capture failed:", err);
            return false;
        }
    };

    // Live Detection Loop
    useEffect(() => {
        if (mode === 'live' && isModelLoaded && !frozenDetection && !isscanning) {
            detectionInterval.current = setInterval(async () => {
                if (videoRef.current && canvasRef.current) {
                    const detections = await detectAllFaces(videoRef.current);

                    // Show boxes with correct labels
                    drawDetections(canvasRef.current, videoRef.current, detections);

                    // Check for high confidence face to auto-freeze (95% as requested)
                    const best = getBestFace(detections);
                    if (best && best.detection.score > 0.95) {
                        console.log("Auto-capturing face with confidence:", best.detection.score);
                        captureFace();
                    }
                }
            }, 250);
        } else {
            if (detectionInterval.current) clearInterval(detectionInterval.current);
            // Clear canvas if frozen or scanning
            if (canvasRef.current && (frozenDetection || isscanning)) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }

        return () => {
            if (detectionInterval.current) clearInterval(detectionInterval.current);
        };
    }, [mode, isModelLoaded, frozenDetection, isscanning]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
            setPreviewImage(event.target.result);
        };
        reader.readAsDataURL(file);
        setStatus(null);
        setFrozenDetection(null);
    };

    const handleRegister = async () => {
        if (!name.trim()) {
            setStatus({ type: 'error', msg: 'Please enter a name first' });
            return;
        }

        setIsscanning(true);
        setStatus(null);

        try {
            let detection = frozenDetection;
            let imageData = previewImage;

            if (mode === 'live') {
                if (!frozenDetection) {
                    const captured = await captureFace();
                    if (!captured) {
                        setIsscanning(false);
                        return;
                    }
                    // If we just captured, we stay in "frozen" state for user to click "Finalize"
                    setIsscanning(false);
                    return;
                }
                // If already frozen, we use the stored detection and imageData
            } else {
                if (!selectedFile) {
                    setStatus({ type: 'error', msg: 'Please select an image first' });
                    setIsscanning(false);
                    return;
                }
                const img = await fileToImage(selectedFile);
                detection = await detectFace(img);
                imageData = previewImage;
            }

            if (!detection) {
                setStatus({ type: 'error', msg: 'No face detected.' });
                setIsscanning(false);
                return;
            }

            // --- FINAL DE-DUPLICATION CHECK ---
            const existingUsers = getUsers();
            if (existingUsers.length > 0) {
                const matcher = createMatcher(existingUsers);
                const match = matcher.findBestMatch(detection.descriptor);
                if (match.label !== 'unknown' && match.distance < 0.03) {
                    setStatus({
                        type: 'error',
                        msg: `User already registered as "${match.label}". Duplicate registrations are not allowed.`
                    });
                    setIsscanning(false);
                    return;
                }
            }
            // ---------------------------------

            const userId = generateUniqueId(name);
            const user = {
                id: userId,
                name: name,
                branch: branch,
                descriptor: detection.descriptor,
                timestamp: new Date().toISOString()
            };

            await saveUser(user, imageData);
            setStatus({ type: 'success', msg: `User ${name} registered successfully!` });
            setTimeout(() => navigate('/'), 2000);

        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', msg: 'Registration failed. Try again.' });
        } finally {
            setIsscanning(false);
        }
    };

    const resetRegistration = () => {
        setFrozenDetection(null);
        setPreviewImage(null);
        setSelectedFile(null);
        setStatus(null);
    };

    const fileInputRef = useRef(null);

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="glass-panel p-8 w-full max-w-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <UserPlus className="text-primary" size={28} />
                        <h2 className="title text-2xl m-0">Register New User</h2>
                    </div>
                    <div className="flex bg-black/40 p-1 rounded-lg border border-gray-800">
                        <button
                            onClick={() => { setMode('live'); resetRegistration(); }}
                            className={`px-4 py-1.5 rounded-md text-sm transition-all flex items-center gap-2 ${mode === 'live' ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}
                        >
                            <CameraIcon size={14} /> Live
                        </button>
                        <button
                            onClick={() => { setMode('upload'); resetRegistration(); }}
                            className={`px-4 py-1.5 rounded-md text-sm transition-all flex items-center gap-2 ${mode === 'upload' ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}
                        >
                            <Upload size={14} /> Upload
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="flex justify-center min-h-[300px] relative">
                        {mode === 'live' ? (
                            isModelLoaded ? (
                                frozenDetection ? (
                                    <div className="relative w-full max-w-[640px] aspect-video rounded-2xl overflow-hidden border border-primary/50">
                                        <img src={previewImage} alt="Captured" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                            <div className="bg-primary/80 text-white px-4 py-2 rounded-full flex items-center gap-2">
                                                <Check size={18} /> Face Captured
                                            </div>
                                        </div>
                                        <button
                                            onClick={resetRegistration}
                                            className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors"
                                        >
                                            <RefreshCw size={20} />
                                        </button>
                                    </div>
                                ) : (
                                    <CameraFeed
                                        onVideoReady={(el) => videoRef.current = el}
                                        overlayRef={canvasRef}
                                    />
                                )
                            ) : (
                                <div className="h-64 w-full max-w-[640px] flex items-center justify-center text-muted bg-black/20 rounded-2xl border border-dashed border-gray-700">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="animate-spin text-primary" />
                                        <span>Loading Face Models...</span>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full max-w-[640px] aspect-video bg-black/20 rounded-2xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden group"
                            >
                                {previewImage ? (
                                    <div className="relative w-full h-full">
                                        <img src={previewImage} alt="Preview" className="w-full h-full object-contain" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <span className="text-white text-sm bg-black/60 px-3 py-1.5 rounded-full">Change Image</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 text-muted">
                                        <Upload size={48} className="text-gray-600" />
                                        <div className="text-center">
                                            <p className="font-semibold text-gray-300">Click to upload photo</p>
                                            <p className="text-xs">Supports JPG, PNG (Max 5MB)</p>
                                        </div>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-muted uppercase tracking-wider font-semibold">Full Name : </label>
                                <input
                                    type="text"
                                    placeholder="Enter person's name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={isscanning}
                                    className="mt-3"
                                />
                            </div>

                            <div>
                                <label className="text-sm text-muted uppercase tracking-wider font-semibold flex items-center gap-2"><Building2 size={14} /> Branch</label>
                                <select
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    disabled={isscanning}
                                    className="mt-1 w-full bg-black/20 border border-gray-700 rounded-lg p-3 text-white focus:border-primary outline-none disabled:opacity-50"
                                >
                                    <option value="Malkajgiri">Malkajgiri</option>
                                    <option value="Manikonda">Manikonda</option>
                                </select>
                            </div>
                        </div>

                        {!frozenDetection ? (
                            <button
                                onClick={handleRegister}
                                disabled={isscanning || (mode === 'live' && !isModelLoaded) || (mode === 'upload' && !selectedFile)}
                                className="btn-primary flex items-center justify-center gap-2 mt-4 disabled:opacity-50 h-12"
                            >
                                {isscanning ? <Loader2 className="animate-spin" /> : (mode === 'live' ? <CameraIcon size={18} /> : <Check size={18} />)}
                                {isscanning ? 'Verifying...' : (mode === 'live' ? 'Capture Face' : 'Register User')}
                            </button>
                        ) : (
                            <button
                                onClick={handleRegister}
                                disabled={isscanning}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-4 h-12 transition-colors"
                            >
                                {isscanning ? <Loader2 className="animate-spin" /> : <UserPlus size={18} />}
                                {isscanning ? 'Syncing...' : 'Finalize Registration'}
                            </button>
                        )}
                    </div>

                    {status && (
                        <div className={`p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 ${status.type === 'success' ? 'bg-green-500/20 text-green-200 border border-green-500/30' : 'bg-red-500/20 text-red-200 border border-red-500/30'
                            }`}>
                            {status.type === 'success' ? <Check className="shrink-0" size={18} /> : <AlertCircle className="shrink-0" size={18} />}
                            <span className="text-sm font-medium">{status.msg}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegistrationPage;
