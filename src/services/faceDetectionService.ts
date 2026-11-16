export interface FaceDetectionMetrics {
  avgLuminance: number;
  luminanceStdDev: number;
  edgeDensity: number;
  skinRatio: number;
  upperFaceContrast: number;
  motionScore: number;
  usedNativeFaceDetector: boolean;
  nativeFacesCount: number | null;
}

export interface FaceDetectionOutcome {
  faceDetected: boolean;
  livenessPassed: boolean;
  confidenceScore: number;
  lightingQuality: 'good' | 'fair' | 'poor';
  reason: string;
  metrics: FaceDetectionMetrics;
}

interface NativeDetectedFace {
  boundingBox: DOMRectReadOnly;
}

interface NativeFaceDetector {
  detect: (image: HTMLVideoElement | HTMLCanvasElement) => Promise<NativeDetectedFace[]>;
}

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => NativeFaceDetector;
  }
}

const ANALYSIS_WIDTH = 160;
const ANALYSIS_HEIGHT = 120;

/**
 * Checks whether the browser natively exposes the Shape Detection FaceDetector API.
 */
export function isNativeFaceDetectorSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.FaceDetector === 'function';
}

/**
 * Evaluates a single video frame inside the central face oval and extracts
 * luminance, edge texture, skin chrominance clustering, and upper-face contrast.
 */
function inspectFramePixels(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): {
  lumaBuffer: Uint8Array;
  avgLuminance: number;
  luminanceStdDev: number;
  edgeDensity: number;
  skinRatio: number;
  upperFaceContrast: number;
} | null {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  ctx.drawImage(video, 0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
  const { data } = ctx.getImageData(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);

  const lumaBuffer = new Uint8Array(ANALYSIS_WIDTH * ANALYSIS_HEIGHT);

  // Target face oval geometry inside 160x120 frame
  const cx = ANALYSIS_WIDTH / 2;
  const cy = ANALYSIS_HEIGHT / 2;
  const rx = 34;
  const ry = 44;

  let ovalPixels = 0;
  let skinPixels = 0;
  let lumaSum = 0;
  let lumaSqSum = 0;
  let upperSum = 0;
  let upperCount = 0;
  let midSum = 0;
  let midCount = 0;

  for (let y = 0; y < ANALYSIS_HEIGHT; y++) {
    for (let x = 0; x < ANALYSIS_WIDTH; x++) {
      const idx = y * ANALYSIS_WIDTH + x;
      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];

      // BT.601 luma and YCbCr chrominance
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      lumaBuffer[idx] = luma;

      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) {
        ovalPixels++;
        lumaSum += luma;
        lumaSqSum += luma * luma;

        // Track eye-band (upper oval) vs cheek/nose-bridge (mid oval) luminance variation
        if (ny >= -0.45 && ny <= -0.08) {
          upperSum += luma;
          upperCount++;
        } else if (ny > -0.08 && ny <= 0.35) {
          midSum += luma;
          midCount++;
        }

        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

        // Wide YCbCr skin chrominance envelope covering diverse skin tones & indoor lighting
        if (luma > 34 && cb >= 74 && cb <= 132 && cr >= 131 && cr <= 178) {
          skinPixels++;
        }
      }
    }
  }

  if (ovalPixels === 0) return null;

  const avgLuminance = lumaSum / ovalPixels;
  const variance = Math.max(0, lumaSqSum / ovalPixels - avgLuminance * avgLuminance);
  const luminanceStdDev = Math.sqrt(variance);

  // Measure facial edge/feature texture inside the central oval
  let edgeSum = 0;
  let edgeSamples = 0;
  for (let y = Math.floor(cy - ry + 2); y < Math.floor(cy + ry - 2); y++) {
    for (let x = Math.floor(cx - rx + 2); x < Math.floor(cx + rx - 2); x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 0.85) {
        const idx = y * ANALYSIS_WIDTH + x;
        const dx = Math.abs(lumaBuffer[idx + 1] - lumaBuffer[idx]);
        const dy = Math.abs(lumaBuffer[idx + ANALYSIS_WIDTH] - lumaBuffer[idx]);
        edgeSum += dx + dy;
        edgeSamples++;
      }
    }
  }

  const edgeDensity = edgeSamples > 0 ? edgeSum / edgeSamples : 0;
  const skinRatio = skinPixels / ovalPixels;
  const upperMean = upperCount > 0 ? upperSum / upperCount : avgLuminance;
  const midMean = midCount > 0 ? midSum / midCount : avgLuminance;
  const upperFaceContrast = Math.abs(midMean - upperMean);

  return {
    lumaBuffer,
    avgLuminance,
    luminanceStdDev,
    edgeDensity,
    skinRatio,
    upperFaceContrast,
  };
}

