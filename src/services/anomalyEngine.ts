import { BleEvidence, FaceEvidence, Student, AnomalyAssessment, RiskLevel } from '../types/attendance';

export interface AnomalyEvaluationContext {
  student: Student;
  currentDeviceId: string;
  bleEvidence: BleEvidence;
  faceEvidence: FaceEvidence;
  recentDeviceCheckins: { deviceId: string; studentReg: string; timestamp: number }[];
  expectedClassroomRadiusMeters: number;
}

/**
 * SMAP Independent Risk & Anomaly Detection Engine
 * Operates autonomously from the decision engine to detect proxy attendance,
 * hardware spoofing, relay attacks, and biometric tampering.
 */
export function evaluateAnomalyRisk(context: AnomalyEvaluationContext): AnomalyAssessment {
  const flags: string[] = [];
  let riskScore = 0;

  let deviceClashDetected = false;
  let signalInconsistencyDetected = false;
  let livenessSpoofSuspected = false;
  let velocityAnomalyDetected = false;

  // 1. Device Fingerprint Anomaly Check (Proxy Spoofer Detection)
  // Check if current device was used for a DIFFERENT student in last 20 minutes
  const now = Date.now();
  const conflictingCheckin = context.recentDeviceCheckins.find(
    (entry) =>
      entry.deviceId === context.currentDeviceId &&
      entry.studentReg !== context.student.regNumber &&
      now - entry.timestamp < 20 * 60 * 1000
  );

  if (conflictingCheckin) {
    deviceClashDetected = true;
    riskScore += 45;
    flags.push(`Device Fingerprint Conflict: Hardware [${context.currentDeviceId.slice(0, 8)}...] was already used by ${conflictingCheckin.studentReg} in this session.`);
  }

  // Device not registered to student profile
  if (context.currentDeviceId !== context.student.registeredDeviceId) {
    riskScore += 20;
    flags.push(`Unregistered Device: Hardware UUID does not match student enrolled device profile.`);
  }

  // 2. BLE Signal Attenuation & Distance Inconsistency Check
  if (context.bleEvidence.estimatedDistanceMeters > context.expectedClassroomRadiusMeters) {
    signalInconsistencyDetected = true;
    riskScore += 30;
    flags.push(`BLE Range Anomaly: Signal indicates distance ~${context.bleEvidence.estimatedDistanceMeters}m, exceeding room boundary (${context.expectedClassroomRadiusMeters}m). Likely outside door or in hallway.`);
  }

  if (context.bleEvidence.rssi < -82 && context.bleEvidence.rssi > -95) {
    signalInconsistencyDetected = true;
    riskScore += 25;
    flags.push(`Severe Wall Signal Attenuation (RSSI: ${context.bleEvidence.rssi} dBm): Physical line-of-sight to classroom beacon obstructed by concrete wall.`);
  }

  // 3. Biometric Liveness & Synthetic Attack Check
  if (!context.faceEvidence.livenessPassed) {
    livenessSpoofSuspected = true;
    riskScore += 40;
    flags.push(`Biometric Anti-Spoof Warning: Passive or active liveness challenge failed. Static photo or screen playback replay pattern detected.`);
  } else if (context.faceEvidence.matchScore < 75) {
    riskScore += 15;
    flags.push(`Biometric Discrepancy: Face match confidence (${context.faceEvidence.matchScore}%) below safe tolerance.`);
  }

  // Clamp risk score to 0 - 100
  riskScore = Math.min(100, Math.max(0, riskScore));

  let riskLevel: RiskLevel = 'LOW';
  if (riskScore >= 75) {
    riskLevel = 'CRITICAL';
  } else if (riskScore >= 45) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 20) {
    riskLevel = 'MODERATE';
  } else {
    riskLevel = 'LOW';
  }

  let explanation = 'All telemetry signals within nominal parameters. No anomalous presence or device patterns detected.';
  if (riskScore > 0) {
    explanation = `${flags.length} risk factor(s) identified. Composite fraud risk evaluated at ${riskScore}/100 (${riskLevel} Risk).`;
  }

  return {
    riskScore,
    riskLevel,
    flags,
    deviceClashDetected,
    signalInconsistencyDetected,
    livenessSpoofSuspected,
    velocityAnomalyDetected,
    explanation,
  };
}
