import { BleEvidence, FaceEvidence, DecisionResult, LectureSession } from '../types/attendance';

/**
 * SMAP Rule-Based Attendance Decision Engine
 * Evaluates independent evidence streams (BLE Presence + Facial Liveness)
 * to output deterministic, explainable attendance decisions.
 */
export function evaluateAttendanceDecision(
  ble: BleEvidence,
  face: FaceEvidence,
  session: LectureSession | null
): DecisionResult {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

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

  // 1. Check Liveness first: Anti-Spoof Gate
  if (!face.livenessPassed) {
    return {
      status: 'REJECTED_ABSENT',
      ruleMatched: 'R_FACE_LIVENESS_FAILED',
      compositeConfidence: 20,
      reason: 'Facial liveness test failed. Replay or printed photo attack rejected.',
      timestamp,
    };
  }

  // 2. Check BLE Beacon Presence Gate
  if (!ble.isWithinClassroomRange || ble.rssi < session.rssiThreshold) {
    return {
      status: 'REJECTED_ABSENT',
      ruleMatched: 'R_BLE_OUT_OF_BOUNDS',
      compositeConfidence: Math.round(face.matchScore * 0.3),
      reason: `BLE classroom beacon out of range (RSSI: ${ble.rssi} dBm, required: >= ${session.rssiThreshold} dBm). Physical room presence unconfirmed.`,
      timestamp,
    };
  }

  // 3. Golden Rule: BLE Verified + High Face Match (>= 85%) + Liveness Passed
  if (ble.isWithinClassroomRange && face.matchScore >= 85 && face.livenessPassed) {
    const composite = Math.min(99, Math.round((face.matchScore * 0.6) + (Math.abs(ble.rssi) < 70 ? 38 : 32)));
    return {
      status: 'VERIFIED_PRESENT',
      ruleMatched: 'R1_MULTIMODAL_VERIFIED_OPTIMAL',
      compositeConfidence: composite,
      reason: `Verified in-room presence (BLE: ${ble.rssi} dBm, ~${ble.estimatedDistanceMeters}m) and biometric match (${face.matchScore}%).`,
      timestamp,
    };
  }

  // 4. Edge Rule: BLE in room, but Face Match is borderline (70% - 84%) e.g. glasses/lighting
  if (ble.isWithinClassroomRange && face.matchScore >= 70 && face.livenessPassed) {
    return {
      status: 'FLAGGED_REVIEW',
      ruleMatched: 'R2_BIOMETRIC_BORDERLINE_REVIEW',
      compositeConfidence: 74,
      reason: `Classroom BLE confirmed, but facial match is borderline (${face.matchScore}%). Sent to lecturer review queue.`,
      timestamp,
    };
  }

  // 5. Face match failed (< 70%)
  return {
    status: 'REJECTED_ABSENT',
    ruleMatched: 'R3_IDENTITY_MISMATCH',
    compositeConfidence: 15,
    reason: `Facial verification failed (${face.matchScore}% match). Face does not match registered student template.`,
    timestamp,
  };
}
