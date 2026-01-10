// Simple beep sounds using Web Audio API to avoid external assets
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const playTone = (freq, type, duration) => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
};

export const playSuccessSound = () => {
    // Positive chime
    playTone(800, 'sine', 0.1);
    setTimeout(() => playTone(1200, 'sine', 0.2), 100);
};

export const playErrorSound = () => {
    // Negative buzz
    playTone(200, 'sawtooth', 0.3);
};
