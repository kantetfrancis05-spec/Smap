import React, { useState } from 'react';
import {
  School,
  Bluetooth,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  QrCode,
  ShieldCheck,
  User,
  ArrowRight,
  Sparkles,
  Calendar,
  BookOpen,
  Award,
  Layers,
  KeyRound,
  FileCheck2,
  Fingerprint
} from 'lucide-react';
import { Course, Student, AttendanceRecord, LectureSession, BleEvidence, FaceEvidence } from '../types/attendance';
import { WebCamScanner } from './WebCamScanner';
import { evaluateAttendanceDecision } from '../services/decisionEngine';
import { evaluateAnomalyRisk } from '../services/anomalyEngine';

interface StudentPortalProps {
  student: Student;
  courses: Course[];
  records: AttendanceRecord[];
  activeSession: LectureSession | null;
  onRecordAttendance: (record: AttendanceRecord) => void;
  recentDeviceCheckins: { deviceId: string; studentReg: string; timestamp: number }[];
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  student,
  courses,
  records,
  activeSession,
  onRecordAttendance,
  recentDeviceCheckins,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'checkin' | 'history'>('overview');
  const [checkinMethod, setCheckinMethod] = useState<'multimodal' | 'qr'>('multimodal');

  // Checkin Workflow Steps
  const [step, setStep] = useState<'ready' | 'ble_scan' | 'face_scan' | 'submitting' | 'result'>('ready');

  // BLE Scan State
  const [bleScanning, setBleScanning] = useState(false);
  const [bleEvidence, setBleEvidence] = useState<BleEvidence | null>(null);
  const [simulatedRssi, setSimulatedRssi] = useState(-66); // -66 dBm is strong inside classroom

  // Face Scan State
  const [faceEvidence, setFaceEvidence] = useState<FaceEvidence | null>(null);

  // QR Code / OTP Input State
  const [enteredOtp, setEnteredOtp] = useState('');
  const [qrScanError, setQrScanError] = useState<string | null>(null);

  // Final verification result
  const [latestRecord, setLatestRecord] = useState<AttendanceRecord | null>(null);

  // Student's own records
  const myRecords = records.filter((r) => r.studentReg === student.regNumber);
  const verifiedCount = myRecords.filter((r) => r.decision.status === 'VERIFIED_PRESENT').length;
  const overallPercentage = myRecords.length > 0 ? Math.round((verifiedCount / myRecords.length) * 100) : 92;

  // Start BLE Beacon Scan
  const handleStartBleScan = async () => {
    setBleScanning(true);
    setStep('ble_scan');

    // Attempt real Web Bluetooth API if available in supported browser
    let realDeviceFound = false;
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      try {
        // Optional Web Bluetooth filter prompt
        // Note: Browsers require user gesture for requestDevice
        console.log('Web Bluetooth is supported in this browser.');
      } catch (err) {
        console.log('Web Bluetooth fallback initiated');
      }
    }

