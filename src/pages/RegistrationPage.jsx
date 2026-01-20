import React, { useRef, useState, useEffect } from 'react';
import CameraFeed from '../components/CameraFeed';
import { detectFace, fileToImage, drawDetections, detectAllFaces, getBestFace, createMatcher, estimateHeadPose, isSamePerson } from '../services/faceService';
import { saveUser, generateUniqueId, getUsers } from '../services/storageService';
import { getCurrentUser } from '../services/authService';
import { UserPlus, Check, AlertCircle, Loader2, Building2, ScanFace, Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Angle requirements for each step
// Ranges are approximate degrees. 
// UX Improvement: Minimal thresholds (>0.1 deg) - practically just quadrant checks.
const STEPS = [
    { label: 'Straight', instruction: 'Look Straight', check: (y, p) => Math.abs(y) < 35 && Math.abs(p) < 35 },
    { label: 'Right-Top', instruction: 'Turn Top-Right', check: (y, p) => y < -0.1 && p < -0.1 },
    { label: 'Right-Bottom', instruction: 'Turn Bottom-Right', check: (y, p) => y < -0.1 && p > 0.1 },
    { label: 'Left-Bottom', instruction: 'Turn Bottom-Left', check: (y, p) => y > 0.1 && p > 0.1 },
    { label: 'Left-Top', instruction: 'Turn Top-Left', check: (y, p) => y > 0.1 && p < -0.1 }
];

const RegistrationPage = ({ isModelLoaded }) => {
    const [name, setName] = useState('');
    // Entity is now derived from logged-in admin
    const currentUser = getCurrentUser();
    // Use entity property, fallback to 'Malkajgiri' if not found or 'All'
    const entity = (currentUser && currentUser.entity && currentUser.entity !== 'All') ? currentUser.entity : 'Malkajgiri';
    // Super admins might want to select, but user asked to remove field. We'll default to Malkajgiri or first available for now.
    // If Super Admin needs selection, we can add it back later, but request said "remove branch field".

    const [isscanning, setIsscanning] = useState(false);

    // Multi-step capture state
    const [currentStep, setCurrentStep] = useState(0);
    const [capturedDescriptors, setCapturedDescriptors] = useState([]);
    const [profileImage, setProfileImage] = useState(null);
    const [duplicateFlag, setDuplicateFlag] = useState(null); // Stores ID of potential duplicate

    const [status, setStatus] = useState(null);
    const [feedback, setFeedback] = useState('Position your face...');

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const detectionInterval = useRef(null);
    const navigate = useNavigate();

    // Reset everything
    const resetRegistration = () => {
        setCapturedDescriptors([]);
        setCurrentStep(0);
        setProfileImage(null);
        setStatus(null);
        setFeedback('Position your face...');
        setIsscanning(false);
        setDuplicateFlag(null);
    };

    // Auto Capture Logic
    const attemptAutoCapture = async (detections) => {
        if (!videoRef.current || isscanning) return;

        const best = getBestFace(detections);
        if (!best) {
            setFeedback('No face detected.');
            return;
        }

        // 1. Confidence Check
        // Straight: Strict-ish (> 85%), Others: Ultra Lenient (> 40%) to ensure capture even if blurry/angled
        const isStraight = currentStep === 0;
        const minScore = isStraight ? 0.85 : 0.40;

        if (best.detection.score < minScore) {
            setFeedback('Hold steady / Better lighting...');
            return;
        }

        // 2. Head Pose Check
        const pose = estimateHeadPose(best.landmarks);
        const stepReq = STEPS[currentStep];

        const isAngleCorrect = stepReq.check(pose.yaw, pose.pitch);

        if (!isAngleCorrect) {
            setFeedback(`${stepReq.instruction} (Current: Y${pose.yaw.toFixed(0)}, P${pose.pitch.toFixed(0)})`);
            return;
        }

        // 3. Duplicate Check (Only on Step 0)
        let potentialDuplicate = null;
        if (currentStep === 0) {
            const existingUsers = getUsers();
            if (existingUsers.length > 0) {
                const matcher = createMatcher(existingUsers);
                const match = matcher.findBestMatch(best.descriptor);
                if (match.label !== 'unknown' && match.distance < 0.4) {
                    setFeedback(`Possible Match: ${match.label} (Flagging for Admin)`);
                    potentialDuplicate = match.label;
                }
            }
        }

        if (potentialDuplicate) setDuplicateFlag(potentialDuplicate);

        await performCapture(best);
    };

    const performCapture = async (detection) => {
        setIsscanning(true); // temporary lock
        try {
            // Capture Image
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoRef.current, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);

            // Save Data
            const newDescriptors = [...capturedDescriptors, detection.descriptor];
            setCapturedDescriptors(newDescriptors);

            if (currentStep === 0) {
                setProfileImage(imageData);
            }

            // Move Next
            if (currentStep < STEPS.length - 1) {
                setStatus({ type: 'success', msg: `Captured ${STEPS[currentStep].label}!` });
                setTimeout(() => {
                    setCurrentStep(prev => prev + 1);
                    setStatus(null);
                    setIsscanning(false);
                }, 1000); // 1s pause to show success
            } else {
                // Done
                setStatus({ type: 'success', msg: 'All angles captured. Registering...' });
                // We don't auto-register immediately, we wait for user to confirm Name? 
                // Or if Name is filled, we can enable the "Save" button. 
                // The request said "remove manual capture button", but we still need a "Finalize/Save" button for the form (Name).
                setIsscanning(false);
            }
        } catch (e) {
            console.error(e);
            setIsscanning(false);
        }
    };

    // Live Loop
    useEffect(() => {
        const isComplete = capturedDescriptors.length === STEPS.length;

        if (isModelLoaded && !isComplete && !isscanning) {
            detectionInterval.current = setInterval(async () => {
                if (videoRef.current && canvasRef.current) {
                    const detections = await detectAllFaces(videoRef.current);
                    drawDetections(canvasRef.current, videoRef.current, detections);
                    attemptAutoCapture(detections);
                }
            }, 250); // check 4 times a second
        } else {
            if (detectionInterval.current) clearInterval(detectionInterval.current);
            if (canvasRef.current && (isComplete || isscanning)) {
                // Clear canvas if frozen or complete
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }

        return () => {
            if (detectionInterval.current) clearInterval(detectionInterval.current);
        };
    }, [isModelLoaded, currentStep, isscanning, capturedDescriptors.length]);


    const handleRegister = async () => {
        if (!name.trim()) {
            setStatus({ type: 'error', msg: 'Please enter a name first' });
            return;
        }

        setIsscanning(true);
        try {
            const userId = generateUniqueId(name);
            const user = {
                id: userId,
                name: name,
                entity: entity,
                descriptors: capturedDescriptors,
                duplicateOf: duplicateFlag, // Save flag
                timestamp: new Date().toISOString()
            };

            await saveUser(user, profileImage);
            setStatus({ type: 'success', msg: `User ${name} registered successfully!` });
            setTimeout(() => navigate('/'), 2000);

        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', msg: 'Registration failed. Try again.' });
            setIsscanning(false);
        }
    };

    const isFinished = capturedDescriptors.length === STEPS.length;

    // Helper positions for 5 dots around a circle (Clockwise logic for visual placement)
    // 0: Straight (Top), 1: Right-Top, 2: Right-Bottom, 3: Left-Top, 4: Left-Bottom


    return (
        <div className="flex flex-col items-center justify-center p-4 min-h-screen">
            <div className="glass-panel p-8 w-full max-w-5xl flex flex-col md:flex-row gap-12 items-center">

                {/* Left: Circular Camera UI */}
                <div className="relative flex-none">
                    {/* Container for Circle */}
                    <div className="relative w-[400px] h-[400px] flex items-center justify-center">

                        {/* Circular Progress SVG Arcs */}
                        <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none">
                            {[0, 1, 2, 3, 4].map((i) => {
                                const stepMap = [0, 1, 2, 3, 4];
                                const stepIndex = stepMap[i];
                                const s = STEPS[stepIndex];

                                const centerAngle = 270 + (i * 72);
                                const startAngle = centerAngle - 31;
                                const endAngle = centerAngle + 31;

                                const radius = 180;
                                const center = 200;

                                const toRad = d => d * Math.PI / 180;
                                const x1 = center + radius * Math.cos(toRad(startAngle));
                                const y1 = center + radius * Math.sin(toRad(startAngle));
                                const x2 = center + radius * Math.cos(toRad(endAngle));
                                const y2 = center + radius * Math.sin(toRad(endAngle));

                                const d = [
                                    "M", x1, y1,
                                    "A", radius, radius, 0, 0, 1, x2, y2
                                ].join(" ");

                                const isActive = currentStep === stepIndex;
                                const isCompleted = currentStep > stepIndex || isFinished;

                                return (
                                    <g key={i}>
                                        <path d={d} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" strokeLinecap="round" />
                                        <path
                                            d={d}
                                            fill="none"
                                            stroke={isCompleted ? "#22c55e" : isActive ? "#2563eb" : "rgba(255,255,255,0.1)"}
                                            strokeWidth={isActive ? "16" : "12"}
                                            strokeLinecap="round"
                                            className={`transition-all duration-500 ${isActive ? 'animate-pulse drop-shadow-[0_0_10px_rgba(37,99,235,0.5)]' : ''}`}
                                        />

                                    </g>
                                );
                            })}
                        </svg>

                        {/* The Camera Circle */}
                        <div className="w-[320px] h-[320px] rounded-full overflow-hidden border-4 border-white/10 relative shadow-2xl bg-black">
                            {isModelLoaded ? (
                                isFinished ? (
                                    <img src={profileImage} alt="Final Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <CameraFeed
                                            onVideoReady={(el) => videoRef.current = el}
                                            overlayRef={canvasRef}
                                            className="w-full h-full aspect-auto rounded-none border-none max-w-none"
                                        />
                                        <div className="absolute inset-x-0 bottom-8 text-center pointer-events-none">
                                            {isscanning ? (
                                                <span className="bg-primary/90 text-white px-3 py-1 rounded-full text-sm animate-pulse">Capturing...</span>
                                            ) : (
                                                <span className="bg-black/60 text-white px-3 py-1 rounded-full text-sm backdrop-blur-md border border-white/10">{feedback}</span>
                                            )}
                                        </div>
                                    </>
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                    <span className="text-xs">Loading Models...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Form Actions */}
                <div className="flex-1 w-full max-w-sm flex flex-col gap-6">
                    <div>
                        <h2 className="title text-3xl mb-2">Registration</h2>
                        <p className="text-gray-400 text-sm">Follow the green indicators to capture all 5 face angles.</p>
                    </div>

                    <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                        <div>
                            <label className="text-xs text-muted uppercase tracking-wider font-bold mb-2 block">Full Name</label>
                            <input
                                type="text"
                                placeholder="Enter Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isscanning}
                                className="w-full bg-black/20 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>


                    </div>

                    {status && status.msg && (
                        <div className={`p-4 rounded-xl flex items-start gap-3 text-sm animate-in fade-in transition-all ${status.type === 'success' ? 'bg-green-500/10 text-green-200 border border-green-500/20' : 'bg-red-500/10 text-red-200 border border-red-500/20'}`}>
                            {status.type === 'success' ? <Check className="shrink-0" size={16} /> : <AlertCircle className="shrink-0" size={16} />}
                            <span>{status.msg}</span>
                        </div>
                    )}

                    <div className="flex gap-3 mt-auto">
                        <button
                            onClick={resetRegistration}
                            className="p-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                            title="Reset"
                        >
                            <RefreshCw size={20} />
                        </button>

                        {isFinished && (
                            <button
                                onClick={handleRegister}
                                disabled={isscanning || !name.trim()}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-900/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isscanning ? <Loader2 className="animate-spin" /> : <UserPlus size={20} />}
                                Finalize
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegistrationPage;
