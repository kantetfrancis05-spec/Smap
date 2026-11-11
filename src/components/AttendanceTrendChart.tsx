import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { TrendingUp, Calendar, Users, CheckCircle2, AlertTriangle, BookOpen, BarChart3 } from 'lucide-react';
import { Course, AttendanceRecord, Student } from '../types/attendance';

interface AttendanceTrendChartProps {
  courses: Course[];
  records: AttendanceRecord[];
  students: Student[];
}

interface SessionDataPoint {
  sessionLabel: string;
  sessionDate: string;
  attendancePercent: number;
  presentCount: number;
  flaggedCount: number;
  absentCount: number;
  totalEnrolled: number;
  avgRssi: number;
  avgBiometricMatch: number;
}

// Historical session trend dataset generator
const COURSE_TREND_DATA: Record<string, SessionDataPoint[]> = {
  CS301: [
    { sessionLabel: 'Lec 1', sessionDate: 'Oct 02', attendancePercent: 96, presentCount: 48, flaggedCount: 1, absentCount: 1, totalEnrolled: 50, avgRssi: -62, avgBiometricMatch: 97.4 },
    { sessionLabel: 'Lec 2', sessionDate: 'Oct 07', attendancePercent: 92, presentCount: 46, flaggedCount: 2, absentCount: 2, totalEnrolled: 50, avgRssi: -65, avgBiometricMatch: 96.1 },
    { sessionLabel: 'Lec 3', sessionDate: 'Oct 14', attendancePercent: 88, presentCount: 44, flaggedCount: 3, absentCount: 3, totalEnrolled: 50, avgRssi: -67, avgBiometricMatch: 95.8 },
    { sessionLabel: 'Lec 4', sessionDate: 'Oct 21', attendancePercent: 94, presentCount: 47, flaggedCount: 1, absentCount: 2, totalEnrolled: 50, avgRssi: -63, avgBiometricMatch: 98.0 },
    { sessionLabel: 'Lec 5', sessionDate: 'Oct 28', attendancePercent: 86, presentCount: 43, flaggedCount: 4, absentCount: 3, totalEnrolled: 50, avgRssi: -69, avgBiometricMatch: 94.2 },
    { sessionLabel: 'Lec 6', sessionDate: 'Nov 02', attendancePercent: 90, presentCount: 45, flaggedCount: 2, absentCount: 3, totalEnrolled: 50, avgRssi: -64, avgBiometricMatch: 96.7 },
    { sessionLabel: 'Lec 7', sessionDate: 'Nov 06', attendancePercent: 98, presentCount: 49, flaggedCount: 0, absentCount: 1, totalEnrolled: 50, avgRssi: -61, avgBiometricMatch: 98.6 },
    { sessionLabel: 'Lec 8', sessionDate: 'Nov 10', attendancePercent: 92, presentCount: 46, flaggedCount: 2, absentCount: 2, totalEnrolled: 50, avgRssi: -64, avgBiometricMatch: 97.1 },
  ],
  CS305: [
    { sessionLabel: 'Lec 1', sessionDate: 'Oct 01', attendancePercent: 94, presentCount: 42, flaggedCount: 2, absentCount: 1, totalEnrolled: 45, avgRssi: -63, avgBiometricMatch: 96.5 },
    { sessionLabel: 'Lec 2', sessionDate: 'Oct 08', attendancePercent: 91, presentCount: 41, flaggedCount: 2, absentCount: 2, totalEnrolled: 45, avgRssi: -66, avgBiometricMatch: 95.2 },
    { sessionLabel: 'Lec 3', sessionDate: 'Oct 15', attendancePercent: 84, presentCount: 38, flaggedCount: 4, absentCount: 3, totalEnrolled: 45, avgRssi: -70, avgBiometricMatch: 93.9 },
    { sessionLabel: 'Lec 4', sessionDate: 'Oct 22', attendancePercent: 89, presentCount: 40, flaggedCount: 3, absentCount: 2, totalEnrolled: 45, avgRssi: -65, avgBiometricMatch: 96.0 },
    { sessionLabel: 'Lec 5', sessionDate: 'Oct 29', attendancePercent: 93, presentCount: 42, flaggedCount: 1, absentCount: 2, totalEnrolled: 45, avgRssi: -62, avgBiometricMatch: 97.8 },
    { sessionLabel: 'Lec 6', sessionDate: 'Nov 05', attendancePercent: 87, presentCount: 39, flaggedCount: 3, absentCount: 3, totalEnrolled: 45, avgRssi: -68, avgBiometricMatch: 94.6 },
    { sessionLabel: 'Lec 7', sessionDate: 'Nov 09', attendancePercent: 96, presentCount: 43, flaggedCount: 1, absentCount: 1, totalEnrolled: 45, avgRssi: -60, avgBiometricMatch: 98.2 },
  ],
  MATH201: [
    { sessionLabel: 'Lec 1', sessionDate: 'Oct 03', attendancePercent: 92, presentCount: 55, flaggedCount: 3, absentCount: 2, totalEnrolled: 60, avgRssi: -64, avgBiometricMatch: 96.0 },
    { sessionLabel: 'Lec 2', sessionDate: 'Oct 10', attendancePercent: 85, presentCount: 51, flaggedCount: 5, absentCount: 4, totalEnrolled: 60, avgRssi: -68, avgBiometricMatch: 94.5 },
    { sessionLabel: 'Lec 3', sessionDate: 'Oct 17', attendancePercent: 80, presentCount: 48, flaggedCount: 6, absentCount: 6, totalEnrolled: 60, avgRssi: -71, avgBiometricMatch: 93.1 },
    { sessionLabel: 'Lec 4', sessionDate: 'Oct 24', attendancePercent: 88, presentCount: 53, flaggedCount: 4, absentCount: 3, totalEnrolled: 60, avgRssi: -66, avgBiometricMatch: 95.8 },
    { sessionLabel: 'Lec 5', sessionDate: 'Oct 31', attendancePercent: 95, presentCount: 57, flaggedCount: 1, absentCount: 2, totalEnrolled: 60, avgRssi: -62, avgBiometricMatch: 97.9 },
    { sessionLabel: 'Lec 6', sessionDate: 'Nov 07', attendancePercent: 89, presentCount: 53, flaggedCount: 3, absentCount: 4, totalEnrolled: 60, avgRssi: -65, avgBiometricMatch: 96.2 },
  ],
  CS310: [
    { sessionLabel: 'Lec 1', sessionDate: 'Oct 04', attendancePercent: 95, presentCount: 38, flaggedCount: 1, absentCount: 1, totalEnrolled: 40, avgRssi: -61, avgBiometricMatch: 98.1 },
    { sessionLabel: 'Lec 2', sessionDate: 'Oct 11', attendancePercent: 90, presentCount: 36, flaggedCount: 2, absentCount: 2, totalEnrolled: 40, avgRssi: -64, avgBiometricMatch: 96.4 },
    { sessionLabel: 'Lec 3', sessionDate: 'Oct 18', attendancePercent: 92, presentCount: 37, flaggedCount: 1, absentCount: 2, totalEnrolled: 40, avgRssi: -63, avgBiometricMatch: 97.0 },
    { sessionLabel: 'Lec 4', sessionDate: 'Oct 25', attendancePercent: 88, presentCount: 35, flaggedCount: 3, absentCount: 2, totalEnrolled: 40, avgRssi: -67, avgBiometricMatch: 95.1 },
    { sessionLabel: 'Lec 5', sessionDate: 'Nov 01', attendancePercent: 95, presentCount: 38, flaggedCount: 1, absentCount: 1, totalEnrolled: 40, avgRssi: -62, avgBiometricMatch: 97.9 },
    { sessionLabel: 'Lec 6', sessionDate: 'Nov 08', attendancePercent: 93, presentCount: 37, flaggedCount: 2, absentCount: 1, totalEnrolled: 40, avgRssi: -64, avgBiometricMatch: 97.3 },
  ],
};

