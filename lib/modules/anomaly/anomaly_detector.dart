import '../../core/models/attendance_evidence.dart';

class AnomalyDetector {
  static AnomalyReport evaluate({
    required BleEvidence ble,
    required FaceEvidence face,
    required String currentDeviceId,
    required String studentReg,
    required List<Map<String, dynamic>> recentDeviceHistory,
  }) {
    int risk = 0;
    final List<String> flags = [];

    final bool isClash = recentDeviceHistory.any((entry) =>
        entry['deviceId'] == currentDeviceId &&
        entry['studentReg'] != studentReg);

    if (isClash) {
      risk += 50;
      flags.add('Hardware Fingerprint Clash: Device was already used by another student.');
    }

    if (ble.rssi < -82 && ble.rssi > -95) {
      risk += 30;
      flags.add('Wall Attenuation Anomaly: Signal characteristics indicate transmission through concrete wall.');
    }

    if (!face.livenessPassed) {
      risk += 40;
      flags.add('Biometric Spoof Warning: Passive eye/motion liveness test failed.');
    }

    risk = risk.clamp(0, 100);

    String level = 'LOW';
    if (risk >= 75) level = 'CRITICAL';
    else if (risk >= 45) level = 'HIGH';
    else if (risk >= 20) level = 'MODERATE';

    return AnomalyReport(
      riskScore: risk,
      riskLevel: level,
      anomalyFlags: flags,
      isDeviceClash: isClash,
    );
  }
}
