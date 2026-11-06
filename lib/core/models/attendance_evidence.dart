/// Core Multimodal Evidence Models for SMAP

class BleEvidence {
  final String beaconUuid;
  final int major;
  final int minor;
  final int rssi;
  final double estimatedDistanceMeters;
  final bool isWithinClassroom;
  final DateTime timestamp;

  BleEvidence({
    required this.beaconUuid,
    required this.major,
    required this.minor,
    required this.rssi,
    required this.estimatedDistanceMeters,
    required this.isWithinClassroom,
    required this.timestamp,
  });
}

class FaceEvidence {
  final bool faceDetected;
  final double matchScore;
  final bool livenessPassed;
  final String livenessChallenge;
  final DateTime timestamp;

  FaceEvidence({
    required this.faceDetected,
    required this.matchScore,
    required this.livenessPassed,
    required this.livenessChallenge,
    required this.timestamp,
  });
}

enum AttendanceDecisionStatus {
  verifiedPresent,
  flaggedReview,
  rejectedAbsent,
}

class DecisionResult {
  final AttendanceDecisionStatus status;
  final String ruleMatched;
  final int confidence;
  final String explanation;

  DecisionResult({
    required this.status,
    required this.ruleMatched,
    required this.confidence,
    required this.explanation,
  });
}

class AnomalyReport {
  final int riskScore; // 0 to 100
  final String riskLevel; // LOW, MODERATE, HIGH, CRITICAL
  final List<String> anomalyFlags;
  final bool isDeviceClash;

  AnomalyReport({
    required this.riskScore,
    required this.riskLevel,
    required this.anomalyFlags,
    required this.isDeviceClash,
  });
}
