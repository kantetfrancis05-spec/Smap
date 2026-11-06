export interface Course {
  id: string;
  code: string;
  title: string;
  lecturerName: string;
  room: string;
  credits: number;
  totalLectures: number;
  beaconUuid: string;
  beaconMajor: number;
  beaconMinor: number;
}

export interface Student {
  id: string;
  regNumber: string;
  name: string;
  department: string;
  year: number;
  registeredDeviceId: string;
  biometricEnrolled: boolean;
  avatarSeed: string;
}

export interface BleEvidence {
  beaconUuid: string;
  major: number;
  minor: number;
  rssi: number; // e.g. -64 dBm
  estimatedDistanceMeters: number;
  isWithinClassroomRange: boolean; // RSSI >= -78 dBm & distance <= 12m
  timestamp: string;
}

export interface FaceEvidence {
  faceDetected: boolean;
  matchScore: number; // 0 - 100%
  livenessPassed: boolean;
  livenessChallenge: 'blink' | 'nod' | 'smile' | 'tilt';
  lightingQuality: 'good' | 'poor' | 'fair';
  timestamp: string;
}

export type DecisionStatus = 'VERIFIED_PRESENT' | 'FLAGGED_REVIEW' | 'LATE' | 'REJECTED_ABSENT';

export interface DecisionResult {
  status: DecisionStatus;
  ruleMatched: string;
  compositeConfidence: number;
  reason: string;
  timestamp: string;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface AnomalyAssessment {
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  flags: string[];
  deviceClashDetected: boolean;
  signalInconsistencyDetected: boolean;
  livenessSpoofSuspected: boolean;
  velocityAnomalyDetected: boolean;
  explanation: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  courseCode: string;
  courseTitle: string;
  studentReg: string;
  studentName: string;
  timestamp: string;
  bleEvidence: BleEvidence;
  faceEvidence: FaceEvidence;
  decision: DecisionResult;
  anomaly: AnomalyAssessment;
  verificationToken: string;
}

export interface LectureSession {
  id: string;
  courseCode: string;
  courseTitle: string;
  lecturerName: string;
  room: string;
  startTime: string;
  expiresAt: string;
  isActive: boolean;
  otpCode: string;
  qrPayload: string;
  beaconUuid: string;
  beaconMajor: number;
  beaconMinor: number;
  txPower: number;
  rssiThreshold: number; // Minimum dBm to count as in-room (e.g. -78 dBm)
}

export interface FraudScenarioPreset {
  id: string;
  name: string;
  description: string;
  category: 'legitimate' | 'proxy_ble' | 'face_spoof' | 'device_clash';
  bleRssi: number;
  bleDistance: number;
  faceMatchScore: number;
  livenessPassed: boolean;
  deviceId: string;
  expectedDecision: DecisionStatus;
  expectedRiskLevel: RiskLevel;
}
