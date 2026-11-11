import React, { useState } from 'react';
import {
  School,
  Radio,
  FileSpreadsheet,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  User,
  Users,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { Course, Student, AttendanceRecord, LectureSession } from './types/attendance';
import {
  INITIAL_COURSES,
  INITIAL_STUDENTS,
  INITIAL_RECORDS,
  INITIAL_ACTIVE_SESSION,
} from './data/mockData';
import { StudentPortal } from './components/StudentPortal';
import { LecturerConsole } from './components/LecturerConsole';
import { AuditLedgerView } from './components/AuditLedgerView';
import { DecisionSandbox } from './components/DecisionSandbox';

type MainView = 'student' | 'lecturer' | 'ledger' | 'sandbox';

export default function App() {
  const [courses] = useState<Course[]>(INITIAL_COURSES);
  const [students] = useState<Student[]>(INITIAL_STUDENTS);
  const [records, setRecords] = useState<AttendanceRecord[]>(INITIAL_RECORDS);
  const [activeSession, setActiveSession] = useState<LectureSession | null>(INITIAL_ACTIVE_SESSION);
  const [activeView, setActiveView] = useState<MainView>('student');
  const [currentStudent, setCurrentStudent] = useState<Student>(INITIAL_STUDENTS[0]);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

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
    triggerToast(`Classroom BLE Beacon broadcasting for ${session.courseCode} (${session.room})`);
  };

  const handleEndSession = () => {
    setActiveSession(null);
    triggerToast('Classroom BLE Beacon broadcast ended.');
  };

  const handleAddManualRecord = (record: AttendanceRecord) => {
    setRecords((prev) => [record, ...prev]);
    triggerToast(`Admin secret portal override saved for ${record.studentName} (${record.courseCode})`);
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

          <button
            onClick={() => setActiveView('ledger')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'ledger'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Faculty Audit Ledger</span>
          </button>

          <button
            onClick={() => setActiveView('sandbox')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'sandbox'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Rule Engine Sandbox</span>
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

          {/* Student Selector Quick Switch */}
          {activeView === 'student' && (
            <select
              value={currentStudent.id}
              onChange={(e) => {
                const s = students.find((item) => item.id === e.target.value);
                if (s) setCurrentStudent(s);
              }}
              className="hidden lg:block text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-indigo-600 cursor-pointer"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  Student: {s.name} ({s.regNumber})
                </option>
              ))}
            </select>
          )}
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
          <button
            onClick={() => setActiveView('ledger')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer ${
              activeView === 'ledger'
                ? 'bg-indigo-700 text-white font-bold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Audit Ledger
          </button>
          <button
            onClick={() => setActiveView('sandbox')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer ${
              activeView === 'sandbox'
                ? 'bg-indigo-700 text-white font-bold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Rule Sandbox
          </button>
        </div>

        {/* Dynamic Views */}
        {activeView === 'student' && (
          <StudentPortal
            student={currentStudent}
            courses={courses}
            records={records}
            activeSession={activeSession}
            onRecordAttendance={handleRecordAttendance}
            recentDeviceCheckins={recentDeviceCheckins}
          />
        )}

        {activeView === 'lecturer' && (
          <LecturerConsole
            courses={courses}
            students={students}
            records={records}
            activeSession={activeSession}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onAddManualRecord={handleAddManualRecord}
          />
        )}

        {activeView === 'ledger' && (
          <AuditLedgerView
            courses={courses}
            records={records}
            students={students}
          />
        )}

        {activeView === 'sandbox' && <DecisionSandbox />}
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
