import { BleEvidence, FaceEvidence, DecisionResult, LectureSession } from '../types/attendance';
import { calculateSessionAttendancePercentage } from './attendanceCalculator';

/**
 * SMAP Rule-Based Attendance Decision Engine
 * Evaluates independent evidence streams (BLE Presence + BLE Connected Lesson Time + Real Face Detection)
 * to output deterministic, explainable attendance decisions.
 */
export function evaluateAttendanceDecision(
  ble: BleEvidence,
  face: FaceEvidence,
  session: LectureSession | null
): DecisionResult {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const breakdown = calculateSessionAttendancePercentage(ble, face, session?.lessonDurationMinutes ?? 60);

  // Baseline validation
  if (!session || !session.isActive) {
    return {
      status: 'REJECTED_ABSENT',
      ruleMatched: 'R0_NO_ACTIVE_SESSION',
      compositeConfidence: 0,
      reason: 'No active lecture session broadcasting in this room.',
      timestamp,
    };
  }

  // 0.5. Real Face Presence Check
  if (!face.faceDetected) {
    return {
      status: 'REJECTED_ABSENT',
      ruleMatched: 'R_NO_REAL_FACE_DETECTED',
      compositeConfidence: Math.min(25, face.matchScore),
      reason: 'No real human face was detected in front of the camera. Attendance scored 0%.',
      timestamp,
    };
  }

  // 1. Check Liveness first: Anti-Spoof Gate
  if (!face.livenessPassed) {
    return {
      status: 'REJECTED_ABSENT',
      ruleMatched: 'R_FACE_LIVENESS_FAILED',
      compositeConfidence: 20,
      reason: 'Facial liveness test failed. Replay or printed photo attack rejected (0%).',
      timestamp,
    };
  }

  // 1.5. Student Profile Passport vs Live Scanned Face Verification Gate
  if (face.passportMatched === false) {
    return {
      status: 'REJECTED_ABSENT',
      ruleMatched: 'R_PASSPORT_FACE_MISMATCH',
      compositeConfidence: 0,
      reason: `Scanned live face (${face.passportMatchScore ?? face.matchScore}%) does not match the student's profile passport photo. Attendance scored 0%.`,
      timestamp,
    };
  }

  // 2. Check BLE Beacon Presence Gate
  if (!ble.isWithinClassroomRange || ble.rssi < session.rssiThreshold) {
    return {
      status: 'REJECTED_ABSENT',
      ruleMatched: 'R_BLE_OUT_OF_BOUNDS',
      compositeConfidence: Math.round(face.matchScore * 0.3),
      reason: `BLE classroom beacon out of range (RSSI: ${ble.rssi} dBm, required: >= ${session.rssiThreshold} dBm). 0 min connected in classroom.`,
      timestamp,
    };
  }

  // 2.5. Check BLE Connected Duration throughout the lesson
  if (breakdown.bleTimePercentage < 50) {
    return {
      status: 'REJECTED_ABSENT',
      ruleMatched: 'R_BLE_DURATION_INSUFFICIENT',
      compositeConfidence: breakdown.attendancePercentage,
      reason: `BLE connected time too short (${breakdown.bleConnectedMinutes}/${breakdown.lessonDurationMinutes} min = ${breakdown.bleTimePercentage}%). Attendance scored ${breakdown.attendancePercentage}%.`,
      timestamp,
    };
  }

  if (breakdown.bleTimePercentage < 75) {
    return {
      status: 'FLAGGED_REVIEW',
      ruleMatched: 'R2_PARTIAL_BLE_LESSON_DURATION',
      compositeConfidence: breakdown.attendancePercentage,
      reason: `Partial BLE connection during lesson (${breakdown.bleConnectedMinutes}/${breakdown.lessonDurationMinutes} min = ${breakdown.bleTimePercentage}%). Attendance ${breakdown.attendancePercentage}% flagged for review.`,
      timestamp,
    };
  }

  // 3. Golden Rule: BLE Connected >= 75% of lesson + High Face Match (>= 85%) + Liveness Passed
  if (ble.isWithinClassroomRange && face.matchScore >= 85 && face.livenessPassed) {
    return {
      status: 'VERIFIED_PRESENT',
      ruleMatched: 'R1_MULTIMODAL_VERIFIED_OPTIMAL',
      compositeConfidence: breakdown.attendancePercentage,
      reason: `Verified ${breakdown.attendancePercentage}% attendance — BLE connected ${breakdown.bleConnectedMinutes}/${breakdown.lessonDurationMinutes} min (${breakdown.bleTimePercentage}%) & real face match (${face.matchScore}%).`,
      timestamp,
    };
  }

  // 4. Edge Rule: BLE in room, but Face Match is borderline (70% - 84%) e.g. glasses/lighting
  if (ble.isWithinClassroomRange && face.matchScore >= 70 && face.livenessPassed) {
    return {
      status: 'FLAGGED_REVIEW',
      ruleMatched: 'R2_BIOMETRIC_BORDERLINE_REVIEW',
      compositeConfidence: breakdown.attendancePercentage,
      reason: `BLE connected ${breakdown.bleConnectedMinutes}/${breakdown.lessonDurationMinutes} min, but facial match is borderline (${face.matchScore}%). Attendance ${breakdown.attendancePercentage}% sent for review.`,
      timestamp,
    };
  }

  // 5. Face verification below 70%: record face percentage and combine with other verification steps (do not mark absent)
  return {
    status: 'FLAGGED_REVIEW',
    ruleMatched: 'R2_LOW_FACE_COMBINED_STEPS',
    compositeConfidence: breakdown.attendancePercentage,
    reason: `Face verification (${face.matchScore}%) is below 70% threshold — recorded ${face.matchScore}% (×0.3) and added to BLE lesson presence (${breakdown.bleTimePercentage}% ×0.7) for ${breakdown.attendancePercentage}% combined attendance (not marked absent).`,
    timestamp,
  };
}
