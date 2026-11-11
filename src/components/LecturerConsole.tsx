import React, { useState, useEffect } from 'react';
import {
  PlayCircle,
  StopCircle,
  Radio,
  QrCode,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Maximize2,
  X,
  Plus,
  PlusCircle,
  FileSpreadsheet,
  Building2,
  RefreshCw,
  Search,
  School,
  ShieldAlert
} from 'lucide-react';
import { Course, Student, AttendanceRecord, LectureSession, DecisionStatus } from '../types/attendance';
import { QRCodeDisplay } from './QRCodeDisplay';

interface LecturerConsoleProps {
  courses: Course[];
  students: Student[];
  records: AttendanceRecord[];
  activeSession: LectureSession | null;
  onStartSession: (session: LectureSession) => void;
  onEndSession: () => void;
  onAddManualRecord: (record: AttendanceRecord) => void;
}

export const LecturerConsole: React.FC<LecturerConsoleProps> = ({
  courses,
  students,
  records,
  activeSession,
  onStartSession,
  onEndSession,
  onAddManualRecord,
}) => {
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(courses[0].code);
  const [roomInput, setRoomInput] = useState<string>(courses[0].room);
  const [rssiThresholdInput, setRssiThresholdInput] = useState<number>(-78);
  const [txPowerInput, setTxPowerInput] = useState<number>(-59);

  // Dynamic QR Code Rotation Timer
  const [qrCounter, setQrCounter] = useState(15);
  const [dynamicToken, setDynamicToken] = useState(activeSession?.otpCode || '849201');
  const [showProjectorModal, setShowProjectorModal] = useState(false);

  // Manual Override Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualStudentReg, setManualStudentReg] = useState(students[0].regNumber);
  const [manualDecision, setManualDecision] = useState<DecisionStatus>('VERIFIED_PRESENT');
  const [manualReason, setManualReason] = useState('Student phone battery depleted; verified in room by lecturer');

  // Rotate QR code token every 15 seconds when session is active
  useEffect(() => {
    if (!activeSession) return;

    const timer = setInterval(() => {
      setQrCounter((prev) => {
        if (prev <= 1) {
          // Generate new dynamic token
          const newToken = Math.floor(100000 + Math.random() * 900000).toString();
          setDynamicToken(newToken);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession]);

  const handleStart = () => {
    const course = courses.find((c) => c.code === selectedCourseCode) || courses[0];
    const initialOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setDynamicToken(initialOtp);
    setQrCounter(15);

    const newSession: LectureSession = {
      id: `SES-${course.code}-${Date.now()}`,
      courseCode: course.code,
      courseTitle: course.title,
      lecturerName: course.lecturerName,
      room: roomInput || course.room,
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      expiresAt: new Date(Date.now() + 7200000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isActive: true,
      otpCode: initialOtp,
      qrPayload: `SMAP://SESSION/${course.code}/${course.beaconUuid}/${initialOtp}`,
      beaconUuid: course.beaconUuid,
      beaconMajor: course.beaconMajor,
      beaconMinor: course.beaconMinor,
      txPower: txPowerInput,
      rssiThreshold: rssiThresholdInput,
    };

    onStartSession(newSession);
  };

  // Filter records for the active course session
  const activeCourseCode = activeSession ? activeSession.courseCode : selectedCourseCode;
  const currentSessionRecords = records.filter((r) => r.courseCode === activeCourseCode);
  const presentCount = currentSessionRecords.filter((r) => r.decision.status === 'VERIFIED_PRESENT').length;
  const flaggedCount = currentSessionRecords.filter((r) => r.decision.status === 'FLAGGED_REVIEW').length;

  // Handle manual override record
  const handleSaveManual = () => {
    const student = students.find((s) => s.regNumber === manualStudentReg) || students[0];
    const course = courses.find((c) => c.code === activeCourseCode) || courses[0];

    const manualRecord: AttendanceRecord = {
      id: `MAN-${Date.now()}`,
      sessionId: activeSession ? activeSession.id : `SES-${course.code}`,
      courseCode: course.code,
      courseTitle: course.title,
      studentReg: student.regNumber,
      studentName: student.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      bleEvidence: {
        beaconUuid: course.beaconUuid,
        major: course.beaconMajor,
        minor: course.beaconMinor,
        rssi: -60,
        estimatedDistanceMeters: 1.5,
        isWithinClassroomRange: true,
        timestamp: new Date().toLocaleTimeString(),
      },
      faceEvidence: {
        faceDetected: true,
        matchScore: 100,
        livenessPassed: true,
        livenessChallenge: 'blink',
        lightingQuality: 'good',
        timestamp: new Date().toLocaleTimeString(),
      },
      decision: {
        status: manualDecision,
        ruleMatched: 'R_ADMIN_SECRET_PORTAL_OVERRIDE',
        compositeConfidence: 100,
        reason: `Admin's Secret Portal authorization: ${manualReason}`,
        timestamp: new Date().toLocaleTimeString(),
      },
      anomaly: {
        riskScore: 0,
        riskLevel: 'LOW',
        flags: ['Admin Secret Portal Authorization'],
        deviceClashDetected: false,
        signalInconsistencyDetected: false,
        livenessSpoofSuspected: false,
        velocityAnomalyDetected: false,
        explanation: 'Authorized via Admin Secret Portal.',
      },
      verificationToken: `SMAP-ADMIN-${course.code}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };

    onAddManualRecord(manualRecord);
    setShowManualModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Session Control Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md ${
              activeSession ? 'bg-emerald-600 animate-pulse' : 'bg-indigo-700'
            }`}
          >
            <Radio className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Lecturer Classroom Broadcast</h2>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  activeSession
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {activeSession ? '● Beacon Broadcasting' : '○ Standby'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Control physical BLE beacon perimeter, rotating dynamic anti-proxy QR codes, and live student attendance.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeSession ? (
            <>
              <button
                onClick={() => setShowProjectorModal(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Projector Mode</span>
              </button>
              <button
                onClick={onEndSession}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <StopCircle className="w-4 h-4" />
                <span>Stop Broadcast</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleStart}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer w-full md:w-auto justify-center"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Start Lecture Broadcast</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Controls & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Session & Anti-Proxy QR (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Session Display / Setup Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>{activeSession ? 'Live Broadcast Parameters' : 'Configure New Session'}</span>
              {activeSession && (
                <span className="font-mono text-xs text-emerald-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Active
                </span>
              )}
            </h3>

            {!activeSession ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Select Course</label>
                  <select
                    value={selectedCourseCode}
                    onChange={(e) => {
                      setSelectedCourseCode(e.target.value);
                      const c = courses.find((course) => course.code === e.target.value);
                      if (c) setRoomInput(c.room);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-indigo-600"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Lecture Hall / Room</label>
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">RSSI Perimeter Gate</label>
                    <input
                      type="number"
                      value={rssiThresholdInput}
                      onChange={(e) => setRssiThresholdInput(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Nominal: -78 dBm</span>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">TX Power</label>
                    <input
                      type="number"
                      value={txPowerInput}
                      onChange={(e) => setTxPowerInput(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Standard: -59 dBm</span>
                  </div>
                </div>

                <button
                  onClick={handleStart}
                  className="w-full py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Start Broadcast for {selectedCourseCode}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Course:</span>
                    <strong className="text-slate-900">{activeSession.courseCode} ({activeSession.room})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Beacon UUID:</span>
                    <code className="text-[11px] font-mono text-indigo-700">{activeSession.beaconUuid}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Perimeter RSSI Gate:</span>
                    <span className="font-mono text-slate-800">{activeSession.rssiThreshold} dBm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Broadcast Started:</span>
                    <span className="font-mono text-slate-800">{activeSession.startTime}</span>
                  </div>
                </div>

                {/* Dynamic Rotating QR Code Card */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col items-center text-center space-y-4">
                  <div className="flex items-center justify-between w-full text-xs">
                    <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
                      <QrCode className="w-4 h-4" />
                      Dynamic Anti-Proxy QR
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                      Rotates in {qrCounter}s
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl shadow-lg">
                    <QRCodeDisplay
                      value={`SMAP://SESSION/${activeSession.courseCode}/${activeSession.beaconUuid}/${dynamicToken}`}
                      size={160}
                    />
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block uppercase tracking-wider">
                      Current Classroom 6-Digit Token:
                    </span>
                    <span className="text-2xl font-mono font-extrabold tracking-widest text-emerald-400">
                      {dynamicToken}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Refreshes automatically every 15s to prevent screenshot proxying
                    </p>
                  </div>

                  <button
                    onClick={() => setShowProjectorModal(true)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Open Full Screen for Projector</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Attendee Stream & Manual Override (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Real-time Attendee Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Verified Present
              </span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{presentCount}</div>
              <span className="text-[10px] text-slate-400">Biometrics & BLE passed</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Flagged for Review
              </span>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">{flaggedCount}</div>
              <span className="text-[10px] text-slate-400">Borderline score or anomaly</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Class Enrolled
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{students.length}</div>
              <span className="text-[10px] text-slate-400">Registered students</span>
            </div>
          </div>

          {/* Live Check-In Stream Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Live Attendance Feed ({activeCourseCode})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Incoming verification stream from classroom devices
                </p>
              </div>

              <button
                onClick={() => setShowManualModal(true)}
                title="Admin's Secret Portal"
                aria-label="Admin's Secret Portal"
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 transition-colors flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs hover:border-indigo-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[420px]">
              {currentSessionRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No students have checked in for this session yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Students will appear here in real-time as they verify attendance.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">BLE Signal</th>
                      <th className="px-4 py-3">Face Confidence</th>
                      <th className="px-4 py-3">Risk Assessment</th>
                      <th className="px-4 py-3">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentSessionRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <strong className="text-slate-900 block">{r.studentName}</strong>
                          <span className="font-mono text-[10px] text-slate-500">{r.studentReg}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{r.timestamp}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-emerald-700 font-bold">{r.bleEvidence.rssi} dBm</span>
                          <span className="text-[10px] text-slate-400 block">~{r.bleEvidence.estimatedDistanceMeters}m</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-indigo-700">{r.faceEvidence.matchScore}%</span>
                          <span className="text-[10px] text-emerald-600 block">Liveness: Pass</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.anomaly.riskLevel === 'LOW'
                                ? 'bg-emerald-50 text-emerald-700'
                                : r.anomaly.riskLevel === 'MODERATE'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {r.anomaly.riskScore}/100 ({r.anomaly.riskLevel})
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FULL-SCREEN PROJECTOR MODAL */}
      {showProjectorModal && activeSession && (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col p-8 text-white animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-6 border-b border-slate-800">
            <div>
              <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">
                Classroom Projector Mode
              </span>
              <h1 className="text-3xl font-extrabold mt-1">
                {activeSession.courseCode} — {activeSession.courseTitle}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Room: <strong>{activeSession.room}</strong> • Lecturer: <strong>{activeSession.lecturerName}</strong>
              </p>
            </div>

            <button
              onClick={() => setShowProjectorModal(false)}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-12 py-8">
            {/* Massive QR Display */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-6 bg-white rounded-3xl shadow-2xl">
                <QRCodeDisplay
                  value={`SMAP://SESSION/${activeSession.courseCode}/${activeSession.beaconUuid}/${dynamicToken}`}
                  size={260}
                />
              </div>
              <div className="flex items-center gap-2 font-mono text-sm text-amber-300">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Anti-Proxy QR Rotates in {qrCounter}s</span>
              </div>
            </div>

            {/* Verification Instructions & 6-Digit OTP */}
            <div className="max-w-md space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Classroom Session Code
                </span>
                <div className="text-5xl font-mono font-extrabold tracking-widest text-emerald-400">
                  {dynamicToken}
                </div>
                <p className="text-xs text-slate-400">
                  Enter this code or scan the QR code above on the student portal.
                </p>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-900 text-indigo-300 flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <p>Open <strong>SMAP University Portal</strong> on your phone or laptop.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-900 text-indigo-300 flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <p>Verify classroom Bluetooth signal or enter the 6-digit session code.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-900 text-indigo-300 flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <p>Complete the facial liveness challenge to claim your attendance receipt.</p>
                </div>
              </div>

              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-200 text-xs flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  <strong>{presentCount}</strong> students verified present so far in this lecture.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN'S SECRET PORTAL MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow-xs">
                  <ShieldAlert className="w-5 h-5 text-indigo-200" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Admin's Secret Portal</h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 block">
                    Administrative Override Console
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Privileged administrative access: Authorize immediate manual attendance verification, override biometric/BLE flags, or grant excused status with signed faculty credentials.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Student</label>
                <select
                  value={manualStudentReg}
                  onChange={(e) => setManualStudentReg(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-indigo-600"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.regNumber}>
                      {s.name} ({s.regNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Status Override</label>
                <select
                  value={manualDecision}
                  onChange={(e) => setManualDecision(e.target.value as DecisionStatus)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-indigo-600"
                >
                  <option value="VERIFIED_PRESENT">Verified Present</option>
                  <option value="FLAGGED_REVIEW">Flagged for Review</option>
                  <option value="LATE">Excused Late</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Admin / Faculty Justification Note</label>
                <textarea
                  rows={3}
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="e.g. Verified physical presence in classroom by faculty; battery depleted"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-indigo-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveManual}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
              >
                Authorize Admin Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
