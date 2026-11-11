import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, Eye, Smile, UserCheck, ShieldCheck } from 'lucide-react';

interface WebCamScannerProps {
  onCaptureComplete: (faceData: {
    matchScore: number;
    livenessPassed: boolean;
    challengeType: 'blink' | 'smile' | 'tilt';
    photoSnapshotUrl?: string;
  }) => void;
  studentName: string;
  simulatedMatchScore?: number;
  simulatedLivenessPass?: boolean;
}

export const WebCamScanner: React.FC<WebCamScannerProps> = ({
  onCaptureComplete,
  studentName,
  simulatedMatchScore = 96,
  simulatedLivenessPass = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'detecting' | 'challenge' | 'verified' | 'failed'>('idle');
  const [challenge, setChallenge] = useState<'blink' | 'smile' | 'tilt'>('blink');
  const [progress, setProgress] = useState<number>(0);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Initialize camera
  const startCamera = async () => {
    setCameraError(null);
    setStep('detecting');
    setProgress(15);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setStreamActive(true);
        }
      } else {
        // Fallback to simulated camera feed
        setStreamActive(false);
      }
    } catch (err: any) {
      console.warn('WebRTC camera unavailable or permission denied; switching to browser biometric simulator', err);
      setCameraError('Browser camera unavailable. Operating in biometric simulation mode.');
      setStreamActive(false);
    }

    // Step 1: Detect Face
    setTimeout(() => {
      setProgress(45);
      setStep('challenge');
      const challenges: ('blink' | 'smile' | 'tilt')[] = ['blink', 'smile', 'tilt'];
      setChallenge(challenges[Math.floor(Math.random() * challenges.length)]);
    }, 1200);
  };

  // Handle user completing challenge
  const handlePerformChallenge = () => {
    setProgress(75);
    setStep('detecting');

    // Snapshot from canvas if video is active
    let snapshotUrl: string | undefined = undefined;
    if (videoRef.current && streamActive) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 320, 240);
          snapshotUrl = canvas.toDataURL('image/jpeg');
          setCapturedPhoto(snapshotUrl);
        }
      } catch (e) {
        console.warn('Could not capture frame:', e);
      }
    }

    setTimeout(() => {
      setProgress(100);
      if (simulatedLivenessPass) {
        setStep('verified');
        onCaptureComplete({
          matchScore: simulatedMatchScore,
          livenessPassed: true,
          challengeType: challenge,
          photoSnapshotUrl: snapshotUrl,
        });
      } else {
        setStep('failed');
        onCaptureComplete({
          matchScore: 35,
          livenessPassed: false,
          challengeType: challenge,
        });
      }
    }, 1000);
  };

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-700 shadow-xl flex flex-col">
      {/* Scanner Header */}
      <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-slate-200">Biometric Liveness Verification</span>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
          Enrolled: {studentName}
        </span>
      </div>

      {/* Video / Simulation Viewport */}
      <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
        {/* Real Video Element */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${
            streamActive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Fallback Simulation Canvas if no hardware video */}
        {!streamActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-radial from-slate-800 to-slate-950">
            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Snapshot" className="w-40 h-40 rounded-full object-cover border-4 border-emerald-500 shadow-lg" />
            ) : (
              <div className="w-36 h-36 rounded-full border-2 border-dashed border-indigo-400/60 flex items-center justify-center bg-indigo-950/40 relative">
                <div className="w-28 h-28 rounded-full bg-indigo-600/30 flex items-center justify-center text-3xl font-bold text-indigo-200">
                  {studentName.charAt(0)}
                </div>
                {step === 'detecting' && (
                  <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-50" />
                )}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3 font-medium">
              {streamActive ? 'Real Webcam Active' : 'Webcam Emulation Mode'}
            </p>
          </div>
        )}

        {/* Scanner HUD Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
          {/* Top Target Guide */}
          <div className="flex justify-between w-full max-w-xs">
            <div className="w-6 h-6 border-t-2 border-l-2 border-indigo-400" />
            <div className="w-6 h-6 border-t-2 border-r-2 border-indigo-400" />
          </div>

          {/* Central Face Oval Guide */}
          <div
            className={`w-44 h-56 rounded-[50%] border-2 transition-colors duration-300 flex items-center justify-center ${
              step === 'verified'
                ? 'border-emerald-400 bg-emerald-500/10'
                : step === 'failed'
                ? 'border-rose-500 bg-rose-500/10'
                : step === 'challenge'
                ? 'border-amber-400 border-dashed animate-pulse'
                : 'border-indigo-400/70'
            }`}
          >
            {step === 'detecting' && (
              <div className="w-full h-0.5 bg-indigo-400 shadow-[0_0_12px_#818cf8] animate-bounce" />
            )}
          </div>

          {/* Bottom Target Guide */}
          <div className="flex justify-between w-full max-w-xs">
            <div className="w-6 h-6 border-b-2 border-l-2 border-indigo-400" />
            <div className="w-6 h-6 border-b-2 border-r-2 border-indigo-400" />
          </div>
        </div>

        {/* Challenge Prompt Floating Pill */}
        {step === 'challenge' && (
          <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md border border-amber-400/50 p-3 rounded-xl flex items-center justify-between animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                {challenge === 'blink' ? <Eye className="w-5 h-5" /> : <Smile className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs font-bold text-amber-300">
                  {challenge === 'blink' && 'Liveness Test: Blink both eyes now'}
                  {challenge === 'smile' && 'Liveness Test: Smile at the camera'}
                  {challenge === 'tilt' && 'Liveness Test: Tilt head slightly'}
                </p>
                <p className="text-[10px] text-slate-300">Confirms live physical human presence</p>
              </div>
            </div>
            <button
              onClick={handlePerformChallenge}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              Confirm
            </button>
          </div>
        )}

        {/* Verified Feedback Overlay */}
        {step === 'verified' && (
          <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-in zoom-in" />
            <h4 className="text-base font-bold text-white">Biometrics Verified</h4>
            <p className="text-xs text-emerald-200 mt-0.5">
              Facial Match: <strong className="text-white">{simulatedMatchScore}%</strong> • Liveness: Passed
            </p>
          </div>
        )}

        {/* Failed Feedback Overlay */}
        {step === 'failed' && (
          <div className="absolute inset-0 bg-rose-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
            <AlertTriangle className="w-12 h-12 text-rose-400 mb-2 animate-in zoom-in" />
            <h4 className="text-base font-bold text-white">Liveness Verification Failed</h4>
            <p className="text-xs text-rose-200 mt-0.5">
              Biometric check failed to prove live subject presence.
            </p>
          </div>
        )}
      </div>

      {/* Progress & Controls */}
      <div className="p-4 bg-slate-800/90 border-t border-slate-700 space-y-3">
        {step !== 'idle' && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Biometric Security Scan</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {step === 'idle' && (
          <button
            onClick={startCamera}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Start Biometric Face Scan</span>
          </button>
        )}

        {(step === 'verified' || step === 'failed') && (
          <button
            onClick={startCamera}
            className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retake Verification</span>
          </button>
        )}

        {cameraError && (
          <p className="text-[11px] text-slate-400 italic text-center">
            {cameraError}
          </p>
        )}
      </div>
    </div>
  );
};
