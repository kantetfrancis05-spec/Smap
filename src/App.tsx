import React, { useState } from 'react';
import {
  Smartphone,
  LayoutDashboard,
  Code2,
  School,
  CheckCircle2,
  PlayCircle,
  ShieldCheck,
  RefreshCw,
  Plus,
  Sliders,
  Download,
  Terminal
} from 'lucide-react';
import { Course, Student, AttendanceRecord, LectureSession } from './types/attendance';
import {
  INITIAL_COURSES,
  INITIAL_STUDENTS,
  INITIAL_RECORDS,
  INITIAL_ACTIVE_SESSION,
} from './data/mockData';
import { FlutterSimulator } from './components/FlutterSimulator';
import { CodeExplainer } from './components/CodeExplainer';
import { PortalView } from './components/PortalView';
import { InstallApkModal } from './components/InstallApkModal';

export default function App() {
  const [courses] = useState<Course[]>(INITIAL_COURSES);
  const [students] = useState<Student[]>(INITIAL_STUDENTS);
  const [records, setRecords] = useState<AttendanceRecord[]>(INITIAL_RECORDS);
  const [activeSession, setActiveSession] = useState<LectureSession | null>(INITIAL_ACTIVE_SESSION);
  const [activeView, setActiveView] = useState<'simulator' | 'code' | 'portal'>('simulator');
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);

  // Device checkin ledger to detect multi-student hardware clashes
  const [recentDeviceCheckins, setRecentDeviceCheckins] = useState<
    { deviceId: string; studentReg: string; timestamp: number }[]
  >([
    { deviceId: 'DEV-IPHONE15-3312', studentReg: 'STU/2023/0018', timestamp: Date.now() - 500000 },
  ]);

  const triggerToast = (msg: string) => {
    setNotificationToast(msg);
    setTimeout(() => {
      setNotificationToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Record verified attendance
  const handleRecordAttendance = (record: AttendanceRecord) => {
    setRecords((prev) => [record, ...prev]);

    // Register device check-in history to catch proxy multi-student attempts
    const student = students.find((s) => s.regNumber === record.studentReg);
    const devId = student?.registeredDeviceId || 'DEV-UNKNOWN';
    setRecentDeviceCheckins((prev) => [{ deviceId: devId, studentReg: record.studentReg, timestamp: Date.now() }, ...prev]);

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
    triggerToast(`BLE Beacon broadcasting for ${session.courseCode} (${session.room})`);
  };

  const handleEndSession = () => {
    setActiveSession(null);
    triggerToast('Classroom BLE Beacon broadcast ended.');
  };

  const handleAddManualRecord = (record: AttendanceRecord) => {
    setRecords((prev) => [record, ...prev]);
    triggerToast(`Manual override saved for ${record.studentName} (${record.courseCode})`);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-2xs">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            S
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">
            SMAP Smart Attendance
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => setActiveView('simulator')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'simulator'
                ? 'text-indigo-700 font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            Flutter BLE & Face App
          </button>
          <button
            onClick={() => setActiveView('code')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'code'
                ? 'text-indigo-700 font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            Phase 1 Code & Risk Sandbox
          </button>
          <button
            onClick={() => setActiveView('portal')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'portal'
                ? 'text-indigo-700 font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            Faculty Audit Ledger
          </button>
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowInstallModal(true)}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Install / Export APK</span>
          </button>

          <button
            onClick={() => setActiveView(activeView === 'code' ? 'simulator' : 'code')}
            className="hidden sm:flex px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 items-center gap-1.5 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5 text-slate-500" />
            <span>{activeView === 'code' ? 'Live App' : 'Dart Code'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {/* Mobile View Switcher */}
        <div className="flex md:hidden items-center gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveView('simulator')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
              activeView === 'simulator'
                ? 'bg-indigo-700 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Mobile App
          </button>
          <button
            onClick={() => setActiveView('code')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
              activeView === 'code'
                ? 'bg-indigo-700 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Code & Sandbox
          </button>
          <button
            onClick={() => setActiveView('portal')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
              activeView === 'portal'
                ? 'bg-indigo-700 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Audit Ledger
          </button>
          <button
            onClick={() => setShowInstallModal(true)}
            className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg whitespace-nowrap"
          >
            Install APK
          </button>
        </div>

        {/* VIEW 1: FLUTTER SIMULATOR */}
        {activeView === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1">
            {/* Left Column: Phone Simulator Frame */}
            <div className="lg:col-span-5 flex justify-center">
              <FlutterSimulator
                courses={courses}
                students={students}
                records={records}
                activeSession={activeSession}
                onRecordAttendance={handleRecordAttendance}
                onStartSession={handleStartSession}
                onEndSession={handleEndSession}
                recentDeviceCheckins={recentDeviceCheckins}
              />
            </div>

            {/* Right Column: Interactive Guidance & Active Telemetry */}
            <div className="lg:col-span-7 space-y-6">
              {/* Quick APK Banner */}
              <div className="bg-gradient-to-r from-emerald-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">
                    Android Installation & Source Package
                  </span>
                  <h4 className="text-base font-bold">Install as Android APK or Download Flutter Source</h4>
                  <p className="text-xs text-slate-300">
                    Install directly to your Android device via WebAPK or download the full Flutter project archive.
                  </p>
                </div>
                <button
                  onClick={() => setShowInstallModal(true)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Get APK / Project</span>
                </button>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-slate-900">
                    Live Multimodal Verification Sandbox
                  </h3>
                  <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                    Phase 1 · Modular Architecture
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Test the complete independent module pipeline inside the Flutter simulator:
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <strong className="text-indigo-800 block mb-1">1. BLE Classroom Presence</strong>
                    <p className="text-slate-600">
                      Scans 2.4 GHz classroom beacon UUID <span className="font-mono text-indigo-700">{activeSession?.beaconUuid || 'CS301'}</span>. Adjust the signal slider to test in-room (-64 dBm) vs outside hallway (-88 dBm).
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <strong className="text-indigo-800 block mb-1">2. Facial Liveness Anti-Spoof</strong>
                    <p className="text-slate-600">
                      Interactive ML Kit camera simulation with active eye-blink challenge to reject printed photo attacks.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <strong className="text-indigo-800 block mb-1">3. Rule Decision Engine</strong>
                    <p className="text-slate-600">
                      Evaluates multi-factor evidence: physical BLE presence + biometric match &gt;85% $\to$ <span className="text-emerald-700 font-bold">VERIFIED PRESENT</span>.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <strong className="text-indigo-800 block mb-1">4. Independent Anomaly Engine</strong>
                    <p className="text-slate-600">
                      Detects hardware fingerprint clashes (e.g. friend using phone for multiple student IDs) and scores fraud risk from 0 to 100.
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Session Radar Telemetry */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Classroom Beacon Telemetry
                  </h4>
                  {activeSession ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Broadcasting 2.4 GHz BLE
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Beacon Idle</span>
                  )}
                </div>

                {activeSession ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-sans">Course</p>
                      <p className="font-bold text-slate-900">{activeSession.courseCode}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-sans">Tx Power / Gate</p>
                      <p className="font-bold text-indigo-700">{activeSession.txPower}dBm / &gt;={activeSession.rssiThreshold}dBm</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-sans">Room</p>
                      <p className="font-bold text-slate-900">{activeSession.room}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-sans">Verified Count</p>
                      <p className="font-bold text-emerald-600">
                        {records.filter((r) => r.courseCode === activeSession.courseCode && r.decision.status === 'VERIFIED_PRESENT').length} Students
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Start a broadcast from the Lecturer Console to broadcast classroom beacon signals.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: CODE EXPLAINER & DART MODULES */}
        {activeView === 'code' && <CodeExplainer />}

        {/* VIEW 3: FACULTY WEB AUDIT PORTAL */}
        {activeView === 'portal' && (
          <PortalView
            courses={courses}
            students={students}
            records={records}
            activeSession={activeSession}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onAddManualRecord={handleAddManualRecord}
          />
        )}
      </main>

      {/* Global Notification Toast */}
      {notificationToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-medium z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notificationToast}</span>
        </div>
      )}

      {/* Install APK / Download Flutter Project Modal */}
      <InstallApkModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </div>
  );
}
