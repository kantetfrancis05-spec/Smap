import { AttendanceRecord, BleEvidence, FaceEvidence } from '../types/attendance';

export interface AttendancePercentageBreakdown {
  attendancePercentage: number;
  bleTimePercentage: number;
  faceComponentPercentage: number;
  bleConnectedMinutes: number;
  lessonDurationMinutes: number;
  facePassed: boolean;
  summary: string;
}

/**
 * Calculates session attendance percentage (0 - 100%) driven by:
 * 1. Real Face Detection & Biometric Liveness (mandatory gate + 30% weight)
 * 2. BLE Connected Time throughout the lesson (key driver: 70% weight)
 */
export function calculateSessionAttendancePercentage(
  ble: BleEvidence,
  face: FaceEvidence,
  defaultLessonMinutes = 60
): AttendancePercentageBreakdown {
  const lessonDurationMinutes = Math.max(1, ble.lessonDurationMinutes ?? defaultLessonMinutes);
  const rawConnected = ble.bleConnectedMinutes ?? (ble.isWithinClassroomRange ? lessonDurationMinutes : 0);
  const bleConnectedMinutes = Math.max(0, Math.min(lessonDurationMinutes, rawConnected));

  const effectiveBleMinutes = ble.isWithinClassroomRange ? bleConnectedMinutes : Math.min(bleConnectedMinutes, 0);
  const bleTimePercentage = Math.round((effectiveBleMinutes / lessonDurationMinutes) * 100);

  // Mandatory gate: real face must be detected, liveness must pass, and passport face must match
  const facePassed = face.faceDetected && face.livenessPassed && face.passportMatched !== false;
  if (!facePassed) {
    return {
      attendancePercentage: 0,
      bleTimePercentage,
      faceComponentPercentage: 0,
      bleConnectedMinutes: effectiveBleMinutes,
      lessonDurationMinutes,
      facePassed: false,
      summary: !face.faceDetected
        ? '0% — No real face detected during biometric scan.'
        : !face.livenessPassed
        ? '0% — Facial liveness verification failed.'
        : '0% — Scanned face did not match student profile passport photo.',
    };
  }

  // If BLE was out of classroom bounds, connected lesson time is 0%
  if (!ble.isWithinClassroomRange) {
    return {
      attendancePercentage: 0,
      bleTimePercentage: 0,
      faceComponentPercentage: Math.round(face.matchScore),
      bleConnectedMinutes: 0,
      lessonDurationMinutes,
      facePassed: true,
      summary: '0% — BLE beacon out of classroom range (0 min connected).',
    };
  }

  const faceComponentPercentage = Math.max(0, Math.min(100, Math.round(face.matchScore)));

  // BLE connected time throughout the lesson carries 70% weight; Face detection/match carries 30%
  const weighted = bleTimePercentage * 0.7 + faceComponentPercentage * 0.3;
  const attendancePercentage = Math.max(0, Math.min(100, Math.round(weighted)));

  return {
    attendancePercentage,
    bleTimePercentage,
    faceComponentPercentage,
    bleConnectedMinutes: effectiveBleMinutes,
    lessonDurationMinutes,
    facePassed: true,
    summary: `${attendancePercentage}% (BLE Connected ${effectiveBleMinutes}/${lessonDurationMinutes} min [${bleTimePercentage}% × 0.7] + Face ${faceComponentPercentage}% [× 0.3])`,
  };
}

/**
 * Computes overall attendance percentage across a set of AttendanceRecords
 * using each record's calculated face + BLE-connected-time percentage.
 */
export function calculateOverallAttendancePercentage(records: AttendanceRecord[]): number {
  if (records.length === 0) return 0;
  const total = records.reduce((sum, r) => {
    if (typeof r.attendancePercentage === 'number') {
      return sum + r.attendancePercentage;
    }
    return sum + calculateSessionAttendancePercentage(r.bleEvidence, r.faceEvidence).attendancePercentage;
  }, 0);
  return Math.round(total / records.length);
}
