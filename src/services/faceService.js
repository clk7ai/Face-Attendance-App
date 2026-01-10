import * as faceapi from 'face-api.js';

// Configuration
// Using a public CDN for models to avoid large downloads for the user
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

export const loadModels = async () => {
  try {
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
  // We use 0.6 as the typical threshold for face-api
  const percentage = Math.max(0, (1 - distance) * 100);
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
      // More natural similarity: 0.6 distance is "0%", 0 distance is "100%"
      const similarity = match.label === 'unknown' ? 0 : Math.max(0, (1 - match.distance / 0.6));
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
    // Handle case where descriptor might be stored as a regular object/array
    const descriptor = user.descriptor instanceof Float32Array
      ? user.descriptor
      : new Float32Array(Object.values(user.descriptor));
    return new faceapi.LabeledFaceDescriptors(user.name, [descriptor]);
  });

  return new faceapi.FaceMatcher(labeledDescriptors, 0.6);
};