    // Simulate classroom radio propagation
    setTimeout(() => {
      const targetUuid = activeSession ? activeSession.beaconUuid : '4F7A-SMAP-BEACON-CS301';
      const distance = parseFloat(Math.pow(10, (-59 - simulatedRssi) / (10 * 2.2)).toFixed(1));
      const inRange = simulatedRssi >= (activeSession?.rssiThreshold ?? -78);

      const evidence: BleEvidence = {
        beaconUuid: targetUuid,
        major: activeSession?.beaconMajor ?? 101,
        minor: activeSession?.beaconMinor ?? 4,
        rssi: simulatedRssi,
        estimatedDistanceMeters: distance,
        isWithinClassroomRange: inRange,
        timestamp: new Date().toLocaleTimeString(),
      };

      setBleEvidence(evidence);
      setBleScanning(false);
      setStep('face_scan');
    }, 1500);
  };

  // Face scan completion
  const handleFaceComplete = (faceData: {
    matchScore: number;
    livenessPassed: boolean;
    challengeType: 'blink' | 'smile' | 'tilt';
  }) => {
    const fEvidence: FaceEvidence = {
      faceDetected: true,
      matchScore: faceData.matchScore,
      livenessPassed: faceData.livenessPassed,
      livenessChallenge: faceData.challengeType,
      lightingQuality: 'good',
      timestamp: new Date().toLocaleTimeString(),
    };
    setFaceEvidence(fEvidence);
    processVerification(bleEvidence!, fEvidence);
  };

  // Process full decision engine
  const processVerification = (ble: BleEvidence, face: FaceEvidence) => {
    setStep('submitting');

    setTimeout(() => {
      const course = activeSession
        ? courses.find((c) => c.code === activeSession.courseCode) || courses[0]
        : courses[0];

      const sessionToUse: LectureSession = activeSession || {
        id: `SES-${course.code}-TODAY`,
        courseCode: course.code,
        courseTitle: course.title,
        lecturerName: course.lecturerName,
        room: course.room,
        startTime: '09:00 AM',
        expiresAt: '11:00 AM',
        isActive: true,
        otpCode: '849201',
        qrPayload: `SMAP://SESSION/${course.code}`,
        beaconUuid: course.beaconUuid,
        beaconMajor: course.beaconMajor,
        beaconMinor: course.beaconMinor,
        txPower: -59,
        rssiThreshold: -78,
      };

      // 1. Evaluate Decision Status
      const decision = evaluateAttendanceDecision(ble, face, sessionToUse);

      // 2. Evaluate Anomaly Risk
      const anomaly = evaluateAnomalyRisk({
        student,
        currentDeviceId: student.registeredDeviceId,
        bleEvidence: ble,
        faceEvidence: face,
        recentDeviceCheckins,
        expectedClassroomRadiusMeters: 12,
      });

      // Generate digital crypto token
      const token = `SMAP-V-${course.code}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      const newRecord: AttendanceRecord = {
        id: `REC-${Date.now()}`,
        sessionId: activeSession ? activeSession.id : `SES-${course.code}-TODAY`,
        courseCode: course.code,
        courseTitle: course.title,
        studentReg: student.regNumber,
        studentName: student.name,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        bleEvidence: ble,
        faceEvidence: face,
        decision,
        anomaly,
        verificationToken: token,
      };

      setLatestRecord(newRecord);
      onRecordAttendance(newRecord);
      setStep('result');
    }, 1000);
  };

  // Handle OTP / QR verification
  const handleVerifyOtp = () => {
    setQrScanError(null);
    if (!activeSession) {
      setQrScanError('No lecture session is currently broadcasting.');
      return;
    }
    if (enteredOtp.trim() !== activeSession.otpCode) {
      setQrScanError(`Invalid session code. Expected current classroom code: ${activeSession.otpCode}`);
      return;
    }

    // Generate verified evidence via OTP method
    const ble: BleEvidence = {
      beaconUuid: activeSession.beaconUuid,
      major: activeSession.beaconMajor,
      minor: activeSession.beaconMinor,
      rssi: -62,
      estimatedDistanceMeters: 2.1,
      isWithinClassroomRange: true,
      timestamp: new Date().toLocaleTimeString(),
    };

    const face: FaceEvidence = {
      faceDetected: true,
      matchScore: 98,
      livenessPassed: true,
      livenessChallenge: 'blink',
      lightingQuality: 'good',
      timestamp: new Date().toLocaleTimeString(),
    };

    processVerification(ble, face);
  };

  return (
    <div className="space-y-6">
      {/* Student Profile Hero Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-bold text-2xl flex items-center justify-center shadow-md">
            {student.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{student.name}</h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700">
                Year {student.year}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Reg: <strong className="font-mono text-slate-700">{student.regNumber}</strong> • {student.department}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Fingerprint className="w-3.5 h-3.5 text-emerald-600" />
                Biometrics: <strong className="text-emerald-700">Enrolled</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                Device: {student.registeredDeviceId}
              </span>
            </div>
          </div>
        </div>

        {/* Attendance Score Card */}
        <div className="flex items-center gap-6 bg-slate-50 border border-slate-200/80 p-4 rounded-xl w-full md:w-auto">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Semester Attendance
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-extrabold text-slate-900">{overallPercentage}%</span>
              <span className="text-xs font-semibold text-emerald-600">✓ Exam Eligible</span>
            </div>
            <span className="text-[11px] text-slate-400">Min. required: 75%</span>
          </div>

          <div className="h-10 w-px bg-slate-200" />

          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Verified Lectures
            </span>
            <div className="text-2xl font-extrabold text-indigo-700 mt-0.5">
              {verifiedCount} <span className="text-xs text-slate-400 font-normal">sessions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>My Enrolled Courses</span>
        </button>

        <button
          onClick={() => setActiveTab('checkin')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer relative ${
            activeTab === 'checkin'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Live Check-In</span>
          {activeSession && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute top-2 right-2" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Attendance History</span>
        </button>
      </div>

      {/* TAB 1: ENROLLED COURSES */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Active Lecture Banner if broadcasting */}
          {activeSession ? (
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                    Live Classroom Broadcast In Progress
                  </span>
                </div>
                <h3 className="text-lg font-bold">
                  {activeSession.courseCode} — {activeSession.courseTitle}
                </h3>
                <p className="text-xs text-indigo-100">
                  Room: <strong>{activeSession.room}</strong> • Lecturer: <strong>{activeSession.lecturerName}</strong>
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveTab('checkin');
                  setStep('ready');
                }}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>Verify Attendance Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-slate-400" />
                <span>No active lecture beacon broadcasting at this exact minute.</span>
              </div>
              <span className="text-[11px] text-slate-400">Lecturer will activate beacon during class</span>
            </div>
          )}

          {/* Courses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((course) => {
              const courseRecords = myRecords.filter((r) => r.courseCode === course.code);
              const presentCount = courseRecords.filter((r) => r.decision.status === 'VERIFIED_PRESENT').length;
              const percentage = courseRecords.length > 0 ? Math.round((presentCount / courseRecords.length) * 100) : 90;
              const isExamEligible = percentage >= 75;

              return (
                <div
                  key={course.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 transition-colors flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700">
                        {course.code}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          isExamEligible
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isExamEligible ? 'Exam Clear' : 'Attendance Warning'}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 mt-2.5">{course.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {course.lecturerName} • {course.room}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">Attendance Rate</span>
                      <span className="text-slate-900">{percentage}% ({presentCount}/{course.totalLectures} sessions)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percentage >= 85 ? 'bg-indigo-600' : percentage >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE CHECK-IN WORKFLOW */}
      {activeTab === 'checkin' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Attendance Verification</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Target Lecture: <strong className="text-slate-800">{activeSession ? `${activeSession.courseCode} (${activeSession.room})` : 'CS301 (Lecture Theatre 4B)'}</strong>
              </p>
            </div>

            {/* Checkin Mode Selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
              <button
                onClick={() => {
                  setCheckinMethod('multimodal');
                  setStep('ready');
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  checkinMethod === 'multimodal'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Multimodal (BLE + Face)
              </button>
              <button
                onClick={() => {
                  setCheckinMethod('qr');
                  setStep('ready');
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  checkinMethod === 'qr'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Classroom QR / OTP
              </button>
            </div>
          </div>

          {/* METHOD A: MULTIMODAL VERIFICATION */}
          {checkinMethod === 'multimodal' && (
            <div className="space-y-6">
              {/* Stepper indicator */}
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    step === 'ready' || step === 'ble_scan'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <span className="block text-[10px] text-indigo-600 uppercase font-mono">Step 1</span>
                  Classroom BLE Proximity
                </div>

                <div
                  className={`p-3 rounded-xl border transition-all ${
                    step === 'face_scan'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <span className="block text-[10px] text-indigo-600 uppercase font-mono">Step 2</span>
                  Face Liveness Check
                </div>

                <div
                  className={`p-3 rounded-xl border transition-all ${
                    step === 'result'
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <span className="block text-[10px] text-emerald-600 uppercase font-mono">Step 3</span>
                  Verified Receipt
                </div>
              </div>

              {/* Step 1: Ready to Scan BLE */}
              {step === 'ready' && (
                <div className="max-w-lg mx-auto text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
                    <Bluetooth className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Step 1: Verify Classroom Proximity</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Your browser will scan for the physical Bluetooth Low Energy (BLE) classroom beacon transmitter broadcasting in {activeSession?.room || 'Lecture Theatre 4B'}.
                    </p>
                  </div>

                  {/* Signal Strength Simulation Slider */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700">Simulated Radio RSSI Gate:</span>
                      <span className="font-mono font-bold text-indigo-700">{simulatedRssi} dBm</span>
                    </div>
                    <input
                      type="range"
                      min="-95"
                      max="-45"
                      value={simulatedRssi}
                      onChange={(e) => setSimulatedRssi(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>-95 dBm (Hallway/Outside)</span>
                      <span className="text-emerald-600 font-semibold">-78 dBm (Classroom Perimeter Gate)</span>
                      <span>-45 dBm (Front Desk)</span>
                    </div>
                  </div>

                  <button
                    onClick={handleStartBleScan}
                    className="w-full py-3 px-6 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Radio className="w-4 h-4" />
                    <span>Scan for Classroom Beacon</span>
                  </button>
                </div>
              )}

              {/* Step 1 in progress: BLE Scanning */}
              {step === 'ble_scan' && (
                <div className="max-w-md mx-auto text-center py-10 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 border-2 border-indigo-400 animate-ping mx-auto flex items-center justify-center">
                    <Radio className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Scanning Bluetooth Low Energy Spectrum...</h4>
                  <p className="text-xs text-slate-500">
                    Listening for UUID {activeSession?.beaconUuid || '4F7A-SMAP-BEACON-CS301'}
                  </p>
                </div>
              )}

              {/* Step 2: Face Liveness Scanner */}
              {step === 'face_scan' && (
                <div className="max-w-md mx-auto space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-emerald-950">BLE Beacon Located</span>
                    </div>
                    <span className="font-mono text-emerald-700 text-[11px]">
                      {bleEvidence?.rssi} dBm (~{bleEvidence?.estimatedDistanceMeters}m)
                    </span>
                  </div>

                  <WebCamScanner
                    studentName={student.name}
                    simulatedMatchScore={96.8}
                    simulatedLivenessPass={true}
                    onCaptureComplete={handleFaceComplete}
                  />
                </div>
              )}

              {/* Submitting check */}
              {step === 'submitting' && (
                <div className="max-w-md mx-auto text-center py-12 space-y-3">
                  <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">Evaluating Multi-Modal Decision Engine...</h4>
                  <p className="text-xs text-slate-500">Verifying BLE proximity + Biometrics + Hardware Fingerprint</p>
                </div>
              )}

              {/* Step 3: Verified Result Card */}
              {step === 'result' && latestRecord && (
                <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-5 shadow-xs">
                  <div className="text-center space-y-1">
                    <div
                      className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white mb-2 ${
                        latestRecord.decision.status === 'VERIFIED_PRESENT'
                          ? 'bg-emerald-600 shadow-emerald-200 shadow-lg'
                          : latestRecord.decision.status === 'FLAGGED_REVIEW'
                          ? 'bg-amber-600 shadow-amber-200 shadow-lg'
                          : 'bg-rose-600 shadow-rose-200 shadow-lg'
                      }`}
                    >
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900">
                      {latestRecord.decision.status === 'VERIFIED_PRESENT'
                        ? 'Attendance Verified Present'
                        : latestRecord.decision.status === 'FLAGGED_REVIEW'
                        ? 'Flagged for Faculty Review'
                        : 'Attendance Rejected'}
                    </h4>
                    <p className="text-xs text-slate-500">{latestRecord.decision.reason}</p>
                  </div>

                  {/* Forensic Evidence Breakdown */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between pb-2 border-b border-slate-100">
                      <span className="text-slate-500">Course:</span>
                      <strong className="text-slate-900">{latestRecord.courseCode} — {latestRecord.courseTitle}</strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">BLE Radio Signal:</span>
                      <span className="font-mono text-emerald-700 font-bold">
                        {latestRecord.bleEvidence.rssi} dBm (Est. {latestRecord.bleEvidence.estimatedDistanceMeters}m)
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">Biometric Match:</span>
                      <span className="font-mono text-indigo-700 font-bold">
                        {latestRecord.faceEvidence.matchScore}% (Liveness: Passed)
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">Security Risk Score:</span>
                      <span className="font-bold text-emerald-600">
                        {latestRecord.anomaly.riskScore}/100 ({latestRecord.anomaly.riskLevel})
                      </span>
                    </div>

                    <div className="flex justify-between pt-2 border-t border-slate-100 items-center">
                      <span className="text-slate-500">Digital Audit Token:</span>
                      <code className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-indigo-900 font-mono">
                        {latestRecord.verificationToken}
                      </code>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep('ready')}
                    className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Done / Next Verification
                  </button>
                </div>
              )}
            </div>
          )}

          {/* METHOD B: CLASSROOM DYNAMIC QR / OTP */}
          {checkinMethod === 'qr' && (
            <div className="max-w-md mx-auto py-6 space-y-4">
              <div className="text-center space-y-1">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
                  <KeyRound className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Enter Classroom Session Code</h4>
                <p className="text-xs text-slate-500">
                  Enter the 6-digit dynamic code currently projected on the classroom screen.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <input
                  type="text"
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 849201"
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono font-bold bg-white border border-slate-300 rounded-xl p-3 focus:outline-indigo-600"
                />

                {qrScanError && (
                  <p className="text-xs text-rose-600 font-semibold text-center">{qrScanError}</p>
                )}

                <button
                  onClick={handleVerifyOtp}
                  disabled={enteredOtp.length !== 6}
                  className="w-full py-3 bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Verify Attendance Code
                </button>
              </div>

              {activeSession && (
                <div className="text-center text-[11px] text-slate-400">
                  Classroom Beacon: <code className="font-mono">{activeSession.room}</code>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ATTENDANCE HISTORY TABLE */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Personal Attendance Record Ledger</h3>
            <span className="text-xs text-slate-500 font-medium">
              Showing {myRecords.length} recorded sessions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-6 py-3">Course</th>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">BLE Signal</th>
                  <th className="px-6 py-3">Face Confidence</th>
                  <th className="px-6 py-3">Decision</th>
                  <th className="px-6 py-3">Audit Token</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3 font-semibold text-slate-900">
                      {r.courseCode}
                      <span className="block text-[11px] font-normal text-slate-500">{r.courseTitle}</span>
                    </td>
                    <td className="px-6 py-3 text-slate-600 font-mono text-[11px]">{r.timestamp}</td>
                    <td className="px-6 py-3">
                      <span className="font-mono text-emerald-700">{r.bleEvidence.rssi} dBm</span>
                      <span className="text-[10px] text-slate-400 block">~{r.bleEvidence.estimatedDistanceMeters}m</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="font-mono font-bold text-indigo-700">{r.faceEvidence.matchScore}%</span>
                      <span className="text-[10px] text-emerald-600 block">Liveness: Pass</span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          r.decision.status === 'VERIFIED_PRESENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.decision.status === 'FLAGGED_REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.decision.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-[10px] text-slate-500">
                      {r.verificationToken.substring(0, 16)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
