import React, { useState, useEffect } from 'react';
import {
  School,
  Bluetooth,
  ScanFace,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  FileCheck2,
  ArrowLeft,
  Smartphone,
  Radio,
  Eye,
  Smile,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  Users,
  User,
  Sliders,
  Check,
  XCircle,
  Camera
} from 'lucide-react';
import {
  Course,
  Student,
  AttendanceRecord,
  LectureSession,
  BleEvidence,
  FaceEvidence,
  DecisionResult,
  AnomalyAssessment,
  FraudScenarioPreset
} from '../types/attendance';
import { FRAUD_SCENARIOS } from '../data/mockData';
import { evaluateAttendanceDecision } from '../services/decisionEngine';
import { evaluateAnomalyRisk } from '../services/anomalyEngine';
import { QRCodeDisplay } from './QRCodeDisplay';

interface FlutterSimulatorProps {
  courses: Course[];
  students: Student[];
  records: AttendanceRecord[];
  activeSession: LectureSession | null;
  onRecordAttendance: (record: AttendanceRecord) => void;
  onStartSession: (session: LectureSession) => void;
  onEndSession: () => void;
  recentDeviceCheckins: { deviceId: string; studentReg: string; timestamp: number }[];
}

type ScreenType =
  | 'home'
  | 'student_login'
  | 'student_verification_flow'
  | 'lecturer_login'
  | 'lecturer_dashboard'
  | 'info_page';

