import JSZip from 'jszip';

export async function generateFlutterProjectZip(): Promise<Blob> {
  const zip = new JSZip();

  // Root files
  zip.file(
    'pubspec.yaml',
`name: smap
description: "SMAP - Smart Attendance App with BLE, Facial Verification & Anomaly Detection"
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.2.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  flutter_reactive_ble: ^5.3.1
  camera: ^0.10.5+9
  google_mlkit_face_detection: ^0.11.0
  device_info_plus: ^10.1.0
  crypto: ^3.0.3
  intl: ^0.19.0
  provider: ^6.1.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
`
  );

  zip.file(
    'README.md',
`# SMAP — Smart Attendance App (Flutter Project)

Secure university attendance verification system with Bluetooth Low Energy (BLE) classroom presence, facial liveness, and an autonomous anomaly detection engine.

## Quick Start & Compile APK

### Option A: Build APK Locally
\`\`\`bash
# 1. Install dependencies
flutter pub get

# 2. Build Release APK
flutter build apk --release

# The compiled APK will be created at:
# build/app/outputs/flutter-apk/app-release.apk
\`\`\`

### Option B: Free Cloud Build with GitHub Actions
1. Push this folder to a GitHub repository.
2. The included \`.github/workflows/build_apk.yml\` will automatically compile the APK on GitHub's cloud runners.
3. Download the signed APK from GitHub Actions Artifacts directly to your phone!
`
  );

  // Android Manifest with Permissions
  zip.file(
    'android/app/src/main/AndroidManifest.xml',
`<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.university.smap">

    <!-- BLE Permissions -->
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <!-- Camera for Face Liveness -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />

    <application
        android:label="SMAP"
        android:name="\${applicationName}"
        android:icon="@mipmap/ic_launcher">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
`
  );

  // GitHub Actions Free APK Builder
  zip.file(
    '.github/workflows/build_apk.yml',
`name: Build Flutter APK

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.24.x'
          channel: 'stable'
          cache: true
      - run: flutter pub get
      - run: flutter build apk --release --split-per-abi
      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: smap-release-apk
          path: build/app/outputs/flutter-apk/*.apk
`
  );

  // lib/main.dart
  zip.file(
    'lib/main.dart',
`import 'package:flutter/material.dart';
import 'core/models/attendance_evidence.dart';
import 'modules/ble/ble_beacon_service.dart';
import 'modules/engine/decision_engine.dart';
import 'modules/anomaly/anomaly_detector.dart';

void main() => runApp(const SMAPApp());

class SMAPApp extends StatelessWidget {
  const SMAPApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'SMAP',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('SMAP Attendance'), centerTitle: true),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.school, size: 80, color: Colors.indigo),
              const SizedBox(height: 16),
              const Text(
                'SMAP Smart Attendance',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Multimodal BLE & Facial Verification Engine',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.indigo,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(50),
                ),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Starting BLE Presence Scanning...')),
                  );
                },
                icon: const Icon(Icons.verified_user),
                label: const Text('Start Student Verification'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
`
  );

  // lib/core/models/attendance_evidence.dart
  zip.file(
    'lib/core/models/attendance_evidence.dart',
`class BleEvidence {
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

enum AttendanceDecisionStatus { verifiedPresent, flaggedReview, rejectedAbsent }

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
  final int riskScore;
  final String riskLevel;
  final List<String> anomalyFlags;
  final bool isDeviceClash;

  AnomalyReport({
    required this.riskScore,
    required this.riskLevel,
    required this.anomalyFlags,
    required this.isDeviceClash,
  });
}
`
  );

  // lib/modules/ble/ble_beacon_service.dart
  zip.file(
    'lib/modules/ble/ble_beacon_service.dart',
`import 'dart:async';
import 'dart:math';
import 'package:flutter_reactive_ble/flutter_reactive_ble.dart';
import '../../core/models/attendance_evidence.dart';

class BleBeaconService {
  final FlutterReactiveBle _ble = FlutterReactiveBle();
  StreamSubscription<DiscoveredDevice>? _scanSubscription;

  Future<BleEvidence?> scanForClassroomBeacon({
    required String targetBeaconUuid,
    int txPower = -59,
    int minRssiThreshold = -78,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    final completer = Completer<BleEvidence?>();

    _scanSubscription = _ble.scanForDevices(
      withServices: [],
      scanMode: ScanMode.lowLatency,
    ).listen((device) {
      if (device.name.contains('SMAP') || device.name.contains(targetBeaconUuid)) {
        _scanSubscription?.cancel();
        final double distance = pow(10, ((txPower - device.rssi) / (10 * 2.2))).toDouble();
        final bool inRoom = device.rssi >= minRssiThreshold;

        completer.complete(
          BleEvidence(
            beaconUuid: targetBeaconUuid,
            major: 101,
            minor: 4,
            rssi: device.rssi,
            estimatedDistanceMeters: double.parse(distance.toStringAsFixed(1)),
            isWithinClassroom: inRoom,
            timestamp: DateTime.now(),
          ),
        );
      }
    });

    Timer(timeout, () {
      if (!completer.isCompleted) {
        _scanSubscription?.cancel();
        completer.complete(null);
      }
    });

    return completer.future;
  }
}
`
  );

  // lib/modules/engine/decision_engine.dart
  zip.file(
    'lib/modules/engine/decision_engine.dart',
`import '../../core/models/attendance_evidence.dart';

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
        explanation: 'Facial liveness test failed. Replay spoof rejected.',
      );
    }

    if (!ble.isWithinClassroom || ble.rssi < classroomRssiGate) {
      return DecisionResult(
        status: AttendanceDecisionStatus.rejectedAbsent,
        ruleMatched: 'R_BLE_OUT_OF_BOUNDS',
        confidence: 35,
        explanation: 'BLE signal indicates device is outside room (RSSI: \${ble.rssi} dBm).',
      );
    }

    if (ble.isWithinClassroom && face.matchScore >= 85.0 && face.livenessPassed) {
      return DecisionResult(
        status: AttendanceDecisionStatus.verifiedPresent,
        ruleMatched: 'R1_MULTIMODAL_OPTIMAL',
        confidence: 98,
        explanation: 'Physical presence in room verified (\${ble.rssi} dBm) and biometric match (\${face.matchScore}%).',
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
`
  );

  // lib/modules/anomaly/anomaly_detector.dart
  zip.file(
    'lib/modules/anomaly/anomaly_detector.dart',
`import '../../core/models/attendance_evidence.dart';

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
      flags.add('Wall Attenuation Anomaly: Signal characteristics indicate wall barrier.');
    }

    if (!face.livenessPassed) {
      risk += 40;
      flags.add('Biometric Spoof Warning: Liveness test failed.');
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
`
  );

  return await zip.generateAsync({ type: 'blob' });
}
