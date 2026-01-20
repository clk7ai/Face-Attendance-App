import * as faceapi from '@vladmandic/face-api';

// Configuration
// Using a public CDN for models to avoid large downloads for the user
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

export const loadModels = async () => {
  try {
    // Debug: Check/Set Backend
    // console.log("Current Backend:", faceapi.tf?.getBackend());
    // await faceapi.tf?.setBackend('webgl');
    // await faceapi.tf?.ready();

    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    return true;
  } catch (error) {
    console.error("Failed to load models:", error);
    return false;
  }
};

export const detectAllFaces = async (sourceElement) => {
  if (!sourceElement) return [];
  return await faceapi.detectAllFaces(sourceElement)
    .withFaceLandmarks()
    .withFaceDescriptors();
};

export const getBestFace = (detections) => {
  if (!detections || detections.length === 0) return null;

  // "Best face" strategy:
  // 1. Filter by confidence threshold (0.6)
  // 2. Pick the largest face (closest to camera/most relevant)
  const validDetections = detections.filter(d => d.detection.score > 0.6);
  if (validDetections.length === 0) return null;

  return validDetections.reduce((best, current) => {
    const bestArea = best.detection.box.width * best.detection.box.height;
    const currentArea = current.detection.box.width * current.detection.box.height;
    return (currentArea > bestArea) ? current : best;
  });
};

export const detectFace = async (sourceElement) => {
  const detections = await detectAllFaces(sourceElement);
  return getBestFace(detections);
};

export const matchToPercentage = (distance) => {
  // distance 0.0 = 100% match, distance 1.0+ = 0% match
  // We use 0.7 as the threshold for consistency with createMatcher
  const percentage = Math.max(0, (1 - distance / 0.7) * 100);
  return percentage.toFixed(1) + '%';
};

export const drawDetections = (canvas, sourceElement, detections, matcher = null) => {
  if (!canvas || !sourceElement || !detections) return;

  const displaySize = {
    width: sourceElement.videoWidth || sourceElement.width || 640,
    height: sourceElement.videoHeight || sourceElement.height || 480
  };
  faceapi.matchDimensions(canvas, displaySize);

  const resizedDetections = faceapi.resizeResults(detections, displaySize);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Detections come from the raw video frame.
  // Our CSS mirrors the video (scale-x-[-1]), so we must flip the canvas drawing.
  // But we don't want to mirror the text. So we flip the coordinates manually.
  const isVideo = sourceElement instanceof HTMLVideoElement;

  resizedDetections.forEach(detection => {
    let { x, y, width, height } = detection.detection.box;

    if (isVideo) {
      // Flip X coordinate for the box to align with mirrored video
      x = displaySize.width - x - width;
    }

    let label = '';
    let boxColor = '#3b82f6'; // Blue for detection

    if (matcher) {
      const match = matcher.findBestMatch(detection.descriptor);
      // More natural similarity: 0.7 distance is "0%", 0 distance is "100%"
      const similarity = match.label === 'unknown' ? 0 : Math.max(0, (1 - match.distance / 0.7));
      label = `${match.label} (${(similarity * 100).toFixed(0)}%)`;
      boxColor = match.label === 'unknown' ? '#ef4444' : '#10b981';
    } else {
      label = `Face (${(detection.detection.score * 100).toFixed(0)}%)`;
    }

    const drawBox = new faceapi.draw.DrawBox({ x, y, width, height }, {
      label: label,
      boxColor: boxColor,
      drawLabelOptions: { fontSize: 16, fontStyle: 'Inter, sans-serif' }
    });
    drawBox.draw(canvas);
  });
};

export const fileToImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const createMatcher = (users) => {
  if (!users || users.length === 0) return null;

  const labeledDescriptors = users.map(user => {
    // New Schema: user.descriptors (array of arrays/Float32Arrays)
    // Fallback: user.descriptor (legacy single descriptor)
    const descriptors = user.descriptors || [user.descriptor];

    const float32Descriptors = descriptors.map(d =>
      d instanceof Float32Array ? d : new Float32Array(Object.values(d))
    );

    return new faceapi.LabeledFaceDescriptors(user.name, float32Descriptors);
  });

  return new faceapi.FaceMatcher(labeledDescriptors, 0.7); // Looser threshold (0.6 -> 0.7) for better detection
};

export const checkMatchThreshold = (distance, thresholdPercentage = 20) => {
  // distance 0.0 = 100% match, distance >= 0.7 = 0% match (matches 'unknown')
  // We normalize this: score = (1 - (distance / 0.7)) * 100
  // If distance > 0.7, the match is 'unknown', so score is 0.

  if (distance > 0.7) return false;

  const score = (1 - (distance / 0.7)) * 100;
  return score >= thresholdPercentage;
};

export const estimateHeadPose = (landmarks) => {
  // A simplified heuristic for head pose using basic landmark geometry.
  // Ideally, full PnP (Perspective-n-Point) is used, but for 2D landmarks we approximate.

  const nose = landmarks.getNose();
  const noseTip = nose[3]; // Approx tip of nose
  const leftEye = landmarks.getLeftEye()[0]; // Outer corner
  const rightEye = landmarks.getRightEye()[3]; // Outer corner
  const jaw = landmarks.getJawOutline();
  const leftJaw = jaw[0];
  const rightJaw = jaw[16];

  // YAW (Turning Left/Right)
  // Compare nose horizontal position to center of eyes or jaw
  const jawWidth = rightJaw.x - leftJaw.x;
  const noseRelX = noseTip.x - leftJaw.x;
  const yawRatio = noseRelX / jawWidth; // 0.5 is centered, < 0.5 look right (our left), > 0.5 look left (our right)

  // PITCH (Looking Up/Down)
  // Compare nose vertical position to eyes and jaw
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const jawBottomY = jaw[8].y;
  const faceHeight = jawBottomY - eyeMidY;
  const noseRelY = noseTip.y - eyeMidY;
  const pitchRatio = noseRelY / faceHeight;

  // These thresholds are experimental and might need tuning
  // Yaw: <0.4 (Right), >0.6 (Left)
  // Pitch: <0.3 (Up), >0.5 (Down)

  // Convert to readable angles (approximate)
  let yaw = 0; // 0=center, -ve=right, +ve=left
  if (yawRatio < 0.45) yaw = -30;
  if (yawRatio > 0.55) yaw = 30;

  let pitch = 0; // 0=center, -ve=up, +ve=down
  if (pitchRatio < 0.35) pitch = -30; // looking up
  if (pitchRatio > 0.5) pitch = 30; // looking down (nose closer to jaw)

  // More granular return
  return {
    yawRatio: yawRatio.toFixed(2),
    pitchRatio: pitchRatio.toFixed(2),
    yaw,   // Simplified bucketing
    pitch  // Simplified bucketing
  };
};

export const isSamePerson = (descriptor1, descriptor2) => {
  // Euclidean distance between descriptors
  if (!descriptor1 || !descriptor2) return false;
  const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
  // Strict threshold for identity verification during registration: 0.4
  // 0.6 is typical for "match", but for "same person immediately" we want strictness
  return distance < 0.4;
};