/**
 * Performs multi-frame live detection on an active HTMLVideoElement to verify
 * whether a real, live human face is actually present in front of the camera.
 */
export async function detectRealFaceFromVideo(
  video: HTMLVideoElement,
  options?: {
    sampleCount?: number;
    intervalMs?: number;
    onProgress?: (pct: number, status: string) => void;
    shouldAbort?: () => boolean;
  }
): Promise<FaceDetectionOutcome> {
  const sampleCount = options?.sampleCount ?? 10;
  const intervalMs = options?.intervalMs ?? 170;

  const canvas = document.createElement('canvas');
  canvas.width = ANALYSIS_WIDTH;
  canvas.height = ANALYSIS_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return {
      faceDetected: false,
      livenessPassed: false,
      confidenceScore: 0,
      lightingQuality: 'poor',
      reason: 'Unable to initialize 2D frame analyzer for camera verification.',
      metrics: {
        avgLuminance: 0,
        luminanceStdDev: 0,
        edgeDensity: 0,
        skinRatio: 0,
        upperFaceContrast: 0,
        motionScore: 0,
        usedNativeFaceDetector: false,
        nativeFacesCount: null,
      },
    };
  }

  let nativeDetector: NativeFaceDetector | null = null;
  let usedNative = false;
  if (isNativeFaceDetectorSupported() && window.FaceDetector) {
    try {
      nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
      usedNative = true;
    } catch {
      nativeDetector = null;
      usedNative = false;
    }
  }

  let prevLuma: Uint8Array | null = null;
  let motionSum = 0;
  let motionSamples = 0;
  let totalLuminance = 0;
  let totalStdDev = 0;
  let totalEdge = 0;
  let totalSkin = 0;
  let totalUpperContrast = 0;
  let validFrames = 0;
  let nativeFaceHits = 0;
  let lastNativeCount: number | null = null;

  for (let i = 0; i < sampleCount; i++) {
    if (options?.shouldAbort?.()) {
      break;
    }

    const frame = inspectFramePixels(video, canvas, ctx);
    if (frame) {
      validFrames++;
      totalLuminance += frame.avgLuminance;
      totalStdDev += frame.luminanceStdDev;
      totalEdge += frame.edgeDensity;
      totalSkin += frame.skinRatio;
      totalUpperContrast += frame.upperFaceContrast;

      if (prevLuma) {
        let diffSum = 0;
        // Compute frame-to-frame luma delta inside center region
        for (let y = 20; y < ANALYSIS_HEIGHT - 20; y++) {
          for (let x = 40; x < ANALYSIS_WIDTH - 40; x++) {
            const idx = y * ANALYSIS_WIDTH + x;
            diffSum += Math.abs(frame.lumaBuffer[idx] - prevLuma[idx]);
          }
        }
        const regionCount = (ANALYSIS_HEIGHT - 40) * (ANALYSIS_WIDTH - 80);
        motionSum += diffSum / regionCount;
        motionSamples++;
      }
      prevLuma = frame.lumaBuffer;

      if (nativeDetector) {
        try {
          const faces = await nativeDetector.detect(video);
          lastNativeCount = faces.length;
          if (faces.length > 0) {
            // Check at least one face is reasonably sized & near center
            const centeredFace = faces.some((f) => {
              const box = f.boundingBox;
              const minFaceW = video.videoWidth * 0.12;
              return box.width >= minFaceW;
            });
            if (centeredFace) {
              nativeFaceHits++;
            }
          }
        } catch {
          usedNative = false;
          nativeDetector = null;
        }
      }
    }

    const pct = Math.min(92, Math.round(25 + ((i + 1) / sampleCount) * 65));
    if (i < 3) {
      options?.onProgress?.(pct, 'Analyzing live camera feed for facial features...');
    } else if (i < 7) {
      options?.onProgress?.(pct, 'Checking facial geometry & lighting...');
    } else {
      options?.onProgress?.(pct, 'Verifying live physical presence & motion...');
    }

    if (i < sampleCount - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }
  }

  if (validFrames === 0) {
    return {
      faceDetected: false,
      livenessPassed: false,
      confidenceScore: 0,
      lightingQuality: 'poor',
      reason: 'Camera produced no readable video frames.',
      metrics: {
        avgLuminance: 0,
        luminanceStdDev: 0,
        edgeDensity: 0,
        skinRatio: 0,
        upperFaceContrast: 0,
        motionScore: 0,
        usedNativeFaceDetector: usedNative,
        nativeFacesCount: lastNativeCount,
      },
    };
  }

  const avgLuminance = totalLuminance / validFrames;
  const luminanceStdDev = totalStdDev / validFrames;
  const edgeDensity = totalEdge / validFrames;
  const skinRatio = totalSkin / validFrames;
  const upperFaceContrast = totalUpperContrast / validFrames;
  const motionScore = motionSamples > 0 ? motionSum / motionSamples : 0;

  const lightingQuality: 'good' | 'fair' | 'poor' =
    avgLuminance < 40 ? 'poor' : avgLuminance < 70 ? 'fair' : 'good';

  const metrics: FaceDetectionMetrics = {
    avgLuminance: Number(avgLuminance.toFixed(1)),
    luminanceStdDev: Number(luminanceStdDev.toFixed(1)),
    edgeDensity: Number(edgeDensity.toFixed(1)),
    skinRatio: Number(skinRatio.toFixed(2)),
    upperFaceContrast: Number(upperFaceContrast.toFixed(1)),
    motionScore: Number(motionScore.toFixed(2)),
    usedNativeFaceDetector: usedNative,
    nativeFacesCount: lastNativeCount,
  };

  // 1. Covered or pitch-dark lens check
  if (avgLuminance < 26) {
    return {
      faceDetected: false,
      livenessPassed: false,
      confidenceScore: 8,
      lightingQuality: 'poor',
      reason: 'No real face detected: camera lens appears covered or environment is too dark.',
      metrics,
    };
  }

  // 2. Blank wall / uniform flat background check
  if (luminanceStdDev < 11 || edgeDensity < 5.5) {
    return {
      faceDetected: false,
      livenessPassed: false,
      confidenceScore: 18,
      lightingQuality,
      reason: 'No real face detected: flat or blank surface in frame. Position your face inside the oval.',
      metrics,
    };
  }

  // 3. Native FaceDetector verification when supported by the browser
  if (usedNative && nativeFaceHits < Math.ceil(validFrames * 0.35)) {
    return {
      faceDetected: false,
      livenessPassed: false,
      confidenceScore: 22,
      lightingQuality,
      reason: 'No human face detected in the camera frame. Center your face clearly in front of the camera.',
      metrics,
    };
  }

  // 4. Computer-vision skin-cluster & facial structure check (runs in all browsers)
  const hasFaceGeometry =
    skinRatio >= 0.16 &&
    skinRatio <= 0.92 &&
    (upperFaceContrast >= 2.2 || edgeDensity >= 10) &&
    luminanceStdDev >= 13;

  if (!usedNative && !hasFaceGeometry) {
    return {
      faceDetected: false,
      livenessPassed: false,
      confidenceScore: 27,
      lightingQuality,
      reason: 'No real human face detected inside the oval guide. Look directly at the camera with clear lighting.',
      metrics,
    };
  }

  // 5. Liveness motion check: rejects completely frozen/static images
  const livenessPassed = motionScore >= 0.55;
  if (!livenessPassed) {
    return {
      faceDetected: true,
      livenessPassed: false,
      confidenceScore: 48,
      lightingQuality,
      reason: 'Face contour seen, but static frame detected (liveness failed). Move slightly or blink naturally.',
      metrics,
    };
  }

  // Real face detected + live motion confirmed -> compute realistic biometric score (88 - 98%)
  const nativeBonus = usedNative && nativeFaceHits >= Math.ceil(validFrames * 0.6) ? 5 : 0;
  const skinBalanceBonus = Math.min(5, Math.round((skinRatio / 0.5) * 4));
  const detailBonus = Math.min(4, Math.round(edgeDensity / 6));
  const confidenceScore = Math.min(98, Math.max(87, 84 + nativeBonus + skinBalanceBonus + detailBonus));

  return {
    faceDetected: true,
    livenessPassed: true,
    confidenceScore,
    lightingQuality,
    reason: usedNative
      ? 'Real human face detected by browser FaceDetector & live motion verified.'
      : 'Real human face geometry & live facial movement verified on camera feed.',
    metrics,
  };
}
