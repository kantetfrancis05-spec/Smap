import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Radio,
  Eye,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Zap,
  RotateCcw,
  Clock
} from 'lucide-react';
import { BleEvidence, FaceEvidence, DecisionResult, AnomalyAssessment, FraudScenarioPreset, LectureSession, Student } from '../types/attendance';
import { evaluateAttendanceDecision } from '../services/decisionEngine';
import { evaluateAnomalyRisk } from '../services/anomalyEngine';
import { calculateSessionAttendancePercentage } from '../services/attendanceCalculator';
import { FRAUD_SCENARIOS } from '../data/mockData';

export const DecisionSandbox: React.FC = () => {
  // Interactive Simulation Controls
  const [rssi, setRssi] = useState<number>(-64);
  const [bleConnectedMinutes, setBleConnectedMinutes] = useState<number>(56);
  const [faceDetected, setFaceDetected] = useState<boolean>(true);
  const [passportMatched, setPassportMatched] = useState<boolean>(true);
  const [faceScore, setFaceScore] = useState<number>(96);
  const [livenessPassed, setLivenessPassed] = useState<boolean>(true);
  const [classroomGate] = useState<number>(-78);
  const [isClashScenario, setIsClashScenario] = useState<boolean>(false);

  // Calculate distance from RSSI
  const estimatedDistance = parseFloat(Math.pow(10, (-59 - rssi) / (10 * 2.2)).toFixed(1));
  const isWithinClassroom = rssi >= classroomGate;

  const effectiveConnectedMinutes = isWithinClassroom ? bleConnectedMinutes : 0;
  const lessonDuration = 60;

  const currentBle: BleEvidence = {
    beaconUuid: '4F7A-SMAP-BEACON-CS301',
    major: 101,
    minor: 4,
    rssi,
    estimatedDistanceMeters: estimatedDistance,
    isWithinClassroomRange: isWithinClassroom,
    timestamp: new Date().toLocaleTimeString(),
    beaconSource: 'lecturer_phone',
    lecturerPhoneName: "Dr. Pendelton's Pixel 8 Pro",
    lecturerBluetoothId: 'BT-LEC-A4:83:E7:2B:91:04',
    bleConnectedMinutes: effectiveConnectedMinutes,
    lessonDurationMinutes: lessonDuration,
    bleConnectionPercentage: Math.round((effectiveConnectedMinutes / lessonDuration) * 100),
  };

  const currentFace: FaceEvidence = {
    faceDetected,
    matchScore: faceDetected ? faceScore : 0,
    livenessPassed: faceDetected ? livenessPassed : false,
    livenessChallenge: 'blink',
    lightingQuality: 'good',
    timestamp: new Date().toLocaleTimeString(),
    passportMatched: faceDetected ? passportMatched : false,
    passportMatchScore: faceDetected ? (passportMatched ? faceScore : 42) : 0,
  };

  const mockSession: LectureSession = {
    id: 'SES-SIM-1',
    courseCode: 'CS301',
    courseTitle: 'Operating Systems & Architecture',
    lecturerName: 'Dr. Arthur Pendelton',
    room: 'Lecture Theatre 4B',
    startTime: '10:00 AM',
    expiresAt: '12:00 PM',
    isActive: true,
    otpCode: '849201',
    qrPayload: 'SMAP://SIM',
    beaconUuid: '4F7A-SMAP-BEACON-CS301',
    beaconMajor: 101,
    beaconMinor: 4,
    txPower: -59,
    rssiThreshold: classroomGate,
    beaconSource: 'lecturer_phone',
    lecturerPhoneName: "Dr. Pendelton's Pixel 8 Pro",
    lecturerBluetoothId: 'BT-LEC-A4:83:E7:2B:91:04',
    advertisingLocalName: 'SMAP-CS301-8492',
    advertisingIntervalMs: 100,
    lessonDurationMinutes: lessonDuration,
  };

  const mockStudent: Student = {
    id: 's1',
    name: 'Francis Kantet',
    regNumber: 'STU/2023/0042',
    department: 'Computer Science',
    year: 3,
    registeredDeviceId: isClashScenario ? 'DEV-DIFFERENT-PHONE' : 'SIMULATED-DEV-TEST',
    biometricEnrolled: true,
    avatarSeed: 'francis',
  };

  const mockDeviceHistory = isClashScenario
    ? [{ deviceId: 'SIMULATED-DEV-TEST', studentReg: 'STU/2023/9999', timestamp: Date.now() - 30000 }]
    : [];

  // Live Decision, Attendance Percentage & Anomaly Evaluation
  const percentageBreakdown = calculateSessionAttendancePercentage(currentBle, currentFace, lessonDuration);
  const decision: DecisionResult = evaluateAttendanceDecision(currentBle, currentFace, mockSession);
  const anomaly: AnomalyAssessment = evaluateAnomalyRisk({
    student: mockStudent,
    currentDeviceId: 'SIMULATED-DEV-TEST',
    bleEvidence: currentBle,
    faceEvidence: currentFace,
    recentDeviceCheckins: mockDeviceHistory,
    expectedClassroomRadiusMeters: 12,
  });

  // Apply a preset
  const handleApplyPreset = (scenario: FraudScenarioPreset) => {
    setRssi(scenario.bleRssi);
    setBleConnectedMinutes(scenario.bleRssi >= classroomGate ? (scenario.expectedDecision === 'VERIFIED_PRESENT' ? 56 : 48) : 0);
    setFaceDetected(scenario.faceMatchScore > 0);
    setPassportMatched(scenario.faceMatchScore >= 70);
    setFaceScore(scenario.faceMatchScore);
    setLivenessPassed(scenario.livenessPassed);
    setIsClashScenario(scenario.category === 'device_clash');
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
            Multimodal Verification &amp; Anti-Proxy Lab
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">
            Decision Engine &amp; Attendance Percentage Sandbox
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Simulate how real face detection, profile passport matching, BLE connected time throughout the 60-minute lesson (70% weight), and biometric confidence (30% weight) drive attendance percentage and anomaly risk.
          </p>
        </div>

        <button
          onClick={() => {
            setRssi(-64);
            setBleConnectedMinutes(56);
            setFaceDetected(true);
            setPassportMatched(true);
            setFaceScore(96);
            setLivenessPassed(true);
            setIsClashScenario(false);
          }}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Normal</span>
        </button>
      </div>

      {/* Preset Scenarios Buttons */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <span className="text-xs font-bold text-slate-800 block">
          Test Anti-Fraud Presets (Click to Simulate):
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FRAUD_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => handleApplyPreset(scenario)}
              className="p-3 text-left rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 block">
                  {scenario.name}
                </span>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {scenario.description}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                <span>Expected:</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-mono ${
                    scenario.expectedDecision === 'VERIFIED_PRESENT'
                      ? 'bg-emerald-100 text-emerald-800'
                      : scenario.expectedDecision === 'FLAGGED_REVIEW'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {scenario.expectedDecision}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Controls & Live Outcome */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Tuning Sliders (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
            Signal & Biometric Evidence Inputs
          </h3>

          {/* 1. BLE RSSI Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-indigo-600" />
                BLE Beacon Signal (RSSI):
              </span>
              <span className="font-mono font-bold text-indigo-700 text-sm">
                {rssi} dBm (~{estimatedDistance}m away)
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="-40"
              value={rssi}
              onChange={(e) => setRssi(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span className="text-rose-500 font-semibold">-100 dBm (Outside Hallway)</span>
              <span className="text-indigo-600 font-semibold">Gate: {classroomGate} dBm (Perimeter Boundary)</span>
              <span className="text-emerald-600 font-semibold">-40 dBm (Front Desk)</span>
            </div>
          </div>

          {/* 1.5. BLE Connected Time Throughout Lesson Slider */}
          <div className="space-y-2 p-4 bg-indigo-50/60 rounded-xl border border-indigo-200">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-indigo-950 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                BLE Connected Time Throughout Lesson (Key Driver):
              </span>
              <span className="font-mono font-bold text-indigo-700 text-sm">
                {effectiveConnectedMinutes}/{lessonDuration} min ({percentageBreakdown.bleTimePercentage}%)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={lessonDuration}
              value={bleConnectedMinutes}
              onChange={(e) => setBleConnectedMinutes(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0 min (Disconnected)</span>
              <span className="text-amber-700 font-semibold">30–44 min (Flagged Review)</span>
              <span className="text-emerald-700 font-semibold">45–60 min (75%+ Optimal)</span>
            </div>
          </div>

          {/* 2. Biometric Match Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-600" />
                Facial Biometric Match Confidence:
              </span>
              <span className="font-mono font-bold text-indigo-700 text-sm">
                {faceDetected ? `${faceScore}%` : '0% (No Face)'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={faceScore}
              onChange={(e) => setFaceScore(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0% (Stranger)</span>
              <span className="text-amber-600 font-semibold">70% Review Threshold</span>
              <span className="text-emerald-600 font-semibold">85%+ Optimal Match</span>
            </div>
          </div>

          {/* 3. Toggles: Real Face Detection, Passport Match, Liveness & Device Clash */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Real Face Detected Toggle */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-xs text-slate-800 block">Real Face</span>
                <span className="text-[10px] text-slate-500">Camera gate</span>
              </div>
              <button
                onClick={() => setFaceDetected(!faceDetected)}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                  faceDetected ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {faceDetected ? '✓ Real Face' : '✕ No Face'}
              </button>
            </div>

            {/* Profile Passport Match Toggle */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-xs text-slate-800 block">Passport Photo</span>
                <span className="text-[10px] text-slate-500">Profile ID check</span>
              </div>
              <button
                onClick={() => setPassportMatched(!passportMatched)}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                  passportMatched ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {passportMatched ? '✓ Matched' : '✕ Mismatch'}
              </button>
            </div>

            {/* Liveness Toggle */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-xs text-slate-800 block">Liveness Test</span>
                <span className="text-[10px] text-slate-500">Anti-spoof</span>
              </div>
              <button
                onClick={() => setLivenessPassed(!livenessPassed)}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                  livenessPassed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 text-white'
                }`}
              >
                {livenessPassed ? '✓ Passed' : '✕ Spoof'}
              </button>
            </div>

            {/* Device Hardware Clash Toggle */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-xs text-slate-800 block">Device Clash</span>
                <span className="text-[10px] text-slate-500">Multi-login</span>
              </div>
              <button
                onClick={() => setIsClashScenario(!isClashScenario)}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                  isClashScenario
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {isClashScenario ? '⚠ Clash' : '○ Clean'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Computed Outcome (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Main Decision Output Box */}
          <div
            className={`p-6 rounded-2xl border shadow-sm space-y-4 text-center ${
              decision.status === 'VERIFIED_PRESENT'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : decision.status === 'FLAGGED_REVIEW'
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white ${
                decision.status === 'VERIFIED_PRESENT'
                  ? 'bg-emerald-600'
                  : decision.status === 'FLAGGED_REVIEW'
                  ? 'bg-amber-600'
                  : 'bg-rose-600'
              }`}
            >
              {decision.status === 'VERIFIED_PRESENT' && <CheckCircle2 className="w-8 h-8" />}
              {decision.status === 'FLAGGED_REVIEW' && <AlertTriangle className="w-8 h-8" />}
              {decision.status === 'REJECTED_ABSENT' && <XCircle className="w-8 h-8" />}
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider block">Decision Engine Verdict:</span>
              <h3 className="text-xl font-extrabold mt-0.5">{decision.status}</h3>
              <p className="text-xs mt-1 opacity-90">{decision.reason}</p>
            </div>

            <div className="pt-3 border-t border-black/10 flex justify-between text-xs font-mono">
              <span>Rule: {decision.ruleMatched}</span>
              <span>Score: {percentageBreakdown.attendancePercentage}%</span>
            </div>
          </div>

          {/* Attendance Percentage Calculation Breakdown */}
          <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">Calculated Attendance Percentage</span>
              <span
                className={`text-2xl font-extrabold font-mono ${
                  percentageBreakdown.attendancePercentage >= 75
                    ? 'text-emerald-600'
                    : percentageBreakdown.attendancePercentage >= 50
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {percentageBreakdown.attendancePercentage}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 block">BLE Lesson Time (70% Weight)</span>
                <strong className="font-mono text-indigo-700">
                  {percentageBreakdown.bleConnectedMinutes}/{percentageBreakdown.lessonDurationMinutes} min ({percentageBreakdown.bleTimePercentage}%)
                </strong>
                <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                  +{(percentageBreakdown.bleTimePercentage * 0.7).toFixed(1)}% pts
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Face Verification (30% Weight)</span>
                <strong
                  className={`font-mono ${
                    !percentageBreakdown.facePassed
                      ? 'text-rose-600'
                      : percentageBreakdown.faceComponentPercentage < 70
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {!percentageBreakdown.facePassed
                    ? '0% Gate Failed'
                    : percentageBreakdown.faceComponentPercentage < 70
                    ? `${percentageBreakdown.faceComponentPercentage}% Recorded (<70%)`
                    : `${percentageBreakdown.faceComponentPercentage}% Verified`}
                </strong>
                {percentageBreakdown.facePassed && (
                  <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                    +{(percentageBreakdown.faceComponentPercentage * 0.3).toFixed(1)}% pts
                  </span>
                )}
              </div>
            </div>
            {percentageBreakdown.facePassed && percentageBreakdown.faceComponentPercentage < 70 && isWithinClassroom && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-medium">
                Face verification ({percentageBreakdown.faceComponentPercentage}%) is below 70% — recorded and added to the other verification steps ({percentageBreakdown.bleTimePercentage}% BLE time) instead of marking the student absent.
              </div>
            )}
            <p className="text-[11px] text-slate-500">{percentageBreakdown.summary}</p>
          </div>

          {/* Anomaly Assessment Summary Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                Anti-Proxy Risk Score
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full font-bold ${
                  anomaly.riskLevel === 'LOW'
                    ? 'bg-emerald-100 text-emerald-800'
                    : anomaly.riskLevel === 'MODERATE'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {anomaly.riskScore}/100 ({anomaly.riskLevel})
              </span>
            </div>

            <p className="text-slate-600 leading-relaxed">{anomaly.explanation}</p>

            {anomaly.flags.length > 0 ? (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-700 block text-[11px]">Security Flags Triggered:</span>
                {anomaly.flags.map((f, i) => (
                  <div key={i} className="text-rose-700 text-[11px] font-semibold flex items-center gap-1.5">
                    <span>⚠</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-emerald-700 text-[11px] font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero fraud indicators detected. Physical presence verified.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
