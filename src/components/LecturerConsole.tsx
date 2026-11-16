import React, { useState, useEffect, useRef } from 'react';
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
  ShieldAlert,
  Bluetooth,
  Smartphone,
  UserPlus,
  Upload,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  Sliders,
  FileText,
  Image as ImageIcon,
  Trash2,
  Download
} from 'lucide-react';
import {
  Course,
  Student,
  AttendanceRecord,
  LectureSession,
  DecisionStatus,
  LecturerAccount,
  UploadedStudentList,
} from '../types/attendance';
import { QRCodeDisplay } from './QRCodeDisplay';
import { AuditLedgerView } from './AuditLedgerView';
import { DecisionSandbox } from './DecisionSandbox';
import {
  pairLecturerPhoneBluetooth,
  buildAdvertisingLocalName,
  isWebBluetoothSupported,
  rssiToDistanceMeters,
} from '../services/bleService';
import { calculateSessionAttendancePercentage } from '../services/attendanceCalculator';
import {
  getStudentPassportUrl,
  isCustomPassportPhoto,
  processPassportFileToDataUrl,
} from '../services/passportMatchService';
import {
  buildStudentsFromRosterEntries,
  formatFileSize,
  isImageFile,
  isTextParsableDocument,
  parseStudentRosterText,
  readStudentListFileAsDataUrl,
} from '../services/studentListUploadService';

interface LecturerConsoleProps {
  lecturer: LecturerAccount | null;
  lecturers: LecturerAccount[];
  onLoginLecturer: (lecturer: LecturerAccount) => void;
  onLogoutLecturer: () => void;
  onRegisterLecturer: (
    lecturer: LecturerAccount,
    newCourse?: Course
  ) => { ok: boolean; error?: string; lecturer?: LecturerAccount };
  onUpdateLecturerAccount: (
    lecturer: LecturerAccount,
    newCourse?: Course
  ) => { ok: boolean; error?: string };
  courses: Course[];
  students: Student[];
  records: AttendanceRecord[];
  activeSession: LectureSession | null;
  onStartSession: (session: LectureSession) => void;
  onEndSession: () => void;
  onAddManualRecord: (record: AttendanceRecord) => void;
  onRegisterStudent: (student: Student) => { ok: boolean; error?: string };
  onUpdateStudentPassport?: (studentReg: string, passportPhotoUrl: string) => void;
  uploadedStudentLists: UploadedStudentList[];
  onUploadStudentList: (
    listItem: UploadedStudentList,
    importedStudents: Student[]
  ) => { addedCount: number; skippedCount: number };
  onDeleteStudentList: (listId: string) => void;
}

