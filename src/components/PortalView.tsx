import React, { useState } from 'react';
import {
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Search,
  Filter,
  PlusCircle,
  PlayCircle,
  StopCircle,
  School,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  Bluetooth,
  ScanFace,
  Activity
} from 'lucide-react';
import { Course, Student, AttendanceRecord, LectureSession, DecisionStatus } from '../types/attendance';
import { QRCodeDisplay } from './QRCodeDisplay';

interface PortalViewProps {
  courses: Course[];
  students: Student[];
  records: AttendanceRecord[];
  activeSession: LectureSession | null;
  onStartSession: (session: LectureSession) => void;
  onEndSession: () => void;
  onAddManualRecord: (record: AttendanceRecord) => void;
}

export const PortalView: React.FC<PortalViewProps> = ({
  courses,
  students,
  records,
  activeSession,
  onStartSession,
  onEndSession,
  onAddManualRecord,
}) => {
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<string>('all');
  const [newCourseCode, setNewCourseCode] = useState(courses[0].code);

  // Manual record entry modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualStudentReg, setManualStudentReg] = useState(students[0].regNumber);
  const [manualCourseCode, setManualCourseCode] = useState(courses[0].code);
  const [manualDecision, setManualDecision] = useState<DecisionStatus>('VERIFIED_PRESENT');

  // Filter records
  const filteredRecords = records.filter((r) => {
    const matchesCourse = selectedCourseFilter === 'all' || r.courseCode === selectedCourseFilter;
    const matchesDecision = decisionFilter === 'all' || r.decision.status === decisionFilter;
    const q = searchStudentQuery.toLowerCase();
    const matchesSearch =
      !q ||
      r.studentName.toLowerCase().includes(q) ||
      r.studentReg.toLowerCase().includes(q) ||
      r.courseCode.toLowerCase().includes(q) ||
      r.verificationToken.toLowerCase().includes(q);
    return matchesCourse && matchesDecision && matchesSearch;
  });

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Record ID',
      'Course Code',
      'Course Title',
      'Student Reg No',
      'Student Name',
      'Timestamp',
      'BLE Signal (dBm)',
      'Est Distance (m)',
      'Face Match (%)',
      'Liveness',
      'Decision Status',
      'Rule Matched',
      'Fraud Risk Score',
      'Risk Level',
      'Digital Token',
    ];
    const rows = filteredRecords.map((r) => [
      r.id,
      r.courseCode,
      `"${r.courseTitle}"`,
      r.studentReg,
      `"${r.studentName}"`,
      r.timestamp,
      r.bleEvidence.rssi,
      r.bleEvidence.estimatedDistanceMeters,
      r.faceEvidence.matchScore,
      r.faceEvidence.livenessPassed ? 'PASS' : 'FAIL',
      r.decision.status,
      r.decision.ruleMatched,
      r.anomaly.riskScore,
      r.anomaly.riskLevel,
      r.verificationToken,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SMAP_multimodal_attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stu = students.find((s) => s.regNumber === manualStudentReg) || students[0];
    const crs = courses.find((c) => c.code === manualCourseCode) || courses[0];
    const newRec: AttendanceRecord = {
      id: `rec-manual-${Date.now()}`,
      sessionId: activeSession ? activeSession.id : `sess-manual-${Date.now()}`,
      courseCode: crs.code,
      courseTitle: crs.title,
      studentReg: stu.regNumber,
      studentName: stu.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      bleEvidence: {
        beaconUuid: crs.beaconUuid,
        major: crs.beaconMajor,
        minor: crs.beaconMinor,
        rssi: -65,
        estimatedDistanceMeters: 3.5,
        isWithinClassroomRange: true,
        timestamp: 'Manual Override',
      },
      faceEvidence: {
        faceDetected: true,
        matchScore: 95,
        livenessPassed: true,
        livenessChallenge: 'blink',
        lightingQuality: 'good',
        timestamp: 'Manual Override',
      },
      decision: {
        status: manualDecision,
        ruleMatched: 'R_MANUAL_FACULTY_OVERRIDE',
        compositeConfidence: 100,
        reason: 'Authorized manual override by university faculty supervisor.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      anomaly: {
        riskScore: 0,
        riskLevel: 'LOW',
        flags: [],
        deviceClashDetected: false,
        signalInconsistencyDetected: false,
        livenessSpoofSuspected: false,
        velocityAnomalyDetected: false,
        explanation: 'Manual override by authenticated lecturer.',
      },
      verificationToken: `SMAP-${crs.code}-${Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase()}`,
    };
    onAddManualRecord(newRec);
    setShowManualModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Active Session Broadcast Banner */}
      {activeSession ? (
        <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-700/50 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span className="text-xs uppercase font-bold tracking-wider text-indigo-300">
                Classroom BLE Beacon Broadcasting
              </span>
              <span className="text-xs font-mono bg-indigo-800/80 px-2 py-0.5 rounded text-indigo-100">
                Room {activeSession.room}
              </span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight">
              {activeSession.courseCode}: {activeSession.courseTitle}
            </h3>
            <p className="text-sm text-indigo-200">
              Lecturer: {activeSession.lecturerName} · Active since: {activeSession.startTime}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-indigo-100">
              <div className="bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <Bluetooth className="w-3.5 h-3.5 text-indigo-300" />
                <span className="text-indigo-300 uppercase font-semibold text-[10px]">Beacon UUID:</span>
                <span className="font-mono text-xs text-white">{activeSession.beaconUuid}</span>
              </div>

              <div className="bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="text-indigo-300 uppercase font-semibold text-[10px]">OTP:</span>
                <span className="font-mono text-sm font-bold text-emerald-300 tracking-wider">
                  {activeSession.otpCode}
                </span>
              </div>

              <div className="bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="text-indigo-300 uppercase font-semibold text-[10px]">Verified:</span>
                <span className="font-bold text-xs text-white">
                  {records.filter((r) => r.courseCode === activeSession.courseCode && r.decision.status === 'VERIFIED_PRESENT').length} students
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={onEndSession}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2"
            >
              <StopCircle className="w-4 h-4" />
              <span>Conclude Broadcast</span>
            </button>
            <button
              onClick={() => setShowManualModal(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl transition-colors"
            >
              Manual Faculty Override
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
              <School className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">No Classroom Beacon Active</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Launch a lecture session to broadcast BLE presence signals and enable multimodal check-ins.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={newCourseCode}
              onChange={(e) => setNewCourseCode(e.target.value)}
              className="text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} ({c.room})
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                const selected = courses.find((c) => c.code === newCourseCode) || courses[0];
                const newSess: LectureSession = {
                  id: `sess-${Date.now()}`,
                  courseCode: selected.code,
                  courseTitle: selected.title,
                  lecturerName: selected.lecturerName,
                  room: selected.room,
                  startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  expiresAt: '45m',
                  isActive: true,
                  otpCode: Math.floor(100000 + Math.random() * 900000).toString(),
                  qrPayload: `SMAP://SESSION/${selected.code}/TOK-${Math.floor(1000 + Math.random() * 9000)}`,
                  beaconUuid: selected.beaconUuid,
                  beaconMajor: selected.beaconMajor,
                  beaconMinor: selected.beaconMinor,
                  txPower: -59,
                  rssiThreshold: -78,
                };
                onStartSession(newSess);
              }}
              className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-medium text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Launch Session</span>
            </button>
          </div>
        </div>
      )}

      {/* Courses Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {courses.map((crs) => {
          const courseRecords = records.filter((r) => r.courseCode === crs.code);
          const totalVerified = courseRecords.filter((r) => r.decision.status === 'VERIFIED_PRESENT').length;
          const avgRate = Math.min(100, Math.round((totalVerified / Math.max(courseRecords.length, 1)) * 100));

          return (
            <div
              key={crs.id}
              onClick={() => setSelectedCourseFilter(selectedCourseFilter === crs.code ? 'all' : crs.code)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                selectedCourseFilter === crs.code
                  ? 'bg-indigo-50/60 border-indigo-400 ring-2 ring-indigo-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  {crs.code}
                </span>
                <span className="text-[11px] text-slate-500">{crs.room}</span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm truncate mt-1">{crs.title}</h4>
              <p className="text-xs text-slate-500 truncate">{crs.lecturerName}</p>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Verified Rate</span>
                <span className="font-bold font-mono text-slate-900">{avgRate}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Multimodal Attendance Records Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 text-base">Multimodal Attendance & Fraud Audit Ledger</h4>
            <p className="text-xs text-slate-500">
              Showing {filteredRecords.length} records verified with BLE classroom signal + facial liveness
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search student, reg, token..."
                value={searchStudentQuery}
                onChange={(e) => setSearchStudentQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52"
              />
            </div>

            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>

            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
            >
              <option value="all">All Decisions</option>
              <option value="VERIFIED_PRESENT">Verified Present</option>
              <option value="FLAGGED_REVIEW">Flagged for Review</option>
              <option value="REJECTED_ABSENT">Rejected Absent</option>
            </select>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setShowManualModal(true)}
              className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-2xs transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Record</span>
            </button>
          </div>
        </div>

        {/* Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Student Name & Reg</th>
                <th className="py-3 px-4 font-semibold">Course</th>
                <th className="py-3 px-4 font-semibold">BLE Presence Signal</th>
                <th className="py-3 px-4 font-semibold">Facial Verification</th>
                <th className="py-3 px-4 font-semibold">Rule Decision</th>
                <th className="py-3 px-4 font-semibold">Fraud Risk Score</th>
                <th className="py-3 px-4 font-semibold">Digital Token</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No matching attendance records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{r.studentName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{r.studentReg}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{r.courseCode}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                        {r.courseTitle}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-1 text-slate-800 font-semibold">
                        <Bluetooth className="w-3 h-3 text-indigo-600" />
                        <span>{r.bleEvidence.rssi} dBm</span>
                      </div>
                      <div className="text-[10px] text-slate-500">~{r.bleEvidence.estimatedDistanceMeters}m (Classroom Range)</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-slate-800 font-semibold">
                        <ScanFace className="w-3 h-3 text-emerald-600" />
                        <span>{r.faceEvidence.matchScore}% Match</span>
                      </div>
                      <div className="text-[10px] text-emerald-700">Liveness: {r.faceEvidence.livenessPassed ? 'PASS' : 'FAIL'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold text-[10px] px-2 py-0.5 rounded-full ${
                          r.decision.status === 'VERIFIED_PRESENT'
                            ? 'bg-emerald-50 text-emerald-700'
                            : r.decision.status === 'FLAGGED_REVIEW'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{r.decision.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center font-mono font-semibold text-[10px] px-2 py-0.5 rounded ${
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
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100">
                        {r.verificationToken}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h4 className="font-bold text-slate-900 text-base">Faculty Attendance Override</h4>
            <p className="text-xs text-slate-500">
              Manual authorization for students with hardware failure or documented medical exemptions.
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Student</label>
                <select
                  value={manualStudentReg}
                  onChange={(e) => setManualStudentReg(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.regNumber}>
                      {s.name} ({s.regNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Course</label>
                <select
                  value={manualCourseCode}
                  onChange={(e) => setManualCourseCode(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code} - {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Decision Override</label>
                <select
                  value={manualDecision}
                  onChange={(e) => setManualDecision(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="VERIFIED_PRESENT">Verified Present (Faculty Witnessed)</option>
                  <option value="FLAGGED_REVIEW">Flagged for Department Review</option>
                  <option value="REJECTED_ABSENT">Rejected Absent</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-2 text-xs text-slate-600 bg-slate-100 rounded-lg font-medium hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg font-semibold"
                >
                  Authorize Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