// Custom tooltip renderer for Recharts
const CustomRechartsTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data: SessionDataPoint = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-700 shadow-xl text-xs space-y-2 min-w-[210px]">
        <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
          <span className="font-bold text-indigo-300">{data.sessionLabel}</span>
          <span className="text-[11px] font-mono text-slate-400">{data.sessionDate}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Attendance Rate:</span>
          <span className="font-extrabold text-sm text-emerald-400 font-mono">
            {data.attendancePercent}%
          </span>
        </div>

        <div className="space-y-1 text-[11px] pt-1 border-t border-slate-800">
          <div className="flex justify-between text-slate-300">
            <span>Verified Present:</span>
            <strong className="text-white font-mono">{data.presentCount}/{data.totalEnrolled}</strong>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Flagged for Review:</span>
            <span className="text-amber-300 font-mono">{data.flaggedCount}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Absent / Unverified:</span>
            <span className="text-rose-400 font-mono">{data.absentCount}</span>
          </div>
        </div>

        <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
          <span>Avg BLE Signal: {data.avgRssi} dBm</span>
          <span>Face: {data.avgBiometricMatch}%</span>
        </div>
      </div>
    );
  }
  return null;
};

export const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({
  courses,
  records,
  students,
}) => {
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(courses[0]?.code || 'CS301');

  // Active course object
  const activeCourse = useMemo(() => {
    return courses.find((c) => c.code === selectedCourseCode) || courses[0];
  }, [courses, selectedCourseCode]);

  // Data points for selected course
  const chartData = useMemo<SessionDataPoint[]>(() => {
    if (COURSE_TREND_DATA[selectedCourseCode]) {
      return COURSE_TREND_DATA[selectedCourseCode];
    }
    // Fallback: CS301 default
    return COURSE_TREND_DATA['CS301'];
  }, [selectedCourseCode]);

  // Derived metrics for summary cards
  const metrics = useMemo(() => {
    if (chartData.length === 0) {
      return { avg: 90, peak: 98, low: 84, trend: '+4.2%' };
    }
    const sum = chartData.reduce((acc, curr) => acc + curr.attendancePercent, 0);
    const avg = Math.round(sum / chartData.length);
    const peak = Math.max(...chartData.map((d) => d.attendancePercent));
    const low = Math.min(...chartData.map((d) => d.attendancePercent));

    const first = chartData[0].attendancePercent;
    const last = chartData[chartData.length - 1].attendancePercent;
    const diff = last - first;
    const trend = `${diff >= 0 ? '+' : ''}${diff}%`;

    return { avg, peak, low, trend };
  }, [chartData]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header and Course Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              Course Attendance Trends Over Time
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Historical attendance percentage per session with BLE perimeter & biometric verification
          </p>
        </div>

        {/* Course Dropdown Selector */}
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedCourseCode}
            onChange={(e) => setSelectedCourseCode(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-indigo-600 cursor-pointer shadow-2xs"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.code}>
                {course.code} — {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Trend Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Average Attendance
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-2xl font-extrabold text-slate-900">{metrics.avg}%</span>
            <span className="text-xs font-bold text-emerald-600">✓ Eligible</span>
          </div>
          <span className="text-[10px] text-slate-400">Min. required: 75%</span>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Peak Session Rate
          </span>
          <div className="text-2xl font-extrabold text-indigo-700 mt-0.5">
            {metrics.peak}%
          </div>
          <span className="text-[10px] text-slate-400">Highest recorded presence</span>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Lowest Session Rate
          </span>
          <div className="text-2xl font-extrabold text-amber-600 mt-0.5">
            {metrics.low}%
          </div>
          <span className="text-[10px] text-slate-400">Mid-semester trough</span>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Semester Trend
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span className="text-2xl font-extrabold text-emerald-600">{metrics.trend}</span>
          </div>
          <span className="text-[10px] text-slate-400">Overall cohort growth</span>
        </div>
      </div>

      {/* Main Recharts Area Chart */}
      <div className="w-full h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4338ca" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#4338ca" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

            <XAxis
              dataKey="sessionLabel"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
            />

            <YAxis
              domain={[60, 100]}
              tickCount={5}
              unit="%"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
            />

            <Tooltip content={<CustomRechartsTooltip />} />

            {/* University 75% Exam Eligibility Benchmark Threshold */}
            <ReferenceLine
              y={75}
              stroke="#e11d48"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'Exam Eligibility Gate (75%)',
                position: 'insideTopRight',
                fill: '#e11d48',
                fontSize: 10,
                fontWeight: 600,
              }}
            />

            <Area
              type="monotone"
              dataKey="attendancePercent"
              name="Attendance Rate"
              stroke="#4338ca"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#attendanceGradient)"
              activeDot={{ r: 6, fill: '#4338ca', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Legend & Classroom Context */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-indigo-700" />
            <span className="font-semibold text-slate-700">Verified Attendance %</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-500" />
            <span className="text-rose-600 font-semibold">75% Exam Eligibility Limit</span>
          </span>
        </div>

        <span className="font-mono text-[11px] text-slate-400">
          Room: {activeCourse.room} • Lecturer: {activeCourse.lecturerName}
        </span>
      </div>
    </div>
  );
};
