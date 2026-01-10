import React, { useRef, useEffect, useState } from 'react';
import { Camera, XCircle } from 'lucide-react';

const CameraFeed = ({ onVideoReady, overlayRef, isActive = true }) => {
    const videoRef = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let currentStream = null;
        let isMounted = true;
        const videoElement = videoRef.current;

        const startCamera = async () => {
            try {
                if (!isActive) return;

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480 } // Standard resolution for performance
                });

                // If component unmounted while waiting for camera, stop immediately
                if (!isMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                currentStream = stream;
                if (videoElement) {
                    videoElement.srcObject = stream;
                }
            } catch (err) {
                if (isMounted) {
                    console.error("Camera access denied:", err);
                    setError("Camera access required. Please allow permission.");
                }
            }
        };

        startCamera();

        return () => {
            isMounted = false;
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
            if (videoElement) {
                videoElement.srcObject = null;
            }
        };
    }, [isActive]);

    const handleVideoPlay = () => {
        if (onVideoReady && videoRef.current) {
            onVideoReady(videoRef.current);
        }
    };

    return (
        <div className="relative w-full max-w-[640px] aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
            {error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-4 text-center">
                    <XCircle size={48} className="mb-2" />
                    <p>{error}</p>
                </div>
            ) : (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        onPlay={handleVideoPlay}
                        className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
                    />
                    <canvas
                        ref={overlayRef}
                        className="absolute top-0 left-0 w-full h-full" // No mirroring here, logic will handle coordinate flipping
                    />
                    <div className="absolute top-4 right-4 bg-red-600/80 text-white px-2 py-1 rounded text-xs flex items-center gap-1 animate-pulse">
                        <Camera size={12} /> LIVE
                    </div>
                </>
            )}
        </div>
    );
};

export default CameraFeed;
