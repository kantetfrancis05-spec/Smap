import React, { useState, useRef, useEffect } from 'react';
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
  Fingerprint,
  Smartphone,
  LogOut,
  IdCard,
  XCircle,
  Lock,
  Upload,
  RefreshCw,
  Mail,
  Phone,
  Pencil,
  Trash2,
  Save
} from 'lucide-react';
import { Course, Student, AttendanceRecord, LectureSession, BleEvidence, FaceEvidence } from '../types/attendance';
import { WebCamScanner } from './WebCamScanner';
import { evaluateAttendanceDecision } from '../services/decisionEngine';
import { evaluateAnomalyRisk } from '../services/anomalyEngine';
import {
  calculateSessionAttendancePercentage,
  calculateOverallAttendancePercentage,
} from '../services/attendanceCalculator';
import {
  scanForLecturerPhoneBeacon,
  buildAdvertisingLocalName,
  isWebBluetoothSupported,
} from '../services/bleService';
import {
  getStudentPassportUrl,
  isCustomPassportPhoto,
  processPassportFileToDataUrl,
} from '../services/passportMatchService';

interface StudentPortalProps {
  student: Student | null;
  students: Student[];
  onLoginStudent: (student: Student) => void;
  onLogoutStudent: () => void;
  onUpdateStudentPassport: (studentReg: string, passportPhotoUrl?: string) => void;
  onUpdateStudentProfile: (updatedStudent: Student) => void;
  requestedTab?: { tab: 'overview' | 'checkin' | 'history' | 'profile'; nonce: number } | null;
  courses: Course[];
  records: AttendanceRecord[];
  activeSession: LectureSession | null;
  onRecordAttendance: (record: AttendanceRecord) => void;
  recentDeviceCheckins: { deviceId: string; studentReg: string; timestamp: number }[];
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  student,
  students,
  onLoginStudent,
  onLogoutStudent,
  onUpdateStudentPassport,
  onUpdateStudentProfile,
  requestedTab,
  courses,
  records,
  activeSession,
  onRecordAttendance,
  recentDeviceCheckins,
}) => {
  // Admission Login State
  const [admissionInput, setAdmissionInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'checkin' | 'history' | 'profile'>('overview');
  const [checkinMethod, setCheckinMethod] = useState<'multimodal' | 'qr'>('multimodal');

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileDepartment, setProfileDepartment] = useState('');
  const [profileYear, setProfileYear] = useState<number>(3);
  const [profileDeviceId, setProfileDeviceId] = useState('');
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);

  // Profile Passport Capture / Upload State
  const [passportCameraActive, setPassportCameraActive] = useState(false);
  const [passportError, setPassportError] = useState<string | null>(null);
  const passportVideoRef = useRef<HTMLVideoElement | null>(null);
  const passportStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab.tab);
    }
  }, [requestedTab]);

  useEffect(() => {
    if (!student) return;
    setProfileName(student.name);
    setProfileEmail(student.email || '');
    setProfilePhone(student.phone || '');
    setProfileBio(student.bio || '');
    setProfileDepartment(student.department);
    setProfileYear(student.year);
    setProfileDeviceId(student.registeredDeviceId);
    setIsEditingProfile(false);
  }, [student]);

  const stopPassportCamera = () => {
    if (passportStreamRef.current) {
      passportStreamRef.current.getTracks().forEach((t) => t.stop());
      passportStreamRef.current = null;
    }
    if (passportVideoRef.current) {
      passportVideoRef.current.srcObject = null;
    }
    setPassportCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (passportStreamRef.current) {
        passportStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Checkin Workflow Steps
  const [step, setStep] = useState<'ready' | 'ble_scan' | 'face_scan' | 'submitting' | 'result'>('ready');

  // BLE Scan & Lesson Connection Duration State
  const lessonDurationMinutes = Math.max(1, activeSession?.lessonDurationMinutes ?? 60);
  const [bleScanning, setBleScanning] = useState(false);
  const [bleEvidence, setBleEvidence] = useState<BleEvidence | null>(null);
  const [simulatedRssi, setSimulatedRssi] = useState(-66); // -66 dBm is strong inside classroom
  const [simulatedBleMinutes, setSimulatedBleMinutes] = useState<number>(56);
  const [bleScanNote, setBleScanNote] = useState<string | null>(null);

  // Face Scan State
  const [faceEvidence, setFaceEvidence] = useState<FaceEvidence | null>(null);

  // QR Code / OTP Input State
  const [enteredOtp, setEnteredOtp] = useState('');
  const [qrScanError, setQrScanError] = useState<string | null>(null);

  // Final verification result
  const [latestRecord, setLatestRecord] = useState<AttendanceRecord | null>(null);

  // Handle Admission Number Login
  const handleAdmissionLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const normalized = admissionInput.trim().toLowerCase();
    if (!normalized) {
      setLoginError('Please enter your admission number to continue.');
      return;
    }

    const matched = students.find((s) => s.regNumber.trim().toLowerCase() === normalized);
    if (!matched) {
      setLoginError(
        `Access denied: "${admissionInput.trim()}" is not in the registered student directory. Students must be enrolled by a lecturer or administrator in Lecturer Console → Student Registry before logging in.`
      );
      return;
    }

    setAdmissionInput('');
    setStep('ready');
    setActiveTab('overview');
    setLatestRecord(null);
    setBleEvidence(null);
    setFaceEvidence(null);
    onLoginStudent(matched);
  };

  if (!student) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 mx-auto flex items-center justify-center">
              <IdCard className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Student Portal Sign-In</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Enter your registered university admission number. Unregistered admission numbers cannot sign in.
            </p>
          </div>

          <form onSubmit={handleAdmissionLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admission-number" className="text-xs font-semibold text-slate-700 block">
                Admission Number
              </label>
              <input
                id="admission-number"
                type="text"
                autoFocus
                value={admissionInput}
                onChange={(e) => {
                  setAdmissionInput(e.target.value.toUpperCase());
                  if (loginError) setLoginError(null);
                }}
                placeholder="Enter your admission number (e.g. STU/2023/0042)"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-indigo-600 focus:bg-white transition-colors"
              />
              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-start gap-2 mt-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{loginError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 px-6 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Log In with Admission Number</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600">
            <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-slate-800 block">Where do new students register?</span>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Students must be enrolled first by an authorized lecturer or administrator under{' '}
                <strong className="text-slate-700">Lecturer Console → Student Registry &amp; Enrollment</strong>. This prevents unknown users from logging in or bypassing attendance controls.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Student's own records & percentage driven by Real Face Detection + BLE Connected Lesson Time
  const myRecords = records.filter((r) => r.studentReg === student.regNumber);
  const verifiedCount = myRecords.filter((r) => r.decision.status === 'VERIFIED_PRESENT').length;
  const overallPercentage = myRecords.length > 0 ? calculateOverallAttendancePercentage(myRecords) : 0;

  // Start Lecturer Phone BLE Beacon Scan
  const handleStartBleScan = async () => {
    setBleScanning(true);
    setBleScanNote(null);
    setStep('ble_scan');

    const rssiThreshold = activeSession?.rssiThreshold ?? -78;
    const clampedConnectedMinutes =
      simulatedRssi >= rssiThreshold
        ? Math.max(0, Math.min(lessonDurationMinutes, simulatedBleMinutes))
        : 0;

    const outcome = await scanForLecturerPhoneBeacon({
      session: activeSession,
      fallbackRssi: simulatedRssi,
      preferRealBluetooth: true,
      bleConnectedMinutes: clampedConnectedMinutes,
    });

    const delayMs = outcome.usedRealWebBluetooth ? 450 : 1200;
    setTimeout(() => {
      setBleEvidence(outcome.evidence);
      setBleScanNote(outcome.note);
      setBleScanning(false);
      setStep('face_scan');
    }, delayMs);
  };

  const studentPassportUrl = getStudentPassportUrl(student);

  const handlePassportFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPassportError(null);
    try {
      const processedUrl = await processPassportFileToDataUrl(file);
      onUpdateStudentPassport(student.regNumber, processedUrl);
    } catch (err: any) {
      setPassportError(err?.message || 'Could not process uploaded passport photo.');
    } finally {
      e.target.value = '';
    }
  };

  const handleStartPassportCamera = async () => {
    setPassportError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setPassportError('Camera API unavailable in this browser. Use Upload Passport Photo instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      passportStreamRef.current = stream;
      setPassportCameraActive(true);
      window.setTimeout(() => {
        if (passportVideoRef.current) {
          passportVideoRef.current.srcObject = stream;
          passportVideoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setPassportError('Camera permission denied. Allow camera access or upload a passport image file.');
    }
  };

  const handleCapturePassportFromCamera = () => {
    const video = passportVideoRef.current;
    if (!video || video.readyState < 2) {
      setPassportError('Camera stream not ready yet.');
      return;
    }
    const targetW = 240;
    const targetH = 280;
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const targetRatio = targetW / targetH;
    const vidRatio = video.videoWidth / Math.max(1, video.videoHeight);
    let sx = 0;
    let sy = 0;
    let sw = video.videoWidth;
    let sh = video.videoHeight;
    if (vidRatio > targetRatio) {
      sw = video.videoHeight * targetRatio;
      sx = (video.videoWidth - sw) / 2;
    } else {
      sh = video.videoWidth / targetRatio;
      sy = (video.videoHeight - sh) / 2;
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    onUpdateStudentPassport(student.regNumber, dataUrl);
    stopPassportCamera();
  };

  // Face scan completion
  const handleFaceComplete = (faceData: {
    faceDetected: boolean;
    matchScore: number;
    livenessPassed: boolean;
    lightingQuality?: 'good' | 'fair' | 'poor';
    challengeType: 'blink' | 'smile' | 'tilt';
    photoSnapshotUrl?: string;
    passportMatched?: boolean;
    passportMatchScore?: number;
    passportPhotoUrl?: string;
  }) => {
    const fEvidence: FaceEvidence = {
      faceDetected: faceData.faceDetected,
      matchScore: faceData.matchScore,
      livenessPassed: faceData.livenessPassed,
      livenessChallenge: faceData.challengeType,
      lightingQuality: faceData.lightingQuality || 'good',
      timestamp: new Date().toLocaleTimeString(),
      passportMatched: faceData.passportMatched,
      passportMatchScore: faceData.passportMatchScore,
      passportPhotoUrl: faceData.passportPhotoUrl || studentPassportUrl,
      scannedFacePhotoUrl: faceData.photoSnapshotUrl,
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
        beaconSource: 'lecturer_phone',
        lecturerPhoneName: `${course.lecturerName}'s Phone`,
        lecturerBluetoothId: 'BT-LEC-DEFAULT',
        advertisingLocalName: buildAdvertisingLocalName(course.code, '849201'),
        advertisingIntervalMs: 100,
        lessonDurationMinutes: 60,
      };

      // 1. Evaluate Decision Status & Attendance Percentage (BLE Connected Time + Real Face)
      const percentageBreakdown = calculateSessionAttendancePercentage(
        ble,
        face,
        sessionToUse.lessonDurationMinutes ?? 60
      );
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
        attendancePercentage: percentageBreakdown.attendancePercentage,
      };

      setLatestRecord(newRecord);
      onRecordAttendance(newRecord);
      setStep('result');
    }, 1000);
  };

  // Handle OTP / QR verification -> triggers automatic face scan
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

    // Bind classroom BLE evidence via OTP, then advance to automatic face scan
    const duration = Math.max(1, activeSession.lessonDurationMinutes ?? 60);
    const connectedMins = Math.max(0, Math.min(duration, simulatedBleMinutes));
    const ble: BleEvidence = {
      beaconUuid: activeSession.beaconUuid,
      major: activeSession.beaconMajor,
      minor: activeSession.beaconMinor,
      rssi: -62,
      estimatedDistanceMeters: 2.1,
      isWithinClassroomRange: true,
      timestamp: new Date().toLocaleTimeString(),
      beaconSource: activeSession.beaconSource,
      lecturerPhoneName: activeSession.lecturerPhoneName,
      lecturerBluetoothId: activeSession.lecturerBluetoothId,
      scanMethod: 'simulated_rf',
      bleConnectedMinutes: connectedMins,
      lessonDurationMinutes: duration,
      bleConnectionPercentage: Math.round((connectedMins / duration) * 100),
    };

    setBleEvidence(ble);
    setBleScanNote(
      `Session OTP verified with ${activeSession.lecturerPhoneName} (${connectedMins}/${duration} min BLE connected).`
    );
    setCheckinMethod('multimodal');
    setEnteredOtp('');
    setStep('face_scan');
  };

  return (
    <div className="space-y-6">
      {/* Student Profile Hero Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            title="View & Edit Profile"
            className="relative group shrink-0 cursor-pointer"
          >
            <img
              src={studentPassportUrl}
              alt={student.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-indigo-200 shadow-md group-hover:border-indigo-500 transition-colors bg-slate-100"
            />
            <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-indigo-700 text-white flex items-center justify-center shadow-xs border-2 border-white">
              <Camera className="w-2.5 h-2.5" />
            </span>
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">{student.name}</h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700">
                Year {student.year}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Reg: <strong className="font-mono text-slate-700">{student.regNumber}</strong> • {student.department}
              {student.email && <> • {student.email}</>}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Fingerprint className="w-3.5 h-3.5 text-emerald-600" />
                Face ID:{' '}
                <strong className={isCustomPassportPhoto(student.passportPhotoUrl) ? 'text-emerald-700' : 'text-indigo-700'}>
                  {isCustomPassportPhoto(student.passportPhotoUrl) ? 'Profile Photo Active' : 'Default Avatar'}
                </strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                Device: {student.registeredDeviceId}
              </span>
            </div>
          </div>
        </div>

        {/* Attendance Score Card & Sign Out */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-200/80 p-4 rounded-xl w-full md:w-auto">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Weighted Attendance Score
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-extrabold text-slate-900">{overallPercentage}%</span>
              <span
                className={`text-xs font-semibold ${
                  myRecords.length === 0
                    ? 'text-slate-500'
                    : overallPercentage >= 75
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {myRecords.length === 0
                  ? 'No sessions yet'
                  : overallPercentage >= 75
                  ? '✓ Exam Eligible'
                  : '⚠ Below 75%'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">70% BLE Lesson Time + 30% Real Face</span>
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

          <button
            onClick={() => {
              setStep('ready');
              setLatestRecord(null);
              setBleEvidence(null);
              setFaceEvidence(null);
              onLogoutStudent();
            }}
            className="ml-auto md:ml-2 px-3 py-2 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
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

        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>My Profile</span>
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
                    Lecturer Phone Bluetooth Beacon Live
                  </span>
                </div>
                <h3 className="text-lg font-bold">
                  {activeSession.courseCode} — {activeSession.courseTitle}
                </h3>
                <p className="text-xs text-indigo-100">
                  Room: <strong>{activeSession.room}</strong> • Host Phone: <strong>{activeSession.lecturerPhoneName}</strong> ({activeSession.advertisingLocalName})
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
              const percentage = courseRecords.length > 0 ? calculateOverallAttendancePercentage(courseRecords) : 0;
              const isExamEligible = courseRecords.length === 0 || percentage >= 75;

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
                          courseRecords.length === 0
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : isExamEligible
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {courseRecords.length === 0
                          ? 'No Sessions Logged'
                          : isExamEligible
                          ? 'Exam Clear'
                          : 'Attendance Warning'}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 mt-2.5">{course.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {course.lecturerName} • {course.room}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">Face &amp; BLE Attendance Rate</span>
                      <span className="text-slate-900">
                        {percentage}% ({presentCount}/{courseRecords.length} logged)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          courseRecords.length === 0
                            ? 'bg-slate-300'
                            : percentage >= 85
                            ? 'bg-indigo-600'
                            : percentage >= 75
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
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
                  Lecturer Phone BLE
                </div>

                <div
                  className={`p-3 rounded-xl border transition-all ${
                    step === 'face_scan'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <span className="block text-[10px] text-indigo-600 uppercase font-mono">Step 2</span>
                  Automatic Face Scan
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
                  <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center relative">
                    <Smartphone className="w-8 h-8" />
                    <Bluetooth className="w-4 h-4 absolute -bottom-1 -right-1 bg-indigo-700 text-white rounded-full p-0.5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Step 1: Detect Lecturer&apos;s Phone Bluetooth</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      Scan for <strong className="text-slate-700">{activeSession?.lecturerPhoneName || "Dr. Pendelton's Pixel 8 Pro"}</strong> broadcasting as a portable BLE classroom beacon in {activeSession?.room || 'Lecture Theatre 4B'}.
                    </p>
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-[11px] text-indigo-800 font-mono">
                      <span>Target: {activeSession?.advertisingLocalName || 'SMAP-CS301-8492'}</span>
                      <span>•</span>
                      <span>{isWebBluetoothSupported() ? 'Web Bluetooth Ready' : 'RF Fallback Mode'}</span>
                    </div>
                  </div>

                  {/* Signal Strength Simulation Slider */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700">Phone-to-Phone RSSI Distance Gate:</span>
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
                      <span>-45 dBm (Lecturer Podium)</span>
                    </div>
                  </div>

                  {/* BLE Connected Time Throughout Lesson Slider */}
                  <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 text-left space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-indigo-950 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        BLE Connected Time Throughout Lesson:
                      </span>
                      <span className="font-mono font-bold text-indigo-700">
                        {simulatedRssi >= (activeSession?.rssiThreshold ?? -78)
                          ? `${Math.min(lessonDurationMinutes, simulatedBleMinutes)} / ${lessonDurationMinutes} min (${Math.round(
                              (Math.min(lessonDurationMinutes, simulatedBleMinutes) / lessonDurationMinutes) * 100
                            )}%)`
                          : `0 / ${lessonDurationMinutes} min (Out of range)`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={lessonDurationMinutes}
                      value={Math.min(lessonDurationMinutes, simulatedBleMinutes)}
                      onChange={(e) => setSimulatedBleMinutes(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>0 min (Disconnected)</span>
                      <span className="text-amber-700 font-semibold">
                        {Math.round(lessonDurationMinutes * 0.75)} min (75% Required)
                      </span>
                      <span className="text-emerald-700 font-semibold">{lessonDurationMinutes} min (Full Lesson)</span>
                    </div>
                    <p className="text-[11px] text-indigo-900/80 pt-1 border-t border-indigo-200/70">
                      <strong>Scoring Formula:</strong> Attendance % = <strong>70% BLE Connected Time</strong> +{' '}
                      <strong>30% Real Face Detection</strong> (0% if no real face or outside classroom BLE range).
                    </p>
                  </div>

                  <button
                    onClick={handleStartBleScan}
                    className="w-full py-3 px-6 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Bluetooth className="w-4 h-4" />
                    <span>Scan Lecturer&apos;s Phone Bluetooth</span>
                  </button>
                </div>
              )}

              {/* Step 1 in progress: BLE Scanning */}
              {step === 'ble_scan' && (
                <div className="max-w-md mx-auto text-center py-10 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 border-2 border-indigo-400 animate-ping mx-auto flex items-center justify-center">
                    <Bluetooth className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Scanning for {activeSession?.lecturerPhoneName || "Lecturer's Phone"}...
                  </h4>
                  <p className="text-xs text-slate-500">
                    Listening for {activeSession?.advertisingLocalName || 'SMAP-CS301'} ({activeSession?.beaconUuid || '4F7A-SMAP-BEACON-CS301'})
                  </p>
                </div>
              )}

              {/* Step 2: Face Liveness Scanner */}
              {step === 'face_scan' && (
                <div className="max-w-md mx-auto space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold text-emerald-950 block truncate">
                          Lecturer Phone Detected: {bleEvidence?.lecturerPhoneName || "Dr. Pendelton's Pixel 8 Pro"}
                        </span>
                        {bleScanNote && (
                          <span className="text-[10px] text-emerald-700 block truncate">{bleScanNote}</span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-emerald-700 text-[11px] shrink-0">
                      {bleEvidence?.rssi} dBm (~{bleEvidence?.estimatedDistanceMeters}m)
                    </span>
                  </div>

                  <WebCamScanner
                    studentName={student.name}
                    passportPhotoUrl={studentPassportUrl}
                    simulatedMatchScore={96.8}
                    simulatedLivenessPass={true}
                    autoScan={true}
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
              {step === 'result' && latestRecord && (() => {
                const breakdown = calculateSessionAttendancePercentage(
                  latestRecord.bleEvidence,
                  latestRecord.faceEvidence,
                  activeSession?.lessonDurationMinutes ?? 60
                );
                const finalPct = latestRecord.attendancePercentage ?? breakdown.attendancePercentage;

                return (
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
                        {latestRecord.decision.status === 'VERIFIED_PRESENT' && <CheckCircle2 className="w-8 h-8" />}
                        {latestRecord.decision.status === 'FLAGGED_REVIEW' && <AlertTriangle className="w-8 h-8" />}
                        {(latestRecord.decision.status === 'REJECTED_ABSENT' ||
                          latestRecord.decision.status === 'LATE') && <XCircle className="w-8 h-8" />}
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

                    {/* Calculated Attendance % Banner */}
                    <div className="p-4 rounded-xl bg-white border border-indigo-200 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block">
                          Calculated Session Attendance %
                        </span>
                        <span className="text-[11px] text-slate-500">{breakdown.summary}</span>
                      </div>
                      <span
                        className={`text-2xl font-extrabold font-mono shrink-0 ml-3 ${
                          finalPct >= 75 ? 'text-emerald-600' : finalPct >= 50 ? 'text-amber-600' : 'text-rose-600'
                        }`}
                      >
                        {finalPct}%
                      </span>
                    </div>

                    {/* Passport vs Live Scanned Face Comparison */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <img
                            src={latestRecord.faceEvidence.passportPhotoUrl || studentPassportUrl}
                            alt="Student Passport"
                            className="w-12 h-14 rounded-lg object-cover border border-indigo-200 bg-slate-100"
                          />
                          <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">Passport</span>
                        </div>
                        <span
                          className={`text-xs font-extrabold ${
                            latestRecord.faceEvidence.passportMatched !== false ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {latestRecord.faceEvidence.passportMatched !== false ? '≈' : '≠'}
                        </span>
                        {latestRecord.faceEvidence.scannedFacePhotoUrl ? (
                          <div className="text-center">
                            <img
                              src={latestRecord.faceEvidence.scannedFacePhotoUrl}
                              alt="Scanned Live Face"
                              className="w-12 h-14 rounded-lg object-cover border border-emerald-300 transform -scale-x-100 bg-slate-100"
                            />
                            <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">Scanned</span>
                          </div>
                        ) : (
                          <div className="w-12 h-14 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400">
                            Live
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-bold text-slate-800 block">
                          Passport Verification
                        </span>
                        <span
                          className={`text-xs font-mono font-bold ${
                            latestRecord.faceEvidence.passportMatched !== false ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {latestRecord.faceEvidence.passportMatched !== false
                            ? `Matched (${latestRecord.faceEvidence.passportMatchScore ?? latestRecord.faceEvidence.matchScore}%)`
                            : `Mismatch (${latestRecord.faceEvidence.passportMatchScore ?? latestRecord.faceEvidence.matchScore}%)`}
                        </span>
                      </div>
                    </div>

                    {/* Forensic Evidence Breakdown */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs">
                      <div className="flex justify-between pb-2 border-b border-slate-100">
                        <span className="text-slate-500">Course:</span>
                        <strong className="text-slate-900">{latestRecord.courseCode} — {latestRecord.courseTitle}</strong>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">Lecturer Phone Beacon:</span>
                        <span className="font-semibold text-slate-800">
                          {latestRecord.bleEvidence.lecturerPhoneName || 'Lecturer Smartphone'}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">
                            ({latestRecord.bleEvidence.scanMethod === 'web_bluetooth' ? 'Web Bluetooth' : 'RF Calibration'})
                          </span>
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">BLE Connected Time (Lesson):</span>
                        <span
                          className={`font-mono font-bold ${
                            breakdown.bleTimePercentage >= 75
                              ? 'text-emerald-700'
                              : breakdown.bleTimePercentage >= 50
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {breakdown.bleConnectedMinutes}/{breakdown.lessonDurationMinutes} min ({breakdown.bleTimePercentage}%)
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">BLE Radio Signal:</span>
                        <span className="font-mono text-emerald-700 font-bold">
                          {latestRecord.bleEvidence.rssi} dBm (Est. {latestRecord.bleEvidence.estimatedDistanceMeters}m)
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">Real Face &amp; Passport Check:</span>
                        <span
                          className={`font-mono font-bold ${
                            latestRecord.faceEvidence.faceDetected &&
                            latestRecord.faceEvidence.livenessPassed &&
                            latestRecord.faceEvidence.passportMatched !== false
                              ? 'text-indigo-700'
                              : 'text-rose-600'
                          }`}
                        >
                          {!latestRecord.faceEvidence.faceDetected
                            ? 'No Real Face Detected'
                            : latestRecord.faceEvidence.passportMatched === false
                            ? `Passport Mismatch (${latestRecord.faceEvidence.passportMatchScore ?? latestRecord.faceEvidence.matchScore}%)`
                            : `${latestRecord.faceEvidence.matchScore}% (Liveness: ${
                                latestRecord.faceEvidence.livenessPassed ? 'Passed' : 'Failed'
                              })`}
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
                );
              })()}
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
                  Enter the 6-digit dynamic code currently projected on the classroom screen to launch automatic face verification.
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
                  <th className="px-5 py-3">Course</th>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">BLE Connected Time</th>
                  <th className="px-5 py-3">Real Face Check</th>
                  <th className="px-5 py-3">Attendance %</th>
                  <th className="px-5 py-3">Decision</th>
                  <th className="px-5 py-3">Audit Token</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myRecords.map((r) => {
                  const pctBreakdown = calculateSessionAttendancePercentage(r.bleEvidence, r.faceEvidence);
                  const pct = r.attendancePercentage ?? pctBreakdown.attendancePercentage;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        {r.courseCode}
                        <span className="block text-[11px] font-normal text-slate-500">{r.courseTitle}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-600 font-mono text-[11px]">{r.timestamp}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`font-mono font-bold ${
                            pctBreakdown.bleTimePercentage >= 75
                              ? 'text-emerald-700'
                              : pctBreakdown.bleTimePercentage >= 50
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {pctBreakdown.bleConnectedMinutes}/{pctBreakdown.lessonDurationMinutes} min ({pctBreakdown.bleTimePercentage}%)
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {r.bleEvidence.rssi} dBm • {r.bleEvidence.lecturerPhoneName || 'Phone BLE'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono font-bold text-indigo-700">{r.faceEvidence.matchScore}%</span>
                        <span
                          className={`text-[10px] block ${
                            r.faceEvidence.faceDetected &&
                            r.faceEvidence.livenessPassed &&
                            r.faceEvidence.passportMatched !== false
                              ? 'text-emerald-600'
                              : 'text-rose-600 font-semibold'
                          }`}
                        >
                          {!r.faceEvidence.faceDetected
                            ? 'No Real Face'
                            : r.faceEvidence.passportMatched === false
                            ? 'Passport Mismatch'
                            : r.faceEvidence.livenessPassed
                            ? 'Passport & Liveness: Pass'
                            : 'Liveness: Fail'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`font-mono font-extrabold text-sm ${
                            pct >= 75 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'
                          }`}
                        >
                          {pct}%
                        </span>
                      </td>
                      <td className="px-5 py-3">
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
                      <td className="px-5 py-3 font-mono text-[10px] text-slate-500">
                        {r.verificationToken.substring(0, 16)}...
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PLATFORM-STYLE USER PROFILE & BIOMETRIC PHOTO */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Profile Cover & Identity Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="h-28 bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 relative">
              <div className="absolute top-4 right-5 flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-bold backdrop-blur-xs ${
                    isCustomPassportPhoto(student.passportPhotoUrl)
                      ? 'bg-emerald-500/90 text-white'
                      : 'bg-white/20 text-white border border-white/30'
                  }`}
                >
                  {isCustomPassportPhoto(student.passportPhotoUrl)
                    ? '✓ Verified Profile Photo Active'
                    : 'Default Avatar Active'}
                </span>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-5">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  {/* Circular Profile Picture with Quick Upload Trigger */}
                  <div className="relative w-24 h-24 shrink-0">
                    <img
                      src={studentPassportUrl}
                      alt={student.name}
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg bg-slate-100"
                    />
                    <label
                      title="Change profile / passport photo"
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-indigo-700 hover:bg-indigo-800 text-white flex items-center justify-center shadow-md border-2 border-white cursor-pointer transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePassportFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-extrabold text-slate-900">{student.name}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {student.regNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {student.bio || `${student.department} • Year ${student.year} Student`}
                    </p>
                  </div>
                </div>

                {/* Standard Profile Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {!isEditingProfile ? (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileSavedNotice(false);
                        setIsEditingProfile(true);
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Profile</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      stopPassportCamera();
                      setActiveTab('checkin');
                      setStep('ready');
                    }}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Go to Check-In</span>
                  </button>
                </div>
              </div>

              {/* Profile Quick Stats Row */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-center sm:text-left">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Attendance Score
                  </span>
                  <span className="text-lg font-extrabold text-slate-900">{overallPercentage}%</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Verified Lectures
                  </span>
                  <span className="text-lg font-extrabold text-indigo-700">{verifiedCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Enrolled Courses
                  </span>
                  <span className="text-lg font-extrabold text-slate-900">{courses.length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Account & Personal Details (Edit or View) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900">Personal &amp; Academic Information</h4>
                  <p className="text-xs text-slate-500">
                    Manage your account details, contact info, and bound mobile device.
                  </p>
                </div>
                {profileSavedNotice && (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                    ✓ Changes Saved
                  </span>
                )}
              </div>

              {isEditingProfile ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const cleanName = profileName.trim();
                    if (!cleanName) return;
                    onUpdateStudentProfile({
                      ...student,
                      name: cleanName,
                      email: profileEmail.trim() || undefined,
                      phone: profilePhone.trim() || undefined,
                      bio: profileBio.trim() || undefined,
                      department: profileDepartment.trim() || student.department,
                      year: profileYear,
                      registeredDeviceId: profileDeviceId.trim().toUpperCase() || student.registeredDeviceId,
                    });
                    setIsEditingProfile(false);
                    setProfileSavedNotice(true);
                  }}
                  className="space-y-4 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Admission Number (Verified)</label>
                      <input
                        type="text"
                        disabled
                        value={student.regNumber}
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                      <input
                        type="email"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        placeholder="student@smap.edu"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="+254 700 000 000"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Department</label>
                      <input
                        type="text"
                        value={profileDepartment}
                        onChange={(e) => setProfileDepartment(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-indigo-600"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Year</label>
                        <select
                          value={profileYear}
                          onChange={(e) => setProfileYear(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-indigo-600"
                        >
                          <option value={1}>Year 1</option>
                          <option value={2}>Year 2</option>
                          <option value={3}>Year 3</option>
                          <option value={4}>Year 4</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Device ID</label>
                        <input
                          type="text"
                          value={profileDeviceId}
                          onChange={(e) => setProfileDeviceId(e.target.value.toUpperCase())}
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-900 focus:outline-indigo-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Bio / Academic Headline</label>
                    <input
                      type="text"
                      value={profileBio}
                      onChange={(e) => setProfileBio(e.target.value)}
                      placeholder="e.g. BSc Computer Science • Systems & Security"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-indigo-600"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Profile</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Full Name
                    </span>
                    <strong className="text-sm text-slate-900 mt-0.5 block">{student.name}</strong>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Admission Number
                    </span>
                    <code className="font-mono font-bold text-indigo-700 text-sm mt-0.5 block">{student.regNumber}</code>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email Address
                    </span>
                    <span className="font-medium text-slate-800 mt-0.5 block">
                      {student.email || 'Not set — click Edit Profile'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone Number
                    </span>
                    <span className="font-medium text-slate-800 mt-0.5 block">
                      {student.phone || 'Not set — click Edit Profile'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Department &amp; Year
                    </span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {student.department} • Year {student.year}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Registered Device ID
                    </span>
                    <code className="font-mono text-slate-700 mt-0.5 block">{student.registeredDeviceId}</code>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Profile Photo / Passport Verification Management */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h4 className="text-base font-bold text-slate-900">Profile &amp; Passport Photo</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your profile photo also acts as your official biometric passport during live classroom face scans.
                </p>
              </div>

              {passportError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{passportError}</span>
                </div>
              )}

              <div className="space-y-2.5">
                <label className="w-full py-2.5 px-4 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Upload Profile Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePassportFileUpload}
                    className="hidden"
                  />
                </label>

                {!passportCameraActive ? (
                  <button
                    type="button"
                    onClick={handleStartPassportCamera}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Profile Photo via Camera</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopPassportCamera}
                    className="w-full py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Close Camera</span>
                  </button>
                )}

                {isCustomPassportPhoto(student.passportPhotoUrl) && (
                  <button
                    type="button"
                    onClick={() => onUpdateStudentPassport(student.regNumber, undefined)}
                    className="w-full py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Custom Photo</span>
                  </button>
                )}
              </div>

              {passportCameraActive && (
                <div className="bg-slate-950 rounded-2xl p-4 space-y-3 border border-slate-800">
                  <div className="relative aspect-4/3 max-w-sm mx-auto rounded-xl overflow-hidden bg-black">
                    <video
                      ref={passportVideoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full border-2 border-dashed border-indigo-400" />
                    </div>
                  </div>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleCapturePassportFromCamera}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capture &amp; Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopPassportCamera}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Live Attendance Face Check
                </span>
                <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                  Every classroom face scan compares your live camera frame against this profile photograph automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
