import React, { useState, useRef, useEffect } from 'react';
import {
  Radio,
  User,
  Sparkles,
  Lock,
  ChevronDown,
  LogOut,
  Calendar,
  IdCard
} from 'lucide-react';
import {
  Course,
  Student,
  AttendanceRecord,
  LectureSession,
  LecturerAccount,
  UploadedStudentList,
} from './types/attendance';
import {
  INITIAL_COURSES,
  INITIAL_STUDENTS,
  INITIAL_RECORDS,
  INITIAL_ACTIVE_SESSION,
  INITIAL_LECTURERS,
} from './data/mockData';
import { StudentPortal } from './components/StudentPortal';
import { LecturerConsole } from './components/LecturerConsole';
import { getStudentPassportUrl } from './services/passportMatchService';

type MainView = 'student' | 'lecturer';

const STUDENT_REGISTRY_KEY = 'smap_registered_students_v1';
const LECTURER_REGISTRY_KEY = 'smap_registered_lecturers_v1';
const COURSES_REGISTRY_KEY = 'smap_courses_v1';
const STUDENT_LISTS_KEY = 'smap_uploaded_student_lists_v1';

export default function App() {
  const [courses, setCourses] = useState<Course[]>(() => {
    try {
      const saved = localStorage.getItem(COURSES_REGISTRY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_COURSES;
  });
  const [lecturers, setLecturers] = useState<LecturerAccount[]>(() => {
    try {
      const saved = localStorage.getItem(LECTURER_REGISTRY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_LECTURERS;
  });
  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem(STUDENT_REGISTRY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_STUDENTS;
  });
  const [records, setRecords] = useState<AttendanceRecord[]>(INITIAL_RECORDS);
  const [uploadedStudentLists, setUploadedStudentLists] = useState<UploadedStudentList[]>(() => {
    try {
      const saved = localStorage.getItem(STUDENT_LISTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [activeSession, setActiveSession] = useState<LectureSession | null>(INITIAL_ACTIVE_SESSION);
  const [activeView, setActiveView] = useState<MainView>('student');
  const [loggedInStudent, setLoggedInStudent] = useState<Student | null>(null);
  const [loggedInLecturer, setLoggedInLecturer] = useState<LecturerAccount | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [requestedStudentTab, setRequestedStudentTab] = useState<{
    tab: 'overview' | 'checkin' | 'history' | 'profile';
    nonce: number;
  } | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Device checkin history ledger to detect multi-student hardware clashes
  const [recentDeviceCheckins, setRecentDeviceCheckins] = useState<
    { deviceId: string; studentReg: string; timestamp: number }[]
  >([
    { deviceId: 'DEV-IPHONE15-3312', studentReg: 'STU/2023/0018', timestamp: Date.now() - 500000 },
  ]);

  const triggerToast = (msg: string) => {
    setNotificationToast(msg);
    setTimeout(() => {
      setNotificationToast((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Record verified attendance
  const handleRecordAttendance = (record: AttendanceRecord) => {
    setRecords((prev) => [record, ...prev]);

    // Register device check-in history to catch proxy multi-student attempts
    const student = students.find((s) => s.regNumber === record.studentReg);
    const devId = student?.registeredDeviceId || 'DEV-UNKNOWN';
    setRecentDeviceCheckins((prev) => [
      { deviceId: devId, studentReg: record.studentReg, timestamp: Date.now() },
      ...prev,
    ]);

    if (record.decision.status === 'VERIFIED_PRESENT') {
      triggerToast(`✓ Verified: ${record.studentName} marked present for ${record.courseCode}`);
    } else if (record.decision.status === 'FLAGGED_REVIEW') {
      triggerToast(`⚠ Flagged: ${record.studentName} forwarded to lecturer review queue`);
    } else {
      triggerToast(`✕ Rejected: ${record.studentName} failed presence or liveness check`);
    }
  };

  const handleStartSession = (session: LectureSession) => {
    setActiveSession(session);
    triggerToast(
      `Phone BLE Beacon active on ${session.lecturerPhoneName} for ${session.courseCode} (${session.room})`
    );
  };

  const handleEndSession = () => {
    setActiveSession(null);
    triggerToast("Lecturer's Phone BLE Beacon broadcast ended.");
  };

  const handleAddManualRecord = (record: AttendanceRecord) => {
    setRecords((prev) => [record, ...prev]);
    triggerToast(`Admin secret portal override saved for ${record.studentName} (${record.courseCode})`);
  };

  const handleRegisterStudent = (newStudent: Student): { ok: boolean; error?: string } => {
    const exists = students.some(
      (s) => s.regNumber.trim().toLowerCase() === newStudent.regNumber.trim().toLowerCase()
    );
    if (exists) {
      return {
        ok: false,
        error: `Admission number ${newStudent.regNumber} is already registered.`,
      };
    }

    const updated = [newStudent, ...students];
    setStudents(updated);
    try {
      localStorage.setItem(STUDENT_REGISTRY_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
    triggerToast(`Registered ${newStudent.name} (${newStudent.regNumber}) in student registry.`);
    return { ok: true };
  };

  const handleUpdateStudentPassport = (studentReg: string, passportPhotoUrl?: string) => {
    const normalized = studentReg.trim().toLowerCase();
    const updated = students.map((s) =>
      s.regNumber.trim().toLowerCase() === normalized ? { ...s, passportPhotoUrl } : s
    );
    setStudents(updated);
    setLoggedInStudent((prev) =>
      prev && prev.regNumber.trim().toLowerCase() === normalized
        ? { ...prev, passportPhotoUrl }
        : prev
    );
    try {
      localStorage.setItem(STUDENT_REGISTRY_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
    triggerToast(
      passportPhotoUrl
        ? `Updated profile photo for ${studentReg}.`
        : `Reset profile photo to default template for ${studentReg}.`
    );
  };

  const handleUpdateStudentProfile = (updatedStudent: Student) => {
    const normalized = updatedStudent.regNumber.trim().toLowerCase();
    const updated = students.map((s) =>
      s.regNumber.trim().toLowerCase() === normalized ? updatedStudent : s
    );
    setStudents(updated);
    setLoggedInStudent((prev) =>
      prev && prev.regNumber.trim().toLowerCase() === normalized ? updatedStudent : prev
    );
    try {
      localStorage.setItem(STUDENT_REGISTRY_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
    triggerToast(`Saved profile updates for ${updatedStudent.name}.`);
  };

  const handleRegisterLecturer = (
    newLecturer: LecturerAccount,
    newCourse?: Course
  ): { ok: boolean; error?: string; lecturer?: LecturerAccount } => {
    const cleanUsername = newLecturer.username.trim().toLowerCase();
    const usernameExists = lecturers.some(
      (l) => l.username.trim().toLowerCase() === cleanUsername
    );
    if (usernameExists) {
      return {
        ok: false,
        error: `Username "${newLecturer.username}" is already taken. Please choose another username.`,
      };
    }

    let updatedCourses = courses;
    if (newCourse) {
      const cleanCode = newCourse.code.trim().toUpperCase();
      const existingIndex = courses.findIndex((c) => c.code.toUpperCase() === cleanCode);
      if (existingIndex >= 0) {
        updatedCourses = courses.map((c, idx) =>
          idx === existingIndex
            ? {
                ...c,
                title: newCourse.title || c.title,
                room: newCourse.room || c.room,
                lecturerName: newLecturer.name,
              }
            : c
        );
      } else {
        updatedCourses = [newCourse, ...courses];
      }
      setCourses(updatedCourses);
      try {
        localStorage.setItem(COURSES_REGISTRY_KEY, JSON.stringify(updatedCourses));
      } catch {
        // ignore storage quota errors
      }
    }

    const updatedLecturers = [newLecturer, ...lecturers];
    setLecturers(updatedLecturers);
    try {
      localStorage.setItem(LECTURER_REGISTRY_KEY, JSON.stringify(updatedLecturers));
    } catch {
      // ignore storage quota errors
    }

    setLoggedInLecturer(newLecturer);
    triggerToast(
      `Account created for ${newLecturer.name} (${newLecturer.courseCodes?.[0] || newLecturer.staffId})`
    );
    return { ok: true, lecturer: newLecturer };
  };

  const handleUpdateLecturerAccount = (
    updatedLecturer: LecturerAccount,
    newCourse?: Course
  ): { ok: boolean; error?: string } => {
    const cleanUsername = updatedLecturer.username.trim().toLowerCase();
    const conflict = lecturers.some(
      (l) => l.id !== updatedLecturer.id && l.username.trim().toLowerCase() === cleanUsername
    );
    if (conflict) {
      return {
        ok: false,
        error: `Username "${updatedLecturer.username}" is already used by another lecturer.`,
      };
    }

    let updatedCourses = courses;
    if (newCourse) {
      const cleanCode = newCourse.code.trim().toUpperCase();
      const existingIndex = courses.findIndex((c) => c.code.toUpperCase() === cleanCode);
      if (existingIndex >= 0) {
        updatedCourses = courses.map((c, idx) =>
          idx === existingIndex
            ? {
                ...c,
                title: newCourse.title || c.title,
                room: newCourse.room || c.room,
                lecturerName: updatedLecturer.name,
              }
            : c
        );
      } else {
        updatedCourses = [newCourse, ...courses];
      }
      setCourses(updatedCourses);
      try {
        localStorage.setItem(COURSES_REGISTRY_KEY, JSON.stringify(updatedCourses));
      } catch {
        // ignore storage quota errors
      }
    }

    const updatedLecturers = lecturers.map((l) =>
      l.id === updatedLecturer.id ? updatedLecturer : l
    );
    setLecturers(updatedLecturers);
    setLoggedInLecturer(updatedLecturer);
    try {
      localStorage.setItem(LECTURER_REGISTRY_KEY, JSON.stringify(updatedLecturers));
    } catch {
      // ignore storage quota errors
    }

    triggerToast(`Updated lecturer credentials & unit profile for ${updatedLecturer.name}.`);
    return { ok: true };
  };

  const handleUploadStudentList = (
    listItem: UploadedStudentList,
    importedStudents: Student[]
  ): { addedCount: number; skippedCount: number } => {
    let addedCount = 0;
    let skippedCount = 0;

    if (importedStudents.length > 0) {
      const existingRegs = new Set(students.map((s) => s.regNumber.trim().toUpperCase()));
      const newlyAdded: Student[] = [];
      for (const candidate of importedStudents) {
        const reg = candidate.regNumber.trim().toUpperCase();
        if (!reg || existingRegs.has(reg)) {
          skippedCount++;
          continue;
        }
        existingRegs.add(reg);
        newlyAdded.push({ ...candidate, regNumber: reg });
        addedCount++;
      }

      if (newlyAdded.length > 0) {
        const updatedStudents = [...newlyAdded, ...students];
        setStudents(updatedStudents);
        try {
          localStorage.setItem(STUDENT_REGISTRY_KEY, JSON.stringify(updatedStudents));
        } catch {
          // ignore storage quota errors
        }
      }
    }

    const enrichedListItem: UploadedStudentList = {
      ...listItem,
      importedStudentsCount: addedCount,
    };

    const updatedLists = [enrichedListItem, ...uploadedStudentLists];
    setUploadedStudentLists(updatedLists);
    try {
      localStorage.setItem(STUDENT_LISTS_KEY, JSON.stringify(updatedLists));
    } catch {
      // ignore storage quota errors
    }

    triggerToast(
      addedCount > 0
        ? `Uploaded "${listItem.fileName}" and enrolled ${addedCount} new student(s).`
        : `Uploaded student list "${listItem.fileName}" for ${listItem.courseCode}.`
    );

    return { addedCount, skippedCount };
  };

  const handleDeleteStudentList = (listId: string) => {
    const updatedLists = uploadedStudentLists.filter((item) => item.id !== listId);
    setUploadedStudentLists(updatedLists);
    try {
      localStorage.setItem(STUDENT_LISTS_KEY, JSON.stringify(updatedLists));
    } catch {
      // ignore storage quota errors
    }
    triggerToast('Removed uploaded student list file.');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="flex items-center justify-between gap-6 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-2xs">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            S
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900 block leading-tight">
              SMAP University
            </span>
            <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase block">
              Smart Attendance Platform
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveView('student')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'student'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Student Check-In</span>
          </button>

          <button
            onClick={() => setActiveView('lecturer')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'lecturer'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Lecturer Console</span>
          </button>
        </nav>

        {/* Zone 3: Actions & Active Session Pill */}
        <div className="flex items-center gap-3 shrink-0">
          {activeSession ? (
            <button
              onClick={() => setActiveView('lecturer')}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{activeSession.courseCode} Live</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveView('lecturer')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-slate-500" />
              <span>Start Lecture</span>
            </button>
          )}

          {/* Active Logged-In User Profile Menu */}
          <div className="relative" ref={profileMenuRef}>
            {activeView === 'student' ? (
              loggedInStudent ? (
                <>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2.5 text-xs font-semibold bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 rounded-full pl-1.5 pr-3 py-1 text-slate-800 transition-colors cursor-pointer"
                  >
                    <img
                      src={getStudentPassportUrl(loggedInStudent)}
                      alt={loggedInStudent.name}
                      className="w-7 h-7 rounded-full object-cover border border-indigo-300 bg-white"
                    />
                    <span className="hidden sm:inline max-w-[140px] truncate">{loggedInStudent.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {profileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3">
                        <img
                          src={getStudentPassportUrl(loggedInStudent)}
                          alt={loggedInStudent.name}
                          className="w-10 h-10 rounded-full object-cover border border-indigo-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{loggedInStudent.name}</div>
                          <div className="text-[11px] font-mono text-indigo-700 truncate">{loggedInStudent.regNumber}</div>
                          <div className="text-[10px] text-slate-400 truncate">{loggedInStudent.email || loggedInStudent.department}</div>
                        </div>
                      </div>
                      <div className="p-1.5 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveView('student');
                            setRequestedStudentTab({ tab: 'profile', nonce: Date.now() });
                            setProfileMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 cursor-pointer"
                        >
                          <IdCard className="w-3.5 h-3.5 text-indigo-600" />
                          <span>My Profile &amp; Passport</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveView('student');
                            setRequestedStudentTab({ tab: 'history', nonce: Date.now() });
                            setProfileMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Attendance History</span>
                        </button>
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          onClick={() => {
                            setLoggedInStudent(null);
                            setProfileMenuOpen(false);
                            triggerToast('Signed out of student portal.');
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-700 font-semibold flex items-center gap-2 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="hidden lg:flex items-center gap-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-500">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Student Sign-In Required</span>
                </div>
              )
            ) : loggedInLecturer ? (
              <>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 text-xs font-semibold bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 rounded-full pl-1.5 pr-3 py-1 text-slate-800 transition-colors cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-700 text-white flex items-center justify-center font-bold text-[11px]">
                    {loggedInLecturer.name
                      .split(/\s+/)
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <span className="hidden sm:inline max-w-[140px] truncate">{loggedInLecturer.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <div className="font-bold text-slate-900 truncate">{loggedInLecturer.name}</div>
                      <div className="text-[11px] font-mono text-indigo-700">{loggedInLecturer.staffId}</div>
                      <div className="text-[10px] text-slate-400 truncate">{loggedInLecturer.department}</div>
                    </div>
                    <div className="p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLoggedInLecturer(null);
                          setProfileMenuOpen(false);
                          triggerToast('Signed out of lecturer console.');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-700 font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="hidden lg:flex items-center gap-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-500">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Lecturer Sign-In Required</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden items-center gap-1.5 mb-5 overflow-x-auto pb-1 text-xs font-semibold">
          <button
            onClick={() => setActiveView('student')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer ${
              activeView === 'student'
                ? 'bg-indigo-700 text-white font-bold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Student Check-In
          </button>
          <button
            onClick={() => setActiveView('lecturer')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer ${
              activeView === 'lecturer'
                ? 'bg-indigo-700 text-white font-bold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Lecturer Console
          </button>
        </div>

        {/* Dynamic Views */}
        {activeView === 'student' && (
          <StudentPortal
            student={loggedInStudent}
            students={students}
            onLoginStudent={(s) => {
              setLoggedInStudent(s);
              triggerToast(`Signed in as ${s.name} (${s.regNumber})`);
            }}
            onLogoutStudent={() => {
              setLoggedInStudent(null);
              triggerToast('Signed out of student portal.');
            }}
            onUpdateStudentPassport={handleUpdateStudentPassport}
            onUpdateStudentProfile={handleUpdateStudentProfile}
            requestedTab={requestedStudentTab}
            courses={courses}
            records={records}
            activeSession={activeSession}
            onRecordAttendance={handleRecordAttendance}
            recentDeviceCheckins={recentDeviceCheckins}
          />
        )}

        {activeView === 'lecturer' && (
          <LecturerConsole
            lecturer={loggedInLecturer}
            lecturers={lecturers}
            onLoginLecturer={(lec) => {
              setLoggedInLecturer(lec);
              triggerToast(`Signed in as ${lec.name} (${lec.staffId})`);
            }}
            onLogoutLecturer={() => {
              setLoggedInLecturer(null);
              triggerToast('Signed out of lecturer console.');
            }}
            onRegisterLecturer={handleRegisterLecturer}
            onUpdateLecturerAccount={handleUpdateLecturerAccount}
            courses={courses}
            students={students}
            records={records}
            activeSession={activeSession}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onAddManualRecord={handleAddManualRecord}
            onRegisterStudent={handleRegisterStudent}
            onUpdateStudentPassport={handleUpdateStudentPassport}
            uploadedStudentLists={uploadedStudentLists}
            onUploadStudentList={handleUploadStudentList}
            onDeleteStudentList={handleDeleteStudentList}
          />
        )}
      </main>

      {/* Toast Notification */}
      {notificationToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom duration-200">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{notificationToast}</span>
        </div>
      )}

      {/* Universal Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-5 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 SMAP — Smart Attendance Management Platform. University Multimodal Verification System.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>BLE Proximity Perimeter</span>
            <span>•</span>
            <span>Biometric Liveness Verification</span>
            <span>•</span>
            <span>Anti-Proxy Ledger</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
