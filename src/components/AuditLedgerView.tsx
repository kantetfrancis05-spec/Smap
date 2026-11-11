import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  X,
  ShieldAlert,
  ShieldCheck,
  Radio,
  Eye,
  Camera,
  Fingerprint,
  Calendar,
  Clock,
  Layers
} from 'lucide-react';
import { Course, Student, AttendanceRecord, DecisionStatus, RiskLevel } from '../types/attendance';
import { AttendanceTrendChart } from './AttendanceTrendChart';

interface AuditLedgerViewProps {
  courses: Course[];
  records: AttendanceRecord[];
  students: Student[];
}

export const AuditLedgerView: React.FC<AuditLedgerViewProps> = ({
  courses,
  records,
  students,
}) => {
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Record for Forensic Inspection Modal
  const [inspectRecord, setInspectRecord] = useState<AttendanceRecord | null>(null);

  // Filter records
  const filtered = records.filter((r) => {
    const matchesCourse = courseFilter === 'all' || r.courseCode === courseFilter;
    const matchesStatus = statusFilter === 'all' || r.decision.status === statusFilter;
    const matchesRisk = riskFilter === 'all' || r.anomaly.riskLevel === riskFilter;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.studentName.toLowerCase().includes(q) ||
      r.studentReg.toLowerCase().includes(q) ||
      r.courseCode.toLowerCase().includes(q) ||
      r.verificationToken.toLowerCase().includes(q);

    return matchesCourse && matchesStatus && matchesRisk && matchesSearch;
  });

  // Calculate Ledger KPI Stats
  const totalLogs = records.length;
  const verifiedCount = records.filter((r) => r.decision.status === 'VERIFIED_PRESENT').length;
  const flaggedCount = records.filter((r) => r.decision.status === 'FLAGGED_REVIEW').length;
  const rejectedCount = records.filter((r) => r.decision.status === 'REJECTED_ABSENT').length;
  const deviceClashes = records.filter((r) => r.anomaly.deviceClashDetected).length;

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Record ID',
      'Course Code',
      'Course Title',
      'Student Reg No',
      'Student Name',
      'Timestamp',
      'BLE RSSI (dBm)',
      'Estimated Distance (m)',
      'Classroom In Range',
      'Face Match (%)',
      'Liveness Passed',
      'Liveness Challenge',
      'Decision Status',
      'Decision Reason',
      'Fraud Risk Score',
      'Risk Level',
      'Device Clash',
      'Audit Token',
    ];

    const rows = filtered.map((r) => [
      r.id,
      r.courseCode,
      `"${r.courseTitle}"`,
      r.studentReg,
      `"${r.studentName}"`,
      r.timestamp,
      r.bleEvidence.rssi,
      r.bleEvidence.estimatedDistanceMeters,
      r.bleEvidence.isWithinClassroomRange ? 'YES' : 'NO',
      r.faceEvidence.matchScore,
      r.faceEvidence.livenessPassed ? 'PASS' : 'FAIL',
      r.faceEvidence.livenessChallenge,
      r.decision.status,
      `"${r.decision.reason}"`,
      r.anomaly.riskScore,
      r.anomaly.riskLevel,
      r.anomaly.deviceClashDetected ? 'YES' : 'NO',
      r.verificationToken,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SMAP_Attendance_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Ledger Entries
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalLogs}</div>
          <span className="text-[11px] text-slate-400">Recorded attendance events</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Verified Rate
          </span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">
            {totalLogs > 0 ? Math.round((verifiedCount / totalLogs) * 100) : 0}%
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">{verifiedCount} verified in-room</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Flagged for Review
          </span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{flaggedCount}</div>
          <span className="text-[11px] text-amber-700">Borderline face or anomaly</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Device Proxy Clashes
          </span>
          <div className="text-2xl font-extrabold text-rose-600 mt-1">{deviceClashes}</div>
          <span className="text-[11px] text-rose-700">Hardware collision alerts</span>
        </div>
      </div>

      {/* Attendance Trends Visualization (Recharts) */}
      <AttendanceTrendChart courses={courses} records={records} students={students} />

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student, reg no, course, token..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-indigo-600"
            />
          </div>

          {/* Course Filter */}
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-indigo-600"
          >
            <option value="all">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-indigo-600"
          >
            <option value="all">All Decisions</option>
            <option value="VERIFIED_PRESENT">Verified Present</option>
            <option value="FLAGGED_REVIEW">Flagged for Review</option>
            <option value="REJECTED_ABSENT">Rejected Absent</option>
          </select>

          {/* Risk Level Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-indigo-600"
          >
            <option value="all">All Risk Levels</option>
            <option value="LOW">Low Risk</option>
            <option value="MODERATE">Moderate Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="CRITICAL">Critical Risk</option>
          </select>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV Ledger ({filtered.length})</span>
        </button>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="px-5 py-3.5">Student Information</th>
                <th className="px-5 py-3.5">Course</th>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">BLE Signal (RSSI)</th>
                <th className="px-5 py-3.5">Biometric Face</th>
                <th className="px-5 py-3.5">Risk Score</th>
                <th className="px-5 py-3.5">Decision Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    No attendance records match your active search filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Student */}
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900">{r.studentName}</div>
                      <span className="font-mono text-[11px] text-slate-500">{r.studentReg}</span>
                    </td>

                    {/* Course */}
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                        {r.courseCode}
                      </span>
                    </td>

                    {/* Timestamp */}
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-600">{r.timestamp}</td>

                    {/* BLE Evidence */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono font-bold ${
                            r.bleEvidence.isWithinClassroomRange ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {r.bleEvidence.rssi} dBm
                        </span>
                        <span className="text-[10px] text-slate-400">({r.bleEvidence.estimatedDistanceMeters}m)</span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold ${
                          r.bleEvidence.isWithinClassroomRange ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {r.bleEvidence.isWithinClassroomRange ? '✓ In Classroom' : '✕ Out of Bounds'}
                      </span>
                    </td>

                    {/* Biometrics */}
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-indigo-700">
                        {r.faceEvidence.matchScore}%
                      </span>
                      <span
                        className={`text-[10px] block font-semibold ${
                          r.faceEvidence.livenessPassed ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {r.faceEvidence.livenessPassed ? '✓ Liveness Pass' : '⚠ Spoof Flagged'}
                      </span>
                    </td>

                    {/* Risk Score */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.anomaly.riskLevel === 'LOW'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.anomaly.riskLevel === 'MODERATE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {r.anomaly.riskScore}/100 ({r.anomaly.riskLevel})
                      </span>
                      {r.anomaly.deviceClashDetected && (
                        <span className="block text-[10px] text-rose-600 font-bold mt-0.5">
                          ⚠ Hardware Clash
                        </span>
                      )}
                    </td>

                    {/* Decision */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
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

                    {/* Action */}
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setInspectRecord(r)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                      >
                        Inspect Evidence
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORENSIC EVIDENCE MODAL */}
      {inspectRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  Forensic Attendance Audit Report
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {inspectRecord.studentName} ({inspectRecord.studentReg})
                </h3>
                <p className="text-xs text-slate-500">
                  Course: <strong>{inspectRecord.courseCode} — {inspectRecord.courseTitle}</strong> • Time: <strong>{inspectRecord.timestamp}</strong>
                </p>
              </div>

              <button
                onClick={() => setInspectRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Decision Status Callout */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                inspectRecord.decision.status === 'VERIFIED_PRESENT'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : inspectRecord.decision.status === 'FLAGGED_REVIEW'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <div>
                <span className="text-xs font-bold block">
                  Final Decision: {inspectRecord.decision.status}
                </span>
                <p className="text-xs mt-0.5">{inspectRecord.decision.reason}</p>
                <span className="text-[10px] font-mono opacity-80 mt-1 block">
                  Rule Triggered: {inspectRecord.decision.ruleMatched} (Confidence: {inspectRecord.decision.compositeConfidence}%)
                </span>
              </div>
            </div>

            {/* Evidence 2-Column Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* BLE Proximity Evidence */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-indigo-600" />
                  BLE Proximity Evidence
                </span>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Beacon UUID:</span>
                  <code className="text-[10px] font-mono">{inspectRecord.bleEvidence.beaconUuid}</code>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Signal RSSI:</span>
                  <span className="font-mono font-bold text-emerald-700">{inspectRecord.bleEvidence.rssi} dBm</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Estimated Distance:</span>
                  <span className="font-mono">{inspectRecord.bleEvidence.estimatedDistanceMeters} meters</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Perimeter Status:</span>
                  <strong className={inspectRecord.bleEvidence.isWithinClassroomRange ? 'text-emerald-700' : 'text-rose-700'}>
                    {inspectRecord.bleEvidence.isWithinClassroomRange ? 'Inside Classroom' : 'Outside Boundary'}
                  </strong>
                </div>
              </div>

              {/* Facial Biometric Evidence */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  Facial Biometric Evidence
                </span>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Match Confidence:</span>
                  <span className="font-mono font-bold text-indigo-700">{inspectRecord.faceEvidence.matchScore}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Liveness Result:</span>
                  <span className={inspectRecord.faceEvidence.livenessPassed ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                    {inspectRecord.faceEvidence.livenessPassed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Challenge Prompt:</span>
                  <span className="capitalize font-mono">{inspectRecord.faceEvidence.livenessChallenge} challenge</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Lighting Quality:</span>
                  <span className="capitalize font-medium">{inspectRecord.faceEvidence.lightingQuality}</span>
                </div>
              </div>
            </div>

            {/* Risk & Anomaly Assessment */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                Anti-Proxy Anomaly Assessment
              </span>
              <p className="text-slate-600">{inspectRecord.anomaly.explanation}</p>
              {inspectRecord.anomaly.flags.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="font-semibold text-slate-700 text-[11px]">Security Flags Triggered:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[11px]">
                    {inspectRecord.anomaly.flags.map((flag, idx) => (
                      <li key={idx} className="text-amber-800 font-medium">
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Verification Token */}
            <div className="p-3 bg-slate-900 text-slate-300 rounded-xl text-xs flex items-center justify-between font-mono">
              <span>Token: {inspectRecord.verificationToken}</span>
              <span className="text-emerald-400 font-bold text-[10px]">ECDSA SHA-256 SIGNED</span>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setInspectRecord(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
