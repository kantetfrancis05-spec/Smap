import '../../core/models/attendance_evidence.dart';

class AttendanceDecisionEngine {
  static DecisionResult evaluate({
    required BleEvidence ble,
    required FaceEvidence face,
    required int classroomRssiGate,
  }) {
    if (!face.livenessPassed) {
      return DecisionResult(
        status: AttendanceDecisionStatus.rejectedAbsent,
        ruleMatched: 'R_LIVENESS_FAILED',
        confidence: 20,
        explanation: 'Facial liveness test failed. Printed photo / replay spoof rejected.',
      );
    }

    if (!ble.isWithinClassroom || ble.rssi < classroomRssiGate) {
      return DecisionResult(
        status: AttendanceDecisionStatus.rejectedAbsent,
        ruleMatched: 'R_BLE_OUT_OF_BOUNDS',
        confidence: 35,
        explanation: 'BLE signal indicates device is in hallway or outside room (RSSI: ${ble.rssi} dBm).',
      );
    }

    if (ble.isWithinClassroom && face.matchScore >= 85.0 && face.livenessPassed) {
      return DecisionResult(
        status: AttendanceDecisionStatus.verifiedPresent,
        ruleMatched: 'R1_MULTIMODAL_OPTIMAL',
        confidence: 98,
        explanation: 'Physical presence in room verified (${ble.rssi} dBm) and biometric match (${face.matchScore}%).',
      );
    }

    if (face.matchScore >= 70.0) {
      return DecisionResult(
        status: AttendanceDecisionStatus.flaggedReview,
        ruleMatched: 'R2_BORDERLINE_BIOMETRIC_REVIEW',
        confidence: 72,
        explanation: 'BLE in room, but face match confidence is borderline. Forwarded to lecturer.',
      );
    }

    return DecisionResult(
      status: AttendanceDecisionStatus.rejectedAbsent,
      ruleMatched: 'R3_IDENTITY_MISMATCH',
      confidence: 10,
      explanation: 'Facial match failed. Does not match student template.',
    );
  }
}