export const FlutterSimulator: React.FC<FlutterSimulatorProps> = ({
  courses,
  students,
  records,
  activeSession,
  onRecordAttendance,
  onStartSession,
  onEndSession,
  recentDeviceCheckins,
}) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [screenHistory, setScreenHistory] = useState<ScreenType[]>([]);
  const [snackBarMessage, setSnackBarMessage] = useState<string | null>(null);

  // Student Profile
  const [regInput, setRegInput] = useState('STU/2023/0042');
  const [passInput, setPassInput] = useState('••••••••');
  const [currentStudent, setCurrentStudent] = useState<Student>(students[0]);

  // Lecturer Auth
  const [lecturerIdInput, setLecturerIdInput] = useState('LEC/ENG/012');
  const [lecturerPassInput, setLecturerPassInput] = useState('••••••••');

  // Progressive Verification Flow Steps: 1: BLE Presence, 2: Face Liveness, 3: Decision & Anomaly
  const [verificationStep, setVerificationStep] = useState<'ble' | 'face' | 'decision'>('ble');

  // BLE Scan State
  const [isScanningBle, setIsScanningBle] = useState(false);
  const [bleRssi, setBleRssi] = useState(-64); // -64 dBm is nominal in-room
  const [bleDiscovered, setBleDiscovered] = useState(false);

  // Face Scan State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [livenessStage, setLivenessStage] = useState<'prompt' | 'blink' | 'analyzing' | 'complete'>('prompt');
  const [faceMatchScore, setFaceMatchScore] = useState(96);
  const [livenessPassedTest, setLivenessPassedTest] = useState(true);

  // Custom device ID to test device clashes
  const [simulatedDeviceId, setSimulatedDeviceId] = useState('DEV-PIXEL-7A-8821');

  // Result computed by engines
  const [currentDecision, setCurrentDecision] = useState<DecisionResult | null>(null);
  const [currentAnomaly, setCurrentAnomaly] = useState<AnomalyAssessment | null>(null);

  // Lecturer session start dialog
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [newSessionCourseCode, setNewSessionCourseCode] = useState(courses[0].code);

  // Verification search
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verifyResult, setVerifyResult] = useState<AttendanceRecord | null>(null);
  const [hasSearchedVerify, setHasSearchedVerify] = useState(false);

  const showSnackBar = (msg: string) => {
    setSnackBarMessage(msg);
    setTimeout(() => {
      setSnackBarMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const navigateTo = (screen: ScreenType) => {
    setScreenHistory((prev) => [...prev, currentScreen]);
    setCurrentScreen(screen);
  };

  const navigateBack = () => {
    if (screenHistory.length > 0) {
      const prev = screenHistory[screenHistory.length - 1];
      setScreenHistory((h) => h.slice(0, h.length - 1));
      setCurrentScreen(prev);
    } else {
      setCurrentScreen('home');
    }
  };

  // Helper for empty strings
  function isEmptyStr(val: string) {
    return !val || val.trim().length === 0;
  }

  // Handle student login submit
  const handleStudentLogin = () => {
    if (isEmptyStr(regInput) || isEmptyStr(passInput)) {
      showSnackBar('Enter both registration and password.');
      return;
    }
    const match = students.find((s) => s.regNumber.toLowerCase() === regInput.trim().toLowerCase());
    if (match) {
      setCurrentStudent(match);
      setSimulatedDeviceId(match.registeredDeviceId);
    }
    showSnackBar(`Logged in as ${regInput.trim()}`);
    setVerificationStep('ble');
    setBleDiscovered(false);
    setIsCameraActive(false);
    setCurrentDecision(null);
    setCurrentAnomaly(null);
    navigateTo('student_verification_flow');
  };

  // Handle lecturer login submit
  const handleLecturerLogin = () => {
    if (isEmptyStr(lecturerIdInput) || isEmptyStr(lecturerPassInput)) {
      showSnackBar('Enter lecturer credentials.');
      return;
    }
    showSnackBar('Welcome, Dr. Arthur Pendelton');
    navigateTo('lecturer_dashboard');
  };

  // Apply a fraud scenario preset
  const applyScenario = (preset: FraudScenarioPreset) => {
    setBleRssi(preset.bleRssi);
    setFaceMatchScore(preset.faceMatchScore);
    setLivenessPassedTest(preset.livenessPassed);
    setSimulatedDeviceId(preset.deviceId);
    showSnackBar(`Loaded scenario: ${preset.name}`);
  };

  // Step 1: Trigger simulated BLE scan
  const handleStartBleScan = () => {
    setIsScanningBle(true);
    setBleDiscovered(false);
    setTimeout(() => {
      setIsScanningBle(false);
      setBleDiscovered(true);
      showSnackBar('Classroom BLE Beacon discovered!');
    }, 1200);
  };

  // Step 2: Trigger simulated facial verification
  const handleStartFaceScan = () => {
    setIsCameraActive(true);
    setLivenessStage('blink');
    setTimeout(() => {
      setLivenessStage('analyzing');
      setTimeout(() => {
        setLivenessStage('complete');
        // Run decision and anomaly engines
        executeVerificationEngines();
      }, 1000);
    }, 1500);
  };

  // Compute distance from RSSI (Log-distance path loss model: d = 10 ^ ((TxPower - RSSI) / (10 * n)))
  const estimatedDistance = Math.max(0.5, Math.round(Math.pow(10, ((-59 - bleRssi) / (10 * 2.2))) * 10) / 10);
  const isWithinClassroom = bleRssi >= -78 && estimatedDistance <= 12;

  // Execute both independent engines
  const executeVerificationEngines = () => {
    const bleEvidence: BleEvidence = {
      beaconUuid: activeSession?.beaconUuid || '4F7A-SMAP-BEACON-CS301',
      major: activeSession?.beaconMajor || 101,
      minor: activeSession?.beaconMinor || 4,
      rssi: bleRssi,
      estimatedDistanceMeters: estimatedDistance,
      isWithinClassroomRange: isWithinClassroom,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    const faceEvidence: FaceEvidence = {
      faceDetected: true,
      matchScore: faceMatchScore,
      livenessPassed: livenessPassedTest,
      livenessChallenge: 'blink',
      lightingQuality: 'good',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    // 1. Evaluate Rule Engine
    const decision = evaluateAttendanceDecision(bleEvidence, faceEvidence, activeSession);
    setCurrentDecision(decision);

    // 2. Evaluate Anomaly Engine
    const anomaly = evaluateAnomalyRisk({
      student: currentStudent,
      currentDeviceId: simulatedDeviceId,
      bleEvidence,
      faceEvidence,
      recentDeviceCheckins,
      expectedClassroomRadiusMeters: 10,
    });
    setCurrentAnomaly(anomaly);

    setVerificationStep('decision');

    // If decision verified, commit record
    if (decision.status === 'VERIFIED_PRESENT' || decision.status === 'FLAGGED_REVIEW') {
      const newRec: AttendanceRecord = {
        id: `rec-${Date.now()}`,
        sessionId: activeSession?.id || `sess-${Date.now()}`,
        courseCode: activeSession?.courseCode || 'CS301',
        courseTitle: activeSession?.courseTitle || 'Operating Systems',
        studentReg: currentStudent.regNumber,
        studentName: currentStudent.name,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        bleEvidence,
        faceEvidence,
        decision,
        anomaly,
        verificationToken: `SMAP-${activeSession?.courseCode || 'CS301'}-${Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase()}`,
      };
      onRecordAttendance(newRec);
      showSnackBar(decision.status === 'VERIFIED_PRESENT' ? 'Attendance Verified!' : 'Flagged for Review');
    } else {
      showSnackBar('Attendance Rejected by Safety Engine.');
    }
  };

  // Student Attendance Stats
  const studentRecords = records.filter((r) => r.studentReg === currentStudent.regNumber);
  const totalEnrolled = 24;
  const verifiedCount = studentRecords.filter((r) => r.decision.status === 'VERIFIED_PRESENT').length;
  const attendanceRate = Math.round((verifiedCount / totalEnrolled) * 100);

  return (
    <div className="flex flex-col items-center justify-center p-2">
      {/* Phone Frame */}
      <div className="relative w-full max-w-[390px] h-[790px] bg-slate-900 rounded-[44px] p-3 shadow-2xl border-4 border-slate-700/60 flex flex-col overflow-hidden select-none">
        {/* Device Status Bar */}
        <div className="w-full pt-1 pb-1.5 px-6 flex items-center justify-between text-xs text-white/80 font-medium z-30">
          <span>09:41</span>
          <div className="w-24 h-4 bg-black rounded-full" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-indigo-300">BLE</span>
            <div className="w-3.5 h-2 border border-white/70 rounded-xs p-0.5 flex">
              <div className="h-full w-full bg-white rounded-xs" />
            </div>
          </div>
        </div>

        {/* Screen Canvas (Material 3 Theme: Indigo) */}
        <div className="relative flex-1 bg-slate-50 text-slate-900 rounded-[32px] overflow-hidden flex flex-col shadow-inner">
          {/* Material 3 App Bar */}
          <div className="bg-indigo-700 text-white px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-2.5">
              {currentScreen !== 'home' ? (
                <button
                  onClick={navigateBack}
                  className="p-1 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : null}
              <h1 className="text-base font-semibold tracking-wide truncate max-w-[210px]">
                {currentScreen === 'home' && 'SMAP Attendance'}
                {currentScreen === 'student_login' && 'Student Login'}
                {currentScreen === 'student_verification_flow' && 'Verification Engine'}
                {currentScreen === 'lecturer_login' && 'Lecturer Login'}
                {currentScreen === 'lecturer_dashboard' && 'Lecturer Dashboard'}
                {currentScreen === 'info_page' && 'Attendance Verification'}
              </h1>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-mono bg-indigo-800/80 px-2 py-0.5 rounded text-indigo-100">
              M3
            </div>
          </div>

          {/* Screen Content Body */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            {/* 1. HOME SCREEN */}
            {currentScreen === 'home' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-2">
                <div className="w-18 h-18 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 mb-3 shadow-sm">
                  <School className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  SMAP Attendance
                </h2>
                <p className="text-xs text-slate-500 mt-1 mb-6 max-w-xs">
                  Multimodal verification with BLE presence, facial liveness & anomaly defense
                </p>

                <div className="w-full flex flex-col gap-2.5">
                  <button
                    onClick={() => navigateTo('student_login')}
                    className="w-full py-3.5 px-4 bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] text-white font-medium text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    <span>Student Login & Verify</span>
                  </button>

                  <button
                    onClick={() => navigateTo('lecturer_login')}
                    className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.98] text-indigo-700 font-medium text-xs rounded-xl border border-indigo-200 shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>Lecturer Login & Broadcaster</span>
                  </button>

                  <button
                    onClick={() => navigateTo('info_page')}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                    <span>Attendance Verification</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. STUDENT LOGIN */}
            {currentScreen === 'student_login' && (
              <div className="flex-1 flex flex-col justify-center px-1 py-2">
                <div className="text-center mb-5">
                  <div className="w-12 h-12 mx-auto bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mb-2">
                    <User className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Student Portal</h3>
                  <p className="text-xs text-slate-500">Sign in to begin multimodal classroom check-in</p>
                </div>

                <div className="space-y-3.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={regInput}
                      onChange={(e) => setRegInput(e.target.value)}
                      placeholder="e.g. STU/2023/0042"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={passInput}
                      onChange={(e) => setPassInput(e.target.value)}
                      placeholder="Password"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={handleStudentLogin}
                      className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow transition-all"
                    >
                      Authenticate & Proceed
                    </button>
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <p className="text-[10px] text-slate-400 mb-1">Quick Select Student:</p>
                  <div className="flex justify-center gap-1.5">
                    {students.slice(0, 3).map((st) => (
                      <button
                        key={st.id}
                        onClick={() => {
                          setRegInput(st.regNumber);
                          setCurrentStudent(st);
                          setSimulatedDeviceId(st.registeredDeviceId);
                        }}
                        className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 hover:bg-indigo-100"
                      >
                        {st.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. STUDENT VERIFICATION FLOW (BLE -> FACE -> DECISION/ANOMALY) */}
            {currentScreen === 'student_verification_flow' && (
              <div className="flex-1 flex flex-col gap-3 py-1">
                {/* Flow Step Progress Tabs */}
                <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-1 rounded-xl text-center text-[10px] font-semibold">
                  <button
                    onClick={() => setVerificationStep('ble')}
                    className={`py-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      verificationStep === 'ble' ? 'bg-indigo-700 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <Bluetooth className="w-3 h-3" />
                    <span>1. BLE</span>
                  </button>
                  <button
                    onClick={() => setVerificationStep('face')}
                    className={`py-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      verificationStep === 'face' ? 'bg-indigo-700 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <ScanFace className="w-3 h-3" />
                    <span>2. Face</span>
                  </button>
                  <button
                    onClick={() => setVerificationStep('decision')}
                    className={`py-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      verificationStep === 'decision' ? 'bg-indigo-700 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span>3. Verdict</span>
                  </button>
                </div>

                {/* STEP 1: BLE CLASSROOM PRESENCE */}
                {verificationStep === 'ble' && (
                  <div className="space-y-3">
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-center">
                      <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center mb-2">
                        <Bluetooth className={`w-6 h-6 ${isScanningBle ? 'animate-pulse' : ''}`} />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">Classroom BLE Presence</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Detecting physical room beacon for <strong>{activeSession?.courseCode || 'CS301'}</strong> ({activeSession?.room || 'LT 4B'})
                      </p>

                      <div className="mt-3">
                        <button
                          onClick={handleStartBleScan}
                          disabled={isScanningBle}
                          className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 mx-auto"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          <span>{isScanningBle ? 'Scanning 2.4GHz BLE...' : 'Scan Classroom Beacon'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Discovered Beacon Details Card */}
                    {bleDiscovered && (
                      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Beacon Detected
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isWithinClassroom ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {isWithinClassroom ? 'In Classroom Range' : 'Out of Bounds (Hallway)'}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-xl space-y-1 font-mono text-[10px] text-slate-600">
                          <div className="flex justify-between">
                            <span>UUID:</span>
                            <span className="truncate max-w-[170px] text-slate-800">{activeSession?.beaconUuid || '4F7A-SMAP-BEACON-CS301'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Signal (RSSI):</span>
                            <span className="font-bold text-slate-900">{bleRssi} dBm</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Estimated Distance:</span>
                            <span className="font-bold text-indigo-700">~{estimatedDistance} meters</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Threshold:</span>
                            <span>&gt;= {activeSession?.rssiThreshold || -78} dBm</span>
                          </div>
                        </div>

                        {/* Signal tuning slider to test attenuation */}
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                            <span>Simulate Distance / Signal:</span>
                            <span>{bleRssi} dBm ({estimatedDistance}m)</span>
                          </div>
                          <input
                            type="range"
                            min="-95"
                            max="-50"
                            value={bleRssi}
                            onChange={(e) => setBleRssi(Number(e.target.value))}
                            className="w-full accent-indigo-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                          <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                            <span>-95 dBm (Outside Hallway)</span>
                            <span>-50 dBm (Front Row)</span>
                          </div>
                        </div>

                        <button
                          onClick={() => setVerificationStep('face')}
                          className="w-full py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 mt-2"
                        >
                          <span>Proceed to Facial Verification</span>
                          <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 2: FACIAL VERIFICATION & LIVENESS */}
                {verificationStep === 'face' && (
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm text-center">
                      <h4 className="font-bold text-slate-900 text-xs">Biometric Anti-Spoof Liveness</h4>
                      <p className="text-[11px] text-slate-500">Hold camera steady and perform the liveness challenge</p>

                      {/* Camera Viewfinder Mock */}
                      <div className="relative w-48 h-48 mx-auto my-3 bg-slate-900 rounded-2xl overflow-hidden border-2 border-indigo-500 flex flex-col items-center justify-center shadow-inner">
                        {/* Oval Face Guide */}
                        <div className={`w-32 h-40 border-2 rounded-[50%] transition-colors ${
                          livenessStage === 'complete' ? 'border-emerald-400' : 'border-dashed border-indigo-400/80 animate-pulse'
                        } flex items-center justify-center`}>
                          <ScanFace className="w-16 h-16 text-white/40" />
                        </div>

                        {/* Liveness prompt pill */}
                        <div className="absolute bottom-2 bg-black/70 backdrop-blur-xs text-white text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1">
                          {livenessStage === 'prompt' && <span>Position face in oval</span>}
                          {livenessStage === 'blink' && (
                            <span className="text-amber-300 font-bold flex items-center gap-1">
                              <Eye className="w-3 h-3" /> Please blink both eyes
                            </span>
                          )}
                          {livenessStage === 'analyzing' && <span className="text-indigo-300">Matching template...</span>}
                          {livenessStage === 'complete' && (
                            <span className="text-emerald-300 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Liveness Confirmed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="space-y-2">
                        <button
                          onClick={handleStartFaceScan}
                          disabled={isCameraActive && livenessStage !== 'complete'}
                          className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{isCameraActive ? 'Re-scan Face' : 'Capture & Verify Liveness'}</span>
                        </button>

                        {/* Test toggle for photo spoof attack */}
                        <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-100 p-2 rounded-xl">
                          <span>Simulate Liveness Pass:</span>
                          <button
                            onClick={() => setLivenessPassedTest(!livenessPassedTest)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              livenessPassedTest ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            }`}
                          >
                            {livenessPassedTest ? 'Genuine Live Person' : 'Spoofed Printed Photo'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: DECISION & ANOMALY VERDICT */}
                {verificationStep === 'decision' && currentDecision && currentAnomaly && (
                  <div className="space-y-3">
                    {/* Primary Decision Banner */}
                    <div className={`p-4 rounded-2xl border text-center ${
                      currentDecision.status === 'VERIFIED_PRESENT'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : currentDecision.status === 'FLAGGED_REVIEW'
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}>
                      <div className="flex items-center justify-center gap-1.5 font-bold text-sm mb-1">
                        {currentDecision.status === 'VERIFIED_PRESENT' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                        {currentDecision.status === 'FLAGGED_REVIEW' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                        {currentDecision.status === 'REJECTED_ABSENT' && <XCircle className="w-5 h-5 text-rose-600" />}
                        <span>{currentDecision.status.replace('_', ' ')}</span>
                      </div>
                      <p className="text-[11px] opacity-90 leading-tight">
                        {currentDecision.reason}
                      </p>
                    </div>

                    {/* Dual Engine Breakdown Card */}
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
                      <div className="border-b border-slate-100 pb-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Rule Decision Engine
                        </span>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-800">Rule Triggered:</span>
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {currentDecision.ruleMatched}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs mt-1">
                          <span className="text-slate-600">Composite Confidence:</span>
                          <span className="font-bold text-indigo-700">{currentDecision.compositeConfidence}%</span>
                        </div>
                      </div>

                      {/* Anomaly Engine Output */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            Independent Risk Engine
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            currentAnomaly.riskLevel === 'LOW'
                              ? 'bg-emerald-50 text-emerald-700'
                              : currentAnomaly.riskLevel === 'MODERATE'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            Risk: {currentAnomaly.riskScore}/100 ({currentAnomaly.riskLevel})
                          </span>
                        </div>

                        {currentAnomaly.flags.length > 0 ? (
                          <div className="space-y-1 mt-1.5">
                            {currentAnomaly.flags.map((flag, idx) => (
                              <div key={idx} className="bg-rose-50 border border-rose-200 p-1.5 rounded-lg text-[10px] text-rose-800">
                                ⚠ {flag}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-emerald-700 bg-emerald-50 p-1.5 rounded-lg">
                            ✓ No anomalous presence or hardware signatures detected.
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setVerificationStep('ble');
                          setBleDiscovered(false);
                          setIsCameraActive(false);
                        }}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                      >
                        Start New Verification
                      </button>
                    </div>
                  </div>
                )}

                {/* Scenario Presets Pill Bar */}
                <div className="mt-auto pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                    Simulate Fraud Scenarios:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                    {FRAUD_SCENARIOS.map((sc) => (
                      <button
                        key={sc.id}
                        onClick={() => applyScenario(sc)}
                        className="p-1.5 bg-white hover:bg-indigo-50 border border-slate-200 rounded-lg text-left truncate text-slate-700 hover:text-indigo-900"
                        title={sc.description}
                      >
                        {sc.name.split('.')[1]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. LECTURER LOGIN */}
            {currentScreen === 'lecturer_login' && (
              <div className="flex-1 flex flex-col justify-center px-1 py-2">
                <div className="text-center mb-5">
                  <div className="w-12 h-12 mx-auto bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mb-2">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Faculty Gateway</h3>
                  <p className="text-xs text-slate-500">Manage BLE beacon broadcasting and attendance queues</p>
                </div>

                <div className="space-y-3.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Faculty ID
                    </label>
                    <input
                      type="text"
                      value={lecturerIdInput}
                      onChange={(e) => setLecturerIdInput(e.target.value)}
                      placeholder="e.g. LEC/ENG/012"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={lecturerPassInput}
                      onChange={(e) => setLecturerPassInput(e.target.value)}
                      placeholder="Password"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={handleLecturerLogin}
                      className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow transition-all"
                    >
                      Access Lecturer Console
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. LECTURER DASHBOARD */}
            {currentScreen === 'lecturer_dashboard' && (
              <div className="flex-1 flex flex-col gap-3 py-1">
                <div className="text-center py-1">
                  <h3 className="text-base font-bold text-slate-900">Lecturer Control Station</h3>
                  <p className="text-xs text-slate-500">Classroom BLE broadcaster & multi-evidence radar</p>
                </div>

                {activeSession ? (
                  <div className="bg-white border-2 border-indigo-600 rounded-2xl p-3.5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between text-xs text-indigo-700 font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        BLE BEACON BROADCASTING
                      </span>
                      <span className="font-mono text-[10px] bg-indigo-50 px-2 py-0.5 rounded text-indigo-800">
                        {activeSession.room}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900">
                      {activeSession.courseCode}: {activeSession.courseTitle}
                    </h4>

                    {/* Beacon Transmission Specs */}
                    <div className="bg-slate-50 p-2.5 rounded-xl text-[10px] font-mono space-y-1 text-slate-600">
                      <div className="flex justify-between">
                        <span>Beacon UUID:</span>
                        <span className="text-slate-900 font-bold">{activeSession.beaconUuid}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Major/Minor:</span>
                        <span>{activeSession.beaconMajor} / {activeSession.beaconMinor}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tx Power / RSSI Gate:</span>
                        <span className="text-indigo-700 font-bold">{activeSession.txPower} dBm / &gt;= {activeSession.rssiThreshold} dBm</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-around bg-indigo-50/70 p-2 rounded-xl text-center">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-slate-500">Verified</p>
                        <p className="text-base font-bold text-emerald-700">
                          {records.filter((r) => r.courseCode === activeSession.courseCode && r.decision.status === 'VERIFIED_PRESENT').length}
                        </p>
                      </div>
                      <div className="h-6 w-px bg-slate-300" />
                      <div>
                        <p className="text-[9px] uppercase font-bold text-slate-500">Flagged</p>
                        <p className="text-base font-bold text-amber-700">
                          {records.filter((r) => r.courseCode === activeSession.courseCode && r.decision.status === 'FLAGGED_REVIEW').length}
                        </p>
                      </div>
                      <div className="h-6 w-px bg-slate-300" />
                      <div>
                        <p className="text-[9px] uppercase font-bold text-slate-500">OTP</p>
                        <p className="text-base font-mono font-bold text-indigo-900">{activeSession.otpCode}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onEndSession();
                        showSnackBar('Session broadcast stopped.');
                      }}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Conclude Broadcast
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowNewSessionDialog(true)}
                      className="w-full py-3 px-4 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>Broadcast Classroom Beacon</span>
                    </button>
                  </div>
                )}

                {/* Recent Incoming Verification Radar */}
                <div className="flex-1 mt-1">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Live Check-in Stream
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {records.slice(0, 4).map((r) => (
                      <div key={r.id} className="bg-white p-2 rounded-xl border border-slate-200 text-[11px] flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{r.studentName}</p>
                          <p className="text-[9px] text-slate-500 font-mono">
                            BLE: {r.bleEvidence.rssi}dBm · Face: {r.faceEvidence.matchScore}%
                          </p>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          r.decision.status === 'VERIFIED_PRESENT'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {r.decision.status === 'VERIFIED_PRESENT' ? 'PRESENT' : 'FLAGGED'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 6. INFO PAGE / ATTENDANCE VERIFICATION */}
            {currentScreen === 'info_page' && (
              <div className="flex-1 flex flex-col py-1">
                <div className="text-center mb-3">
                  <div className="w-10 h-10 mx-auto bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center mb-1.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Official Record Verification</h3>
                  <p className="text-[11px] text-slate-500">Query multi-evidence cryptographically signed token</p>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2 mb-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={verifyQuery}
                      onChange={(e) => setVerifyQuery(e.target.value)}
                      placeholder="Enter token (e.g. SMAP-CS301-89F2A)"
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => {
                        const q = verifyQuery.trim().toLowerCase();
                        const found = records.find(
                          (r) => r.verificationToken.toLowerCase() === q || r.studentReg.toLowerCase() === q
                        );
                        setVerifyResult(found || null);
                        setHasSearchedVerify(true);
                      }}
                      className="px-3 py-1.5 bg-indigo-700 text-white rounded-lg text-xs font-medium"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {hasSearchedVerify && (
                  verifyResult ? (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 text-xs text-emerald-950 space-y-1 font-mono text-[10px]">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-xs mb-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>CRYPTOGRAPHICALLY VERIFIED</span>
                      </div>
                      <p><strong>Student:</strong> {verifyResult.studentName} ({verifyResult.studentReg})</p>
                      <p><strong>Course:</strong> {verifyResult.courseCode}</p>
                      <p><strong>BLE Signal:</strong> {verifyResult.bleEvidence.rssi} dBm (~{verifyResult.bleEvidence.estimatedDistanceMeters}m)</p>
                      <p><strong>Biometric Match:</strong> {verifyResult.faceEvidence.matchScore}% (Liveness: PASS)</p>
                      <p><strong>Fraud Risk:</strong> {verifyResult.anomaly.riskScore}/100 ({verifyResult.anomaly.riskLevel})</p>
                      <p><strong>Token:</strong> {verifyResult.verificationToken}</p>
                    </div>
                  ) : (
                    <div className="bg-rose-50 border border-rose-300 rounded-2xl p-3 text-center text-rose-800 text-xs">
                      No matching verified record found for this token.
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Floating SnackBar Banner */}
          {snackBarMessage && (
            <div className="absolute bottom-4 left-4 right-4 bg-slate-900/95 text-white px-3.5 py-2 rounded-xl shadow-lg flex items-center justify-between text-xs z-50">
              <span className="truncate mr-2">{snackBarMessage}</span>
              <button onClick={() => setSnackBarMessage(null)} className="text-indigo-400 font-semibold text-[10px]">
                DISMISS
              </button>
            </div>
          )}

          {/* Start Session Modal */}
          {showNewSessionDialog && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-xl space-y-3">
                <h4 className="font-bold text-slate-900 text-sm">Launch Classroom BLE Beacon</h4>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Course</label>
                  <select
                    value={newSessionCourseCode}
                    onChange={(e) => setNewSessionCourseCode(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} - {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowNewSessionDialog(false)}
                    className="flex-1 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const sel = courses.find((c) => c.code === newSessionCourseCode) || courses[0];
                      const newSess: LectureSession = {
                        id: `sess-${Date.now()}`,
                        courseCode: sel.code,
                        courseTitle: sel.title,
                        lecturerName: sel.lecturerName,
                        room: sel.room,
                        startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        expiresAt: '45m',
                        isActive: true,
                        otpCode: Math.floor(100000 + Math.random() * 900000).toString(),
                        qrPayload: `SMAP://SESSION/${sel.code}/TOK-${Math.floor(1000 + Math.random() * 9000)}`,
                        beaconUuid: sel.beaconUuid,
                        beaconMajor: sel.beaconMajor,
                        beaconMinor: sel.beaconMinor,
                        txPower: -59,
                        rssiThreshold: -78,
                      };
                      onStartSession(newSess);
                      setShowNewSessionDialog(false);
                      showSnackBar(`Broadcasting BLE for ${sel.code}`);
                    }}
                    className="flex-1 py-1.5 text-xs text-white bg-indigo-700 rounded-lg font-semibold"
                  >
                    Broadcast
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar indicator */}
        <div className="w-32 h-1 bg-white/40 rounded-full mx-auto mt-2" />
      </div>

      {/* Quick Nav Strip */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 max-w-md">
        <button
          onClick={() => setCurrentScreen('home')}
          className={`px-2.5 py-1 text-xs rounded-md border ${
            currentScreen === 'home'
              ? 'bg-indigo-700 text-white border-indigo-700 font-semibold'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          Home
        </button>
        <button
          onClick={() => setCurrentScreen('student_verification_flow')}
          className={`px-2.5 py-1 text-xs rounded-md border ${
            currentScreen === 'student_verification_flow'
              ? 'bg-indigo-700 text-white border-indigo-700 font-semibold'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          Verification Engine
        </button>
        <button
          onClick={() => setCurrentScreen('lecturer_dashboard')}
          className={`px-2.5 py-1 text-xs rounded-md border ${
            currentScreen === 'lecturer_dashboard'
              ? 'bg-indigo-700 text-white border-indigo-700 font-semibold'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          Lecturer Console
        </button>
      </div>
    </div>
  );
};