export const LecturerConsole: React.FC<LecturerConsoleProps> = ({
  lecturer,
  lecturers,
  onLoginLecturer,
  onLogoutLecturer,
  onRegisterLecturer,
  onUpdateLecturerAccount,
  courses,
  students,
  records,
  activeSession,
  onStartSession,
  onEndSession,
  onAddManualRecord,
  onRegisterStudent,
  onUpdateStudentPassport,
  uploadedStudentLists,
  onUploadStudentList,
  onDeleteStudentList,
}) => {
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(courses[0].code);
  const [roomInput, setRoomInput] = useState<string>(courses[0].room);
  const [rssiThresholdInput, setRssiThresholdInput] = useState<number>(-78);
  const [txPowerInput, setTxPowerInput] = useState<number>(-59);
  const [lessonDurationMinutes, setLessonDurationMinutes] = useState<number>(60);

  // Lecturer's Phone Bluetooth Beacon State
  const [lecturerPhoneName, setLecturerPhoneName] = useState<string>("Dr. Pendelton's Pixel 8 Pro");
  const [lecturerBluetoothId, setLecturerBluetoothId] = useState<string>('BT-LEC-A4:83:E7:2B:91:04');
  const [advertisingIntervalMs, setAdvertisingIntervalMs] = useState<number>(100);
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'pairing' | 'paired' | 'fallback'>('idle');
  const [pairingNote, setPairingNote] = useState<string | null>(null);

  // Dynamic QR Code & BLE Local Name Rotation Timer
  const [qrCounter, setQrCounter] = useState(15);
  const [dynamicToken, setDynamicToken] = useState(activeSession?.otpCode || '849201');
  const [showProjectorModal, setShowProjectorModal] = useState(false);

  // Lecturer Login & Registration Form State
  const [authTab, setAuthTab] = useState<'signin' | 'register'>('signin');
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Lecturer Self-Registration / Setup Credentials State
  const [setupName, setSetupName] = useState<string>('');
  const [setupDept, setSetupDept] = useState<string>('Computer Science');
  const [setupCourseMode, setSetupCourseMode] = useState<'new' | 'existing'>('new');
  const [setupExistingCourse, setSetupExistingCourse] = useState<string>(courses[0]?.code || 'CS301');
  const [setupCourseCode, setSetupCourseCode] = useState<string>('');
  const [setupCourseTitle, setSetupCourseTitle] = useState<string>('');
  const [setupRoom, setSetupRoom] = useState<string>('Lecture Theatre 1A');
  const [setupUsername, setSetupUsername] = useState<string>('');
  const [setupPassword, setSetupPassword] = useState<string>('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState<string>('');
  const [showSetupPassword, setShowSetupPassword] = useState<boolean>(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Signed-in Lecturer Credentials & Unit Modal
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Admin's Secret Portal Modal State
  const [showManualModal, setShowManualModal] = useState(false);
  const [adminPortalTab, setAdminPortalTab] = useState<'override' | 'ledger' | 'sandbox'>('override');
  const [manualStudentReg, setManualStudentReg] = useState(students[0]?.regNumber || '');
  const [manualDecision, setManualDecision] = useState<DecisionStatus>('VERIFIED_PRESENT');
  const [manualReason, setManualReason] = useState('Student phone battery depleted; verified in room by lecturer');

  // Student Registration & Enrollment Modal
  const [showRegistryModal, setShowRegistryModal] = useState(false);
  const [regName, setRegName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [regDepartment, setRegDepartment] = useState('Computer Science');
  const [regYear, setRegYear] = useState<number>(3);
  const [regDeviceId, setRegDeviceId] = useState(`DEV-MOBILE-${Math.floor(1000 + Math.random() * 9000)}`);
  const [regPassportUrl, setRegPassportUrl] = useState<string | undefined>(undefined);
  const [regError, setRegError] = useState<string | null>(null);

  // Student List Photo / Document Upload Modal State
  const [showListUploadModal, setShowListUploadModal] = useState(false);
  const [listUploadCourse, setListUploadCourse] = useState<string>(courses[0]?.code || 'CS301');
  const [listUploadNotes, setListUploadNotes] = useState<string>('');
  const [listUploadError, setListUploadError] = useState<string | null>(null);
  const [listUploadNotice, setListUploadNotice] = useState<string | null>(null);
  const [isUploadingList, setIsUploadingList] = useState<boolean>(false);
  const [previewListItem, setPreviewListItem] = useState<UploadedStudentList | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddReg, setQuickAddReg] = useState('');
  const [quickAddDept, setQuickAddDept] = useState('Computer Science');
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  const lastSyncedLecturerIdRef = useRef<string | null>(null);
  const preferredCourseCodeRef = useRef<string | null>(null);

  // Sync lecturer defaults once per sign-in
  useEffect(() => {
    if (!lecturer) {
      lastSyncedLecturerIdRef.current = null;
      return;
    }
    if (lastSyncedLecturerIdRef.current === lecturer.id) return;
    lastSyncedLecturerIdRef.current = lecturer.id;

    if (!activeSession && pairingStatus !== 'paired') {
      setLecturerPhoneName(lecturer.phoneName);
      setLecturerBluetoothId(lecturer.bluetoothId);
    }

    const preferredCode = preferredCourseCodeRef.current;
    preferredCourseCodeRef.current = null;
    const matchingCourse =
      (preferredCode ? courses.find((c) => c.code === preferredCode) : undefined) ||
      courses.find((c) => lecturer.courseCodes?.includes(c.code)) ||
      courses.find((c) => c.lecturerName === lecturer.name);

    if (matchingCourse && !activeSession) {
      setSelectedCourseCode(matchingCourse.code);
      setRoomInput(matchingCourse.room);
    }
  }, [lecturer, courses, activeSession, pairingStatus]);

  const handleLecturerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const rawQuery = loginIdentifier.trim();
    const idQuery = rawQuery.toLowerCase();
    if (!idQuery || !loginPassword) {
      setLoginError('Enter your Name, Course/Unit, Username, or Staff ID along with your Password.');
      return;
    }

    // Match by username, staff ID, lecturer name, or course/unit code/title
    const matchingCourses = courses.filter(
      (c) =>
        c.code.toLowerCase() === idQuery ||
        c.title.toLowerCase() === idQuery ||
        c.title.toLowerCase().includes(idQuery)
    );

    const candidates = lecturers.filter((l) => {
      if (l.username.toLowerCase() === idQuery) return true;
      if (l.staffId.toLowerCase() === idQuery) return true;
      if (l.name.toLowerCase() === idQuery) return true;
      if (idQuery.length >= 3 && l.name.toLowerCase().includes(idQuery)) return true;
      if (l.courseCodes?.some((code) => code.toLowerCase() === idQuery)) return true;
      if (matchingCourses.some((c) => c.lecturerName.toLowerCase() === l.name.toLowerCase())) return true;
      return false;
    });

    const matched = candidates.find((l) => l.password === loginPassword);

    if (!matched) {
      setLoginError(
        candidates.length > 0
          ? 'Incorrect password for that lecturer / unit. Please check your password and try again.'
          : 'No lecturer found matching that Name, Course/Unit, Username, or Staff ID. You can register under "Set Up / Register".'
      );
      return;
    }

    // If they signed in by specifying a course/unit code, auto-select it
    const directCourse = courses.find(
      (c) => c.code.toLowerCase() === idQuery || c.title.toLowerCase() === idQuery
    );
    if (directCourse) {
      preferredCourseCodeRef.current = directCourse.code;
    }

    setLoginIdentifier('');
    setLoginPassword('');
    setLoginError(null);
    onLoginLecturer(matched);
  };

  const handleLecturerRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);

    const cleanName = setupName.trim();
    const cleanDept = setupDept.trim() || 'Computer Science';
    const cleanUsername = setupUsername.trim();

    if (!cleanName || !cleanUsername || !setupPassword) {
      setSetupError('Please enter your Name, Username, and Password.');
      return;
    }
    if (setupPassword.length < 6) {
      setSetupError('Password must be at least 6 characters long.');
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setSetupError('Password and Confirm Password do not match.');
      return;
    }

    let courseObj: Course | undefined;
    let assignedCode = setupExistingCourse;

    if (setupCourseMode === 'new') {
      const code = setupCourseCode.trim().toUpperCase();
      const title = setupCourseTitle.trim();
      const room = setupRoom.trim() || 'Lecture Hall 1';
      if (!code || !title) {
        setSetupError('Please enter both a Course / Unit Code and Course / Unit Title.');
        return;
      }
      assignedCode = code;
      courseObj = {
        id: `c-${Date.now()}`,
        code,
        title,
        lecturerName: cleanName,
        room,
        credits: 3,
        totalLectures: 24,
        beaconUuid: `4F7A-SMAP-BEACON-${code.replace(/[^A-Z0-9]/g, '')}`,
        beaconMajor: Math.floor(100 + Math.random() * 800),
        beaconMinor: Math.floor(1 + Math.random() * 20),
      };
    } else {
      const existing = courses.find((c) => c.code === setupExistingCourse);
      if (existing) {
        courseObj = { ...existing, lecturerName: cleanName };
      }
    }

    const shortDept = cleanDept
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 3) || 'FAC';

    const newLecturer: LecturerAccount = {
      id: `lec-${Date.now()}`,
      staffId: `LEC/${shortDept}/${Math.floor(100 + Math.random() * 899)}`,
      username: cleanUsername,
      password: setupPassword,
      name: cleanName,
      title: `Lecturer — ${cleanDept}`,
      department: cleanDept,
      phoneName: `${cleanName}'s Phone`,
      bluetoothId: `BT-LEC-${Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, '0')
          .toUpperCase()
      ).join(':')}`,
      courseCodes: assignedCode ? [assignedCode] : [],
    };

    const result = onRegisterLecturer(newLecturer, courseObj);
    if (!result.ok) {
      setSetupError(result.error || 'Could not create lecturer account.');
      return;
    }

    if (assignedCode && !activeSession) {
      setSelectedCourseCode(assignedCode);
      if (courseObj) setRoomInput(courseObj.room);
    }

    setSetupName('');
    setSetupCourseCode('');
    setSetupCourseTitle('');
    setSetupUsername('');
    setSetupPassword('');
    setSetupConfirmPassword('');
    setSetupError(null);
  };

  const openAccountSettings = () => {
    if (!lecturer) return;
    const primaryCourse =
      courses.find((c) => lecturer.courseCodes?.includes(c.code)) ||
      courses.find((c) => c.lecturerName === lecturer.name) ||
      courses[0];
    setEditName(lecturer.name);
    setEditUsername(lecturer.username);
    setEditPassword(lecturer.password);
    setEditCourseCode(primaryCourse?.code || '');
    setEditCourseTitle(primaryCourse?.title || '');
    setEditRoom(primaryCourse?.room || 'Lecture Theatre 1A');
    setEditError(null);
    setShowAccountModal(true);
  };

  const handleSaveAccountSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecturer) return;
    setEditError(null);

    const cleanName = editName.trim();
    const cleanUsername = editUsername.trim();
    const cleanCode = editCourseCode.trim().toUpperCase();
    const cleanTitle = editCourseTitle.trim();
    const cleanRoom = editRoom.trim() || 'Lecture Theatre 1A';

    if (!cleanName || !cleanUsername || !editPassword) {
      setEditError('Name, Username, and Password are required.');
      return;
    }
    if (editPassword.length < 6) {
      setEditError('Password must be at least 6 characters.');
      return;
    }

    let courseToSave: Course | undefined;
    const updatedCodes = new Set(lecturer.courseCodes || []);
    if (cleanCode) {
      updatedCodes.add(cleanCode);
      const existingCourse = courses.find((c) => c.code.toUpperCase() === cleanCode);
      courseToSave = existingCourse
        ? {
            ...existingCourse,
            title: cleanTitle || existingCourse.title,
            room: cleanRoom,
            lecturerName: cleanName,
          }
        : {
            id: `c-${Date.now()}`,
            code: cleanCode,
            title: cleanTitle || `${cleanCode} Unit`,
            lecturerName: cleanName,
            room: cleanRoom,
            credits: 3,
            totalLectures: 24,
            beaconUuid: `4F7A-SMAP-BEACON-${cleanCode.replace(/[^A-Z0-9]/g, '')}`,
            beaconMajor: Math.floor(100 + Math.random() * 800),
            beaconMinor: Math.floor(1 + Math.random() * 20),
          };
    }

    const updatedLecturer: LecturerAccount = {
      ...lecturer,
      name: cleanName,
      username: cleanUsername,
      password: editPassword,
      phoneName:
        lecturer.phoneName === `${lecturer.name}'s Phone`
          ? `${cleanName}'s Phone`
          : lecturer.phoneName,
      courseCodes: Array.from(updatedCodes),
    };

    const res = onUpdateLecturerAccount(updatedLecturer, courseToSave);
    if (!res.ok) {
      setEditError(res.error || 'Could not update credentials.');
      return;
    }

    if (cleanCode && !activeSession) {
      setSelectedCourseCode(cleanCode);
      setRoomInput(cleanRoom);
    }
    setShowAccountModal(false);
  };

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

  const handlePairPhoneBluetooth = async () => {
    setPairingStatus('pairing');
    setPairingNote(null);
    const result = await pairLecturerPhoneBluetooth();
    if (result.success && result.phone) {
      setLecturerPhoneName(result.phone.deviceName);
      setLecturerBluetoothId(result.phone.bluetoothId);
      setPairingStatus('paired');
      setPairingNote(`Bound phone Bluetooth radio: ${result.phone.deviceName} (${result.phone.bluetoothId})`);
    } else {
      setPairingStatus('fallback');
      setPairingNote(result.error || 'Using custom phone Bluetooth beacon profile.');
    }
  };

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
      beaconSource: 'lecturer_phone',
      lecturerPhoneName: lecturerPhoneName.trim() || `${course.lecturerName}'s Phone`,
      lecturerBluetoothId: lecturerBluetoothId.trim() || 'BT-LEC-00:1A:7D:DA:71:13',
      advertisingLocalName: buildAdvertisingLocalName(course.code, initialOtp),
      advertisingIntervalMs,
      lessonDurationMinutes,
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
    const duration = Math.max(1, activeSession?.lessonDurationMinutes ?? lessonDurationMinutes);
    const connectedMins =
      manualDecision === 'VERIFIED_PRESENT'
        ? duration
        : manualDecision === 'FLAGGED_REVIEW'
        ? Math.round(duration * 0.65)
        : Math.round(duration * 0.5);

    const bleEv = {
      beaconUuid: course.beaconUuid,
      major: course.beaconMajor,
      minor: course.beaconMinor,
      rssi: -60,
      estimatedDistanceMeters: 1.5,
      isWithinClassroomRange: true,
      timestamp: new Date().toLocaleTimeString(),
      beaconSource: 'lecturer_phone' as const,
      lecturerPhoneName: activeSession?.lecturerPhoneName || lecturerPhoneName,
      lecturerBluetoothId: activeSession?.lecturerBluetoothId || lecturerBluetoothId,
      bleConnectedMinutes: connectedMins,
      lessonDurationMinutes: duration,
      bleConnectionPercentage: Math.round((connectedMins / duration) * 100),
    };

    const faceEv = {
      faceDetected: true,
      matchScore: 100,
      livenessPassed: true,
      livenessChallenge: 'blink' as const,
      lightingQuality: 'good' as const,
      timestamp: new Date().toLocaleTimeString(),
    };

    const breakdown = calculateSessionAttendancePercentage(bleEv, faceEv, duration);

    const manualRecord: AttendanceRecord = {
      id: `MAN-${Date.now()}`,
      sessionId: activeSession ? activeSession.id : `SES-${course.code}`,
      courseCode: course.code,
      courseTitle: course.title,
      studentReg: student.regNumber,
      studentName: student.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      bleEvidence: bleEv,
      faceEvidence: faceEv,
      decision: {
        status: manualDecision,
        ruleMatched: 'R_ADMIN_SECRET_PORTAL_OVERRIDE',
        compositeConfidence: breakdown.attendancePercentage,
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
      attendancePercentage: breakdown.attendancePercentage,
    };

    onAddManualRecord(manualRecord);
    setShowManualModal(false);
  };

  // Handle new student registration
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const cleanName = regName.trim();
    const cleanReg = regNumber.trim().toUpperCase();
    const cleanDept = regDepartment.trim() || 'Computer Science';
    const cleanDev = regDeviceId.trim().toUpperCase() || `DEV-MOBILE-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!cleanName || !cleanReg) {
      setRegError('Both Full Name and Admission Number are required.');
      return;
    }

    const newStudent: Student = {
      id: `s-${Date.now()}`,
      regNumber: cleanReg,
      name: cleanName,
      department: cleanDept,
      year: regYear,
      registeredDeviceId: cleanDev,
      biometricEnrolled: true,
      avatarSeed: cleanName.toLowerCase().replace(/\s+/g, '-'),
      passportPhotoUrl: regPassportUrl,
    };

    const outcome = onRegisterStudent(newStudent);
    if (!outcome.ok) {
      setRegError(outcome.error || 'Could not register student.');
      return;
    }

    setRegName('');
    setRegNumber('');
    setRegPassportUrl(undefined);
    setRegDeviceId(`DEV-MOBILE-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleRegPassportSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRegError(null);
    try {
      const processed = await processPassportFileToDataUrl(file);
      setRegPassportUrl(processed);
    } catch (err: any) {
      setRegError(err?.message || 'Unable to process passport photo.');
    } finally {
      e.target.value = '';
    }
  };

  const handleExistingStudentPassportUpdate = async (
    studentReg: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateStudentPassport) return;
    try {
      const processed = await processPassportFileToDataUrl(file);
      onUpdateStudentPassport(studentReg, processed);
    } catch {
      // ignore invalid image
    } finally {
      e.target.value = '';
    }
  };

  if (!lecturer) {
    return (
      <div className="max-w-xl mx-auto w-full my-4 space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-7 shadow-sm space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-700 text-white flex items-center justify-center shadow-md shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Lecturer Console Access</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sign in with your name, course/unit, username, or register to set your username, password, and unit.
              </p>
            </div>
          </div>

          {/* Auth Mode Tabs */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthTab('signin');
                setLoginError(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                authTab === 'signin'
                  ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('register');
                setSetupError(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                authTab === 'register'
                  ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Set Up / Register
            </button>
          </div>

          {authTab === 'signin' ? (
            <>
              <form onSubmit={handleLecturerLogin} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1.5">
                    Lecturer Name, Course / Unit, Username, or Staff ID
                  </label>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. Dr. Arthur Pendelton, CS301, or apendelton"
                    autoComplete="username"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-indigo-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Sign In to Lecturer Console</span>
                </button>
              </form>

              {/* Authorized Faculty Accounts */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-600 uppercase tracking-wider">
                    Registered Faculty &amp; Units
                  </span>
                  <span className="font-mono text-slate-400">Default Pass: Password123!</span>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto">
                  {lecturers.map((lec) => {
                    const lecCourses = courses
                      .filter(
                        (c) =>
                          lec.courseCodes?.includes(c.code) ||
                          c.lecturerName.toLowerCase() === lec.name.toLowerCase()
                      )
                      .map((c) => c.code);
                    return (
                      <button
                        key={lec.id}
                        type="button"
                        onClick={() => {
                          setLoginIdentifier(lec.username);
                          setLoginPassword(lec.password);
                          setLoginError(null);
                        }}
                        className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">{lec.name}</span>
                          <span className="text-[11px] text-slate-500">
                            User: <code className="font-mono font-semibold text-indigo-700">{lec.username}</code>
                            {lecCourses.length > 0 && (
                              <> • Units: <strong className="text-slate-700">{lecCourses.join(', ')}</strong></>
                            )}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-indigo-700 bg-white px-2 py-1 rounded-lg border border-indigo-100 shrink-0">
                          {lec.staffId}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <form onSubmit={handleLecturerRegisterSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Lecturer Full Name</label>
                  <input
                    type="text"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    placeholder="e.g. Dr. Grace Njeri"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Department</label>
                  <input
                    type="text"
                    value={setupDept}
                    onChange={(e) => setSetupDept(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* Course / Unit Selection or Creation */}
              <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-950">Course / Unit Assignment</span>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-indigo-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSetupCourseMode('new')}
                      className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                        setupCourseMode === 'new' ? 'bg-indigo-700 text-white' : 'text-slate-600'
                      }`}
                    >
                      New Unit
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetupCourseMode('existing')}
                      className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                        setupCourseMode === 'existing' ? 'bg-indigo-700 text-white' : 'text-slate-600'
                      }`}
                    >
                      Existing Unit
                    </button>
                  </div>
                </div>

                {setupCourseMode === 'new' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Unit Code</label>
                      <input
                        type="text"
                        value={setupCourseCode}
                        onChange={(e) => setSetupCourseCode(e.target.value.toUpperCase())}
                        placeholder="e.g. CS402"
                        className="w-full px-2.5 py-2 bg-white border border-indigo-200 rounded-lg font-mono font-bold text-slate-900 focus:outline-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Course / Unit Name</label>
                      <input
                        type="text"
                        value={setupCourseTitle}
                        onChange={(e) => setSetupCourseTitle(e.target.value)}
                        placeholder="e.g. Distributed Systems"
                        className="w-full px-2.5 py-2 bg-white border border-indigo-200 rounded-lg text-slate-900 focus:outline-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Room</label>
                      <input
                        type="text"
                        value={setupRoom}
                        onChange={(e) => setSetupRoom(e.target.value)}
                        placeholder="e.g. Lab 3"
                        className="w-full px-2.5 py-2 bg-white border border-indigo-200 rounded-lg text-slate-900 focus:outline-indigo-600"
                      />
                    </div>
                  </div>
                ) : (
                  <select
                    value={setupExistingCourse}
                    onChange={(e) => setSetupExistingCourse(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg font-semibold text-slate-800 focus:outline-indigo-600"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} — {c.title} ({c.room})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Set Username</label>
                <input
                  type="text"
                  value={setupUsername}
                  onChange={(e) => setSetupUsername(e.target.value)}
                  placeholder="e.g. gnjeri"
                  autoComplete="username"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-medium text-slate-900 focus:outline-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Set Password</label>
                  <div className="relative">
                    <input
                      type={showSetupPassword ? 'text' : 'password'}
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      autoComplete="new-password"
                      className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1.5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showSetupPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Confirm Password</label>
                  <input
                    type={showSetupPassword ? 'text' : 'password'}
                    value={setupConfirmPassword}
                    onChange={(e) => setSetupConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-indigo-600"
                  />
                </div>
              </div>

              {setupError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{setupError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Save Credentials &amp; Enter Console</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

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
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">Lecturer Phone Bluetooth Beacon</h2>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full flex items-center gap-1.5 ${
                  activeSession
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Bluetooth className="w-3 h-3" />
                {activeSession ? `Broadcasting from ${activeSession.lecturerPhoneName}` : 'Phone Beacon Standby'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Signed in as <strong className="text-slate-700">{lecturer.name}</strong> (<span className="font-mono">{lecturer.staffId}</span>) • {lecturer.department}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={openAccountSettings}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-indigo-600" />
            <span>Credentials &amp; Unit</span>
          </button>
          <button
            onClick={() => setShowRegistryModal(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-indigo-600" />
            <span>Student Registry ({students.length})</span>
          </button>
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
          <button
            onClick={onLogoutLecturer}
            title="Sign out of Lecturer Console"
            className="px-3.5 py-2.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold text-xs rounded-xl border border-slate-200 hover:border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
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
                      if (c) {
                        setRoomInput(c.room);
                        if (pairingStatus !== 'paired') {
                          setLecturerPhoneName(`${c.lecturerName}'s Phone`);
                        }
                      }
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

                {/* Lecturer's Phone Bluetooth Beacon Binding */}
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-indigo-600" />
                      Lecturer Phone Bluetooth Beacon
                    </span>
                    <button
                      type="button"
                      onClick={handlePairPhoneBluetooth}
                      disabled={pairingStatus === 'pairing'}
                      className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Bluetooth className="w-3 h-3" />
                      <span>{pairingStatus === 'pairing' ? 'Binding...' : 'Pair Phone BT'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Phone Device Name</label>
                      <input
                        type="text"
                        value={lecturerPhoneName}
                        onChange={(e) => setLecturerPhoneName(e.target.value)}
                        placeholder="e.g. Dr. Pendelton's Pixel 8"
                        className="w-full p-2 bg-white border border-indigo-200 rounded-lg font-medium text-slate-800 text-xs focus:outline-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Phone Bluetooth ID</label>
                      <input
                        type="text"
                        value={lecturerBluetoothId}
                        onChange={(e) => setLecturerBluetoothId(e.target.value)}
                        className="w-full p-2 bg-white border border-indigo-200 rounded-lg font-mono text-slate-800 text-[11px] focus:outline-indigo-600"
                      />
                    </div>
                  </div>

                  {pairingNote && (
                    <p className={`text-[11px] ${pairingStatus === 'paired' ? 'text-emerald-700 font-semibold' : 'text-slate-600'}`}>
                      {pairingNote}
                    </p>
                  )}
                  {!pairingNote && (
                    <p className="text-[10px] text-indigo-700/80">
                      {isWebBluetoothSupported()
                        ? 'Web Bluetooth ready: Pair your phone radio or customize the broadcast identifier.'
                        : 'Configure your phone Bluetooth identifier to turn your mobile device into the room beacon.'}
                    </p>
                  )}
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">RSSI Gate</label>
                    <input
                      type="number"
                      value={rssiThresholdInput}
                      onChange={(e) => setRssiThresholdInput(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">~{rssiToDistanceMeters(rssiThresholdInput, txPowerInput)}m radius</span>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Phone TX</label>
                    <input
                      type="number"
                      value={txPowerInput}
                      onChange={(e) => setTxPowerInput(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">-59 dBm @1m</span>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Interval</label>
                    <select
                      value={advertisingIntervalMs}
                      onChange={(e) => setAdvertisingIntervalMs(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    >
                      <option value={100}>100 ms</option>
                      <option value={250}>250 ms</option>
                      <option value={500}>500 ms</option>
                    </select>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">BLE Advert</span>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Lesson Time</label>
                    <select
                      value={lessonDurationMinutes}
                      onChange={(e) => setLessonDurationMinutes(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    >
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                      <option value={90}>90 min</option>
                      <option value={120}>120 min</option>
                    </select>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">BLE Benchmark</span>
                  </div>
                </div>

                <button
                  onClick={handleStart}
                  className="w-full py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>Activate Phone Beacon for {selectedCourseCode}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Phone Bluetooth Beacon Transmitter Card */}
                <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <Bluetooth className="w-4 h-4 text-emerald-600 animate-pulse" />
                      Phone Bluetooth Beacon Active
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-600 text-white font-mono text-[10px] font-bold rounded-full">
                      TX {activeSession.txPower} dBm
                    </span>
                  </div>

                  <div className="bg-white/90 rounded-lg p-2.5 border border-emerald-200/70 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Host Phone:</span>
                      <strong className="text-slate-900">{activeSession.lecturerPhoneName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bluetooth ID:</span>
                      <code className="text-[10px] font-mono text-slate-700">{activeSession.lecturerBluetoothId}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Rotating BLE Name:</span>
                      <code className="text-[11px] font-mono font-bold text-indigo-700">
                        {buildAdvertisingLocalName(activeSession.courseCode, dynamicToken)}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Course & Room:</span>
                    <strong className="text-slate-900">{activeSession.courseCode} ({activeSession.room})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Beacon UUID:</span>
                    <code className="text-[11px] font-mono text-indigo-700">{activeSession.beaconUuid}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Perimeter RSSI Gate:</span>
                    <span className="font-mono text-slate-800">
                      {activeSession.rssiThreshold} dBm (~{rssiToDistanceMeters(activeSession.rssiThreshold, activeSession.txPower)}m)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">BLE Packet &amp; Lesson Window:</span>
                    <span className="font-mono text-slate-800">
                      {activeSession.advertisingIntervalMs}ms • {activeSession.lessonDurationMinutes ?? 60} min lesson
                    </span>
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
                      <th className="px-4 py-3">BLE Connected</th>
                      <th className="px-4 py-3">Real Face</th>
                      <th className="px-4 py-3">Attendance %</th>
                      <th className="px-4 py-3">Risk Assessment</th>
                      <th className="px-4 py-3">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentSessionRecords.map((r) => {
                      const breakdown = calculateSessionAttendancePercentage(
                        r.bleEvidence,
                        r.faceEvidence,
                        activeSession?.lessonDurationMinutes ?? 60
                      );
                      const pct = r.attendancePercentage ?? breakdown.attendancePercentage;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <strong className="text-slate-900 block">{r.studentName}</strong>
                            <span className="font-mono text-[10px] text-slate-500">
                              {r.studentReg} • {r.timestamp}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-mono font-bold ${
                                breakdown.bleTimePercentage >= 75
                                  ? 'text-emerald-700'
                                  : breakdown.bleTimePercentage >= 50
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {breakdown.bleConnectedMinutes}/{breakdown.lessonDurationMinutes}m ({breakdown.bleTimePercentage}%)
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {r.bleEvidence.rssi} dBm (~{r.bleEvidence.estimatedDistanceMeters}m)
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-indigo-700">{r.faceEvidence.matchScore}%</span>
                            <span
                              className={`text-[10px] block ${
                                r.faceEvidence.faceDetected && r.faceEvidence.livenessPassed
                                  ? 'text-emerald-600'
                                  : 'text-rose-600 font-semibold'
                              }`}
                            >
                              {!r.faceEvidence.faceDetected
                                ? 'No Face'
                                : r.faceEvidence.livenessPassed
                                ? 'Liveness: Pass'
                                : 'Liveness: Fail'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-mono font-extrabold text-sm ${
                                pct >= 75 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'
                              }`}
                            >
                              {pct}%
                            </span>
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
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Student Registry & Enrollment + Student List Upload Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Student Registry &amp; Lists ({students.length} Enrolled)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Enroll students manually or upload a photo / document (CSV, TXT, PDF, Word, Excel) of your student list.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setListUploadCourse(activeCourseCode);
                    setListUploadError(null);
                    setListUploadNotice(null);
                    setShowListUploadModal(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Student List</span>
                </button>
                <button
                  onClick={() => setShowRegistryModal(true)}
                  className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register Student</span>
                </button>
              </div>
            </div>

            {uploadedStudentLists.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <span>Uploaded Student List Photos &amp; Documents ({uploadedStudentLists.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setListUploadCourse(activeCourseCode);
                      setShowListUploadModal(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 normal-case font-semibold cursor-pointer"
                  >
                    Manage All
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {uploadedStudentLists.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setPreviewListItem(item)}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 transition-colors flex items-center justify-between gap-2.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.fileKind === 'photo' ? (
                          <img
                            src={item.dataUrl}
                            alt={item.fileName}
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 truncate block">
                            {item.fileName}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {item.courseCode} • {formatFileSize(item.fileSizeBytes)}
                            {item.importedStudentsCount > 0 && ` • +${item.importedStudentsCount} imported`}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-700 shrink-0">View</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                  <p>Scan for lecturer's phone Bluetooth beacon (<strong>{activeSession.lecturerPhoneName}</strong>) or enter the 6-digit session code.</p>
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
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Portal Header & Tabs */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
                  <ShieldAlert className="w-5 h-5 text-indigo-200" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Admin's Secret Portal</h3>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 block">
                    Privileged Override • Faculty Audit Ledger • Rule Engine Sandbox
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setAdminPortalTab('override')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      adminPortalTab === 'override'
                        ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Manual Override</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminPortalTab('ledger')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      adminPortalTab === 'ledger'
                        ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Faculty Audit Ledger</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminPortalTab('sandbox')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      adminPortalTab === 'sandbox'
                        ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Rule Engine Sandbox</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowManualModal(false)}
                  aria-label="Close Admin's Secret Portal"
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Portal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/70">
              {adminPortalTab === 'override' && (
                <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Administrative Attendance Override</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                      Privileged administrative access: Authorize immediate manual attendance verification, override biometric/BLE flags, or grant excused status with signed faculty credentials.
                    </p>
                  </div>

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

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
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
              )}

              {adminPortalTab === 'ledger' && (
                <AuditLedgerView
                  courses={courses}
                  records={records}
                  students={students}
                />
              )}

              {adminPortalTab === 'sandbox' && <DecisionSandbox />}
            </div>
          </div>
        </div>
      )}

      {/* STUDENT REGISTRY & ENROLLMENT MODAL */}
      {showRegistryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow-xs">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Student Registry &amp; Enrollment</h3>
                  <p className="text-[11px] text-slate-500">
                    Register official student admission numbers so authorized students can sign in.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRegistryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Enroll New Student Form */}
            <form onSubmit={handleRegisterSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
              <span className="font-bold text-slate-800 block">Enroll New Student</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Jane Wanjiku"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Admission Number</label>
                  <input
                    type="text"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. STU/2026/0142"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-mono font-semibold text-slate-800 focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Department</label>
                  <input
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-indigo-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Year</label>
                    <select
                      value={regYear}
                      onChange={(e) => setRegYear(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-indigo-600"
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
                      value={regDeviceId}
                      onChange={(e) => setRegDeviceId(e.target.value.toUpperCase())}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800 focus:outline-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Student Passport Photo Upload */}
              <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3">
                  {regPassportUrl ? (
                    <img
                      src={regPassportUrl}
                      alt="Passport Preview"
                      className="w-11 h-13 rounded-lg object-cover border border-indigo-300"
                    />
                  ) : (
                    <div className="w-11 h-13 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400">
                      Photo
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-slate-800 block">Student Passport Photo</span>
                    <span className="text-[10px] text-slate-500">
                      Used to verify scanned faces against the student profile during check-in.
                    </span>
                  </div>
                </div>
                <label className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 cursor-pointer flex items-center gap-1.5 shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{regPassportUrl ? 'Change Photo' : 'Upload Passport'}</span>
                  <input type="file" accept="image/*" onChange={handleRegPassportSelect} className="hidden" />
                </label>
              </div>

              {regError && (
                <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{regError}</span>
                </p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register &amp; Authorize Student</span>
                </button>
              </div>
            </form>

            {/* Enrolled Directory Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Authorized Student Admission Directory</span>
                <span>{students.length} enrolled</span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                    <tr>
                      <th className="px-4 py-2">Passport</th>
                      <th className="px-4 py-2">Admission No.</th>
                      <th className="px-4 py-2">Student Name</th>
                      <th className="px-4 py-2">Department</th>
                      <th className="px-4 py-2">Device ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <img
                              src={getStudentPassportUrl(s)}
                              alt={s.name}
                              className="w-8 h-10 rounded-md object-cover border border-slate-200 bg-slate-100 shrink-0"
                            />
                            {onUpdateStudentPassport && (
                              <label
                                title="Upload or replace student passport photo"
                                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer underline"
                              >
                                {isCustomPassportPhoto(s.passportPhotoUrl) ? 'Update' : 'Upload'}
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleExistingStudentPassportUpdate(s.regNumber, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 font-mono font-bold text-indigo-700">{s.regNumber}</td>
                        <td className="px-4 py-2 font-semibold text-slate-900">{s.name}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {s.department} (Y{s.year})
                        </td>
                        <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{s.registeredDeviceId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LECTURER CREDENTIALS & UNIT SETTINGS MODAL */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow-xs">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Lecturer Credentials &amp; Unit</h3>
                  <p className="text-[11px] text-slate-500">
                    Update your display name, username, password, or assigned course / unit.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccountSettings} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Lecturer Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Username</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-medium text-slate-900 focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1.5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2.5">
                <span className="font-bold text-indigo-950 block">Course / Unit Details</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Unit Code</label>
                    <input
                      type="text"
                      value={editCourseCode}
                      onChange={(e) => setEditCourseCode(e.target.value.toUpperCase())}
                      placeholder="CS301"
                      className="w-full px-2.5 py-2 bg-white border border-indigo-200 rounded-lg font-mono font-bold text-slate-900 focus:outline-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Unit Title</label>
                    <input
                      type="text"
                      value={editCourseTitle}
                      onChange={(e) => setEditCourseTitle(e.target.value)}
                      placeholder="Course Title"
                      className="w-full px-2.5 py-2 bg-white border border-indigo-200 rounded-lg text-slate-900 focus:outline-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Room</label>
                    <input
                      type="text"
                      value={editRoom}
                      onChange={(e) => setEditRoom(e.target.value)}
                      placeholder="Room"
                      className="w-full px-2.5 py-2 bg-white border border-indigo-200 rounded-lg text-slate-900 focus:outline-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  Save Credentials &amp; Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD STUDENT LIST PHOTO / DOCUMENT MODAL */}
      {showListUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Student List (Photo or Document)</h3>
                  <p className="text-[11px] text-slate-500">
                    Upload a photo of a printed/written roster or a document (CSV, TXT, PDF, Word, Excel). CSV/TXT/JSON rosters are auto-enrolled.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowListUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Target Course / Unit</label>
                  <select
                    value={listUploadCourse}
                    onChange={(e) => setListUploadCourse(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-indigo-600"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">List Note (Optional)</label>
                  <input
                    type="text"
                    value={listUploadNotes}
                    onChange={(e) => setListUploadNotes(e.target.value)}
                    placeholder="e.g. Week 2 signed class register"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-indigo-600"
                  />
                </div>
              </div>

              <label className="mt-1 border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-white rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-colors">
                <div className="flex items-center gap-2 text-indigo-700">
                  <ImageIcon className="w-5 h-5" />
                  <FileText className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-900">
                  {isUploadingList ? 'Processing uploaded student list...' : 'Click to Upload Student List Photo or Document'}
                </span>
                <span className="text-[11px] text-slate-500">
                  Photos (JPG, PNG, WebP) or Documents (PDF, CSV, TXT, DOC, DOCX, XLS, XLSX)
                </span>
                <input
                  type="file"
                  disabled={isUploadingList}
                  accept="image/*,.pdf,.csv,.txt,.tsv,.json,.doc,.docx,.xls,.xlsx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setListUploadError(null);
                    setListUploadNotice(null);
                    setIsUploadingList(true);

                    try {
                      const dataUrl = await readStudentListFileAsDataUrl(file);
                      let importedStudents: Student[] = [];
                      if (isTextParsableDocument(file)) {
                        const textContent = await file.text();
                        const parsed = parseStudentRosterText(textContent);
                        importedStudents = buildStudentsFromRosterEntries(parsed);
                      }

                      const newItem: UploadedStudentList = {
                        id: `lst-${Date.now()}`,
                        courseCode: listUploadCourse,
                        uploadedBy: lecturer?.name || 'Lecturer',
                        uploadedAt: new Date().toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                        fileName: file.name,
                        fileKind: isImageFile(file) ? 'photo' : 'document',
                        mimeType: file.type || 'application/octet-stream',
                        fileSizeBytes: file.size,
                        dataUrl,
                        importedStudentsCount: 0,
                        notes: listUploadNotes.trim() || undefined,
                      };

                      const result = onUploadStudentList(newItem, importedStudents);
                      setListUploadNotes('');
                      if (importedStudents.length > 0) {
                        setListUploadNotice(
                          `Uploaded "${file.name}" — enrolled ${result.addedCount} new student(s) (${result.skippedCount} already registered).`
                        );
                      } else {
                        setListUploadNotice(
                          `Saved "${file.name}" (${newItem.fileKind}). Click Preview below to view the sheet and enroll students.`
                        );
                      }
                    } catch (err: any) {
                      setListUploadError(err?.message || 'Could not process the selected file.');
                    } finally {
                      setIsUploadingList(false);
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
              </label>

              {listUploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{listUploadError}</span>
                </div>
              )}

              {listUploadNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{listUploadNotice}</span>
                </div>
              )}
            </div>

            {/* Uploaded Files Repository */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Uploaded Student Lists ({uploadedStudentLists.length})</span>
                <span className="text-[11px] font-normal text-slate-500">Stored for {courses.length} course(s)</span>
              </div>
              {uploadedStudentLists.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No student list photos or documents uploaded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {uploadedStudentLists.map((item) => (
                    <div key={item.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.fileKind === 'photo' ? (
                          <img
                            src={item.dataUrl}
                            alt={item.fileName}
                            className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{item.fileName}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            <span className="font-semibold text-indigo-700">{item.courseCode}</span> • {item.uploadedBy} • {item.uploadedAt} • {formatFileSize(item.fileSizeBytes)}
                          </div>
                          {item.notes && (
                            <div className="text-[10px] text-slate-600 italic truncate">{item.notes}</div>
                          )}
                          {item.importedStudentsCount > 0 && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                              +{item.importedStudentsCount} students enrolled
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewListItem(item)}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg cursor-pointer"
                        >
                          Preview
                        </button>
                        <a
                          href={item.dataUrl}
                          download={item.fileName}
                          title="Download file"
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => onDeleteStudentList(item.id)}
                          title="Delete uploaded list"
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW UPLOADED STUDENT LIST PHOTO / DOCUMENT + QUICK ENROLL MODAL */}
      {previewListItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                  {previewListItem.courseCode} • Uploaded {previewListItem.fileKind}
                </span>
                <h3 className="text-base font-bold text-slate-900">{previewListItem.fileName}</h3>
                <p className="text-[11px] text-slate-500">
                  Uploaded by {previewListItem.uploadedBy} on {previewListItem.uploadedAt} ({formatFileSize(previewListItem.fileSizeBytes)})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewListItem.dataUrl}
                  download={previewListItem.fileName}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setPreviewListItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-50">
              {/* Photo or Document Viewer */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-center min-h-[300px]">
                {previewListItem.fileKind === 'photo' ? (
                  <img
                    src={previewListItem.dataUrl}
                    alt={previewListItem.fileName}
                    className="max-h-[60vh] w-auto rounded-lg object-contain"
                  />
                ) : previewListItem.mimeType === 'application/pdf' ? (
                  <iframe
                    src={previewListItem.dataUrl}
                    title={previewListItem.fileName}
                    className="w-full h-[60vh] rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <FileText className="w-12 h-12 text-indigo-600 mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{previewListItem.fileName}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {previewListItem.importedStudentsCount > 0
                          ? `${previewListItem.importedStudentsCount} student(s) imported into the registry from this document.`
                          : 'Document attached. Download to open in your spreadsheet or word processor.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Enroll Student from Attached Photo / Doc */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs h-fit">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  <span>Enroll Student from This Sheet</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Transcribe any student directly from the uploaded list photo or document into the authorized registry.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setQuickAddError(null);
                    const cleanName = quickAddName.trim();
                    const cleanReg = quickAddReg.trim().toUpperCase();
                    if (!cleanName || !cleanReg) {
                      setQuickAddError('Full Name and Admission Number are required.');
                      return;
                    }
                    const res = onRegisterStudent({
                      id: `s-${Date.now()}`,
                      regNumber: cleanReg,
                      name: cleanName,
                      department: quickAddDept.trim() || 'Computer Science',
                      year: 3,
                      registeredDeviceId: `DEV-SHEET-${Math.floor(1000 + Math.random() * 9000)}`,
                      biometricEnrolled: true,
                      avatarSeed: cleanName.toLowerCase().replace(/\s+/g, '-'),
                    });
                    if (!res.ok) {
                      setQuickAddError(res.error || 'Could not enroll student.');
                      return;
                    }
                    setQuickAddName('');
                    setQuickAddReg('');
                  }}
                  className="space-y-2.5"
                >
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Student Full Name</label>
                    <input
                      type="text"
                      value={quickAddName}
                      onChange={(e) => setQuickAddName(e.target.value)}
                      placeholder="e.g. Samuel Kamau"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Admission Number</label>
                    <input
                      type="text"
                      value={quickAddReg}
                      onChange={(e) => setQuickAddReg(e.target.value.toUpperCase())}
                      placeholder="e.g. STU/2026/0198"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-semibold focus:outline-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Department</label>
                    <input
                      type="text"
                      value={quickAddDept}
                      onChange={(e) => setQuickAddDept(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-indigo-600"
                    />
                  </div>
                  {quickAddError && (
                    <p className="text-[11px] text-rose-600 font-semibold">{quickAddError}</p>
                  )}
                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Add to Authorized Students
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
