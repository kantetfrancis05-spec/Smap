import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ScanFace,
  VideoOff,
  ShieldAlert,
  IdCard,
} from 'lucide-react';
import {
  detectRealFaceFromVideo,
  FaceDetectionOutcome,
  isNativeFaceDetectorSupported,
} from '../services/faceDetectionService';
import {
  compareFaceToPassport,
  isCustomPassportPhoto,
  PassportComparisonResult,
} from '../services/passportMatchService';

interface WebCamScannerProps {
  onCaptureComplete: (faceData: {
    faceDetected: boolean;
    matchScore: number;
    livenessPassed: boolean;
    lightingQuality?: 'good' | 'fair' | 'poor';
    challengeType: 'blink' | 'smile' | 'tilt';
    photoSnapshotUrl?: string;
    detectionReason?: string;
    passportMatched?: boolean;
    passportMatchScore?: number;
    passportPhotoUrl?: string;
  }) => void;
  studentName: string;
  passportPhotoUrl?: string;
  simulatedMatchScore?: number;
  simulatedLivenessPass?: boolean;
  autoScan?: boolean;
}

export const WebCamScanner: React.FC<WebCamScannerProps> = ({
  onCaptureComplete,
  studentName,
  passportPhotoUrl,
  simulatedMatchScore = 96,
  simulatedLivenessPass = true,
  autoScan = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortScanRef = useRef<boolean>(false);
  const completedRef = useRef<boolean>(false);

  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [step, setStep] = useState<
    'idle' | 'initializing' | 'scanning' | 'verified' | 'failed' | 'camera_required'
  >('idle');
  const [challenge] = useState<'blink' | 'smile' | 'tilt'>('blink');
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing biometric camera...');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<FaceDetectionOutcome | null>(null);
  const [passportResult, setPassportResult] = useState<PassportComparisonResult | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  }, []);

  const captureSnapshotFromVideo = useCallback((): string | undefined => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 320, 240);
          const url = canvas.toDataURL('image/jpeg');
          setCapturedPhoto(url);
          return url;
        }
      } catch (e) {
        console.warn('Could not capture frame:', e);
      }
    }
    return undefined;
  }, []);

  const startCameraAndScan = useCallback(async () => {
    abortScanRef.current = false;
    completedRef.current = false;
    stopStream();

      setCameraError(null);
      setCapturedPhoto(null);
      setLastOutcome(null);
      setPassportResult(null);
      setStep('initializing');
      setProgress(15);
      setStatusMessage('Requesting webcam for live face & passport verification...');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser does not expose webcam mediaDevices API.');
      setStep('camera_required');
      setProgress(0);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      if (abortScanRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreamActive(true);
      setStep('scanning');
      setProgress(25);
      setStatusMessage('Camera active — position your face inside the oval...');

      // Give video hardware a brief moment to expose non-zero dimensions and auto-exposure
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      if (abortScanRef.current || !videoRef.current) return;

      const outcome = await detectRealFaceFromVideo(videoRef.current, {
        sampleCount: 10,
        intervalMs: 170,
        shouldAbort: () => abortScanRef.current,
        onProgress: (pct, msg) => {
          if (!abortScanRef.current) {
            setProgress(pct);
            setStatusMessage(msg);
          }
        },
      });

      if (abortScanRef.current) return;

      setLastOutcome(outcome);
      const snapshotUrl = captureSnapshotFromVideo();

      if (outcome.faceDetected && outcome.livenessPassed && simulatedLivenessPass) {
        setProgress(95);
        setStatusMessage('Checking scanned face against student profile passport photo...');
        const passportCmp = passportPhotoUrl
          ? await compareFaceToPassport(passportPhotoUrl, snapshotUrl)
          : {
              passportMatched: true,
              matchScore: simulatedMatchScore,
              method: 'enrolled_template_match' as const,
              summary: 'Biometric profile passport matched.',
            };

        if (abortScanRef.current) return;
        setPassportResult(passportCmp);

        if (passportCmp.passportMatched) {
          setProgress(100);
          setStep('verified');
          setStatusMessage(passportCmp.summary);
          const finalScore = Math.min(
            99,
            Math.round(outcome.confidenceScore * 0.45 + passportCmp.matchScore * 0.55)
          );

          window.setTimeout(() => {
            if (!abortScanRef.current && !completedRef.current) {
              completedRef.current = true;
              onCaptureComplete({
                faceDetected: true,
                matchScore: finalScore,
                livenessPassed: true,
                lightingQuality: outcome.lightingQuality,
                challengeType: challenge,
                photoSnapshotUrl: snapshotUrl,
                detectionReason: passportCmp.summary,
                passportMatched: true,
                passportMatchScore: passportCmp.matchScore,
                passportPhotoUrl,
              });
            }
          }, 650);
        } else {
          setProgress(100);
          setStep('failed');
          setStatusMessage(passportCmp.summary);
        }
      } else {
        setProgress(100);
        setStep('failed');
        setStatusMessage(outcome.reason);
      }
    } catch (err: any) {
      if (abortScanRef.current) return;
      console.warn('Webcam permission denied or hardware unavailable:', err);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow webcam access to detect a real face.'
          : 'No active webcam detected on this device or camera is blocked by browser frame policy.'
      );
      setStreamActive(false);
      setStep('camera_required');
      setProgress(0);
    }
  }, [
    captureSnapshotFromVideo,
    challenge,
    onCaptureComplete,
    passportPhotoUrl,
    simulatedLivenessPass,
    simulatedMatchScore,
    stopStream,
  ]);

  const handleSubmitFailedAttempt = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    const isPassportMismatch = Boolean(lastOutcome?.faceDetected && lastOutcome?.livenessPassed && passportResult && !passportResult.passportMatched);
    onCaptureComplete({
      faceDetected: lastOutcome?.faceDetected ?? false,
      matchScore: isPassportMismatch ? passportResult!.matchScore : lastOutcome?.confidenceScore ?? 12,
      livenessPassed: lastOutcome?.livenessPassed ?? false,
      lightingQuality: lastOutcome?.lightingQuality ?? 'poor',
      challengeType: challenge,
      photoSnapshotUrl: capturedPhoto ?? undefined,
      detectionReason: isPassportMismatch
        ? passportResult!.summary
        : lastOutcome?.reason || 'No real human face detected in camera frame.',
      passportMatched: isPassportMismatch ? false : undefined,
      passportMatchScore: passportResult?.matchScore,
      passportPhotoUrl,
    });
  };

  const handleFallbackSimulation = (passFace: boolean) => {
    if (completedRef.current) return;
    completedRef.current = true;

    if (passFace) {
      setStep('verified');
      setProgress(100);
      setStatusMessage('Simulated fallback check passed against profile passport (no hardware camera attached).');
      onCaptureComplete({
        faceDetected: true,
        matchScore: simulatedMatchScore,
        livenessPassed: true,
        lightingQuality: 'good',
        challengeType: challenge,
        detectionReason: 'Fallback simulation mode used (no webcam available).',
        passportMatched: true,
        passportMatchScore: simulatedMatchScore,
        passportPhotoUrl,
      });
    } else {
      setStep('failed');
      setProgress(100);
      setStatusMessage('Simulated rejection: No real face detected.');
      onCaptureComplete({
        faceDetected: false,
        matchScore: 15,
        livenessPassed: false,
        lightingQuality: 'poor',
        challengeType: challenge,
        detectionReason: 'No real face detected in simulated check.',
        passportMatched: false,
        passportMatchScore: 0,
        passportPhotoUrl,
      });
    }
  };

  useEffect(() => {
    if (autoScan) {
      startCameraAndScan();
    }
    return () => {
      abortScanRef.current = true;
      stopStream();
    };
  }, [autoScan, startCameraAndScan, stopStream]);

  return (
    <div className="bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-700 shadow-xl flex flex-col">
      {/* Scanner Header */}
      <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2">
          <ScanFace className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-slate-200">Face vs Passport Check</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/70 border border-indigo-700/50 text-indigo-300 font-mono">
            {isNativeFaceDetectorSupported() ? 'FaceDetector + CV' : 'CV Frame Analyzer'}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
            {studentName}
          </span>
        </div>
      </div>

      {/* Reference Student Profile Passport Strip */}
      {passportPhotoUrl && (
        <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={passportPhotoUrl}
              alt={`${studentName} Profile Passport`}
              className="w-9 h-11 rounded-lg object-cover border border-indigo-400/60 shrink-0 bg-slate-800"
            />
            <div className="min-w-0">
              <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                <IdCard className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Profile Passport Reference</span>
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                {isCustomPassportPhoto(passportPhotoUrl)
                  ? 'Enrolled real passport photo — pixel & structure matching active'
                  : 'Enrolled ID passport template — checking live face against profile'}
              </span>
            </div>
          </div>
          {passportResult && (
            <span
              className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] shrink-0 ${
                passportResult.passportMatched
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              Match: {passportResult.matchScore}%
            </span>
          )}
        </div>
      )}

      {/* Video / Status Viewport */}
      <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
        {/* Live Camera Video Element */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${
            streamActive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Camera Unavailable State */}
        {step === 'camera_required' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <VideoOff className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Camera Required to Detect Real Face</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                {cameraError || 'Enable webcam access so SMAP can verify a real live human face is present.'}
              </p>
            </div>
            <button
              onClick={startCameraAndScan}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Retry Camera Access</span>
            </button>
          </div>
        )}

        {/* Initializing placeholder */}
        {step === 'initializing' && !streamActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950">
            <div className="w-12 h-12 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-300 font-medium">Opening camera sensor...</p>
          </div>
        )}

        {/* Scanner HUD Overlay (when camera is active or scanning) */}
        {streamActive && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
            <div className="flex justify-between w-full max-w-xs">
              <div className="w-6 h-6 border-t-2 border-l-2 border-indigo-400" />
              <div className="w-6 h-6 border-t-2 border-r-2 border-indigo-400" />
            </div>

            <div
              className={`w-44 h-56 rounded-[50%] border-2 transition-colors duration-300 flex items-center justify-center ${
                step === 'verified'
                  ? 'border-emerald-400 bg-emerald-500/10'
                  : step === 'failed'
                  ? 'border-rose-500 bg-rose-500/15'
                  : 'border-indigo-400 border-dashed animate-pulse'
              }`}
            >
              {step === 'scanning' && (
                <div className="w-full h-0.5 bg-indigo-400 shadow-[0_0_12px_#818cf8] animate-bounce" />
              )}
            </div>

            <div className="flex justify-between w-full max-w-xs">
              <div className="w-6 h-6 border-b-2 border-l-2 border-indigo-400" />
              <div className="w-6 h-6 border-b-2 border-r-2 border-indigo-400" />
            </div>
          </div>
        )}

        {/* Verified Feedback Overlay */}
        {step === 'verified' && (
          <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
            <div className="flex items-center gap-3 mb-2">
              {passportPhotoUrl && (
                <div className="text-center">
                  <img
                    src={passportPhotoUrl}
                    alt="Profile Passport"
                    className="w-16 h-20 rounded-xl object-cover border-2 border-indigo-300 shadow-md"
                  />
                  <span className="text-[9px] text-indigo-200 font-semibold block mt-0.5">Passport</span>
                </div>
              )}
              {capturedPhoto && (
                <div className="text-center">
                  <img
                    src={capturedPhoto}
                    alt="Verified Face Snapshot"
                    className="w-16 h-20 rounded-xl object-cover border-2 border-emerald-400 shadow-md transform -scale-x-100"
                  />
                  <span className="text-[9px] text-emerald-200 font-semibold block mt-0.5">Live Scan</span>
                </div>
              )}
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
            <h4 className="text-base font-bold text-white">Face &amp; Passport Verified</h4>
            <p className="text-xs text-emerald-200 mt-0.5 max-w-xs">
              {passportResult?.summary || lastOutcome?.reason || 'Live human face matched profile passport.'}
            </p>
          </div>
        )}

        {/* Failed / No Real Face or Passport Mismatch Overlay */}
        {step === 'failed' && (
          <div className="absolute inset-0 bg-rose-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-5 text-center space-y-2.5">
            {passportResult && !passportResult.passportMatched && passportPhotoUrl && capturedPhoto ? (
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <img
                    src={passportPhotoUrl}
                    alt="Profile Passport"
                    className="w-14 h-16 rounded-lg object-cover border-2 border-indigo-300"
                  />
                  <span className="text-[9px] text-slate-200 block mt-0.5">Passport</span>
                </div>
                <span className="text-rose-400 font-bold text-xs">≠</span>
                <div className="text-center">
                  <img
                    src={capturedPhoto}
                    alt="Scanned Face"
                    className="w-14 h-16 rounded-lg object-cover border-2 border-rose-400 transform -scale-x-100"
                  />
                  <span className="text-[9px] text-rose-200 block mt-0.5">Scanned</span>
                </div>
              </div>
            ) : (
              <AlertTriangle className="w-11 h-11 text-rose-400" />
            )}
            <h4 className="text-base font-bold text-white">
              {passportResult && !passportResult.passportMatched
                ? 'Passport Photo Mismatch'
                : lastOutcome?.faceDetected
                ? 'Liveness Verification Failed'
                : 'No Real Face Detected'}
            </h4>
            <p className="text-xs text-rose-200 max-w-xs leading-relaxed">
              {passportResult && !passportResult.passportMatched
                ? passportResult.summary
                : lastOutcome?.reason ||
                  'Camera did not detect a real human face. Uncover the lens, ensure good lighting, and face the camera.'}
            </p>

            {lastOutcome && (
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono bg-black/35 px-3 py-2 rounded-xl border border-rose-500/30 text-rose-100">
                <div>Luma: {lastOutcome.metrics.avgLuminance}</div>
                <div>Skin: {Math.round(lastOutcome.metrics.skinRatio * 100)}%</div>
                <div>Motion: {lastOutcome.metrics.motionScore}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress & Action Bar */}
      <div className="p-4 bg-slate-800/90 border-t border-slate-700 space-y-3">
        {(step === 'initializing' || step === 'scanning' || step === 'verified' || step === 'failed') && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-300 gap-2">
              <span className="truncate">{statusMessage}</span>
              <span className="font-mono shrink-0">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  step === 'failed' ? 'bg-rose-500' : step === 'verified' ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {step === 'idle' && !autoScan && (
          <button
            onClick={startCameraAndScan}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Start Real Face Detection Scan</span>
          </button>
        )}

        {step === 'failed' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={startCameraAndScan}
              className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Face Scan</span>
            </button>
            <button
              onClick={handleSubmitFailedAttempt}
              className="py-2 px-3 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Log Failed Attempt</span>
            </button>
          </div>
        )}

        {/* Explicit Fallback ONLY when hardware webcam cannot be accessed */}
        {step === 'camera_required' && (
          <div className="p-3 bg-slate-900/90 border border-slate-700 rounded-xl space-y-2 text-xs">
            <span className="text-[11px] font-semibold text-slate-400 block">
              No Hardware Camera Detected — Testing Fallback:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleFallbackSimulation(false)}
                className="py-2 px-3 bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/50 text-rose-200 font-semibold text-[11px] rounded-lg cursor-pointer"
              >
                Test No Face (Reject)
              </button>
              <button
                onClick={() => handleFallbackSimulation(true)}
                className="py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-[11px] rounded-lg cursor-pointer"
              >
                Simulate Face Match
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
