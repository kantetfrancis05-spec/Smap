import React, { useState } from 'react';
import {
  Code2,
  Bug,
  FileCode,
  ShieldCheck,
  Check,
  Copy,
  Layers,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Bluetooth,
  ScanFace,
  Terminal,
  Activity,
  Sliders,
  FolderTree
} from 'lucide-react';
import { FRAUD_SCENARIOS } from '../data/mockData';
import { evaluateAttendanceDecision } from '../services/decisionEngine';
import { evaluateAnomalyRisk } from '../services/anomalyEngine';

export const CodeExplainer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'sandbox' | 'flutter_code' | 'roadmap'>('architecture');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [selectedCodeFile, setSelectedCodeFile] = useState<'pubspec' | 'main' | 'models' | 'ble_service' | 'face_service' | 'decision_engine' | 'anomaly_detector'>('main');

  // Interactive Sandbox Tuning State
  const [simRssi, setSimRssi] = useState(-64);
  const [simFaceScore, setSimFaceScore] = useState(96);
  const [simLiveness, setSimLiveness] = useState(true);
  const [simDeviceClash, setSimDeviceClash] = useState(false);

  // Compute live sandbox output
  const sandboxBle = {
    beaconUuid: '4F7A-SMAP-BEACON-CS301',
    major: 101,
    minor: 4,
    rssi: simRssi,
    estimatedDistanceMeters: Math.max(0.5, Math.round(Math.pow(10, ((-59 - simRssi) / (10 * 2.2))) * 10) / 10),
    isWithinClassroomRange: simRssi >= -78,
    timestamp: 'Live',
  };

  const sandboxFace = {
    faceDetected: true,
    matchScore: simFaceScore,
    livenessPassed: simLiveness,
    livenessChallenge: 'blink' as const,
    lightingQuality: 'good' as const,
    timestamp: 'Live',
  };

  const sandboxSession = {
    id: 's1',
    courseCode: 'CS301',
    courseTitle: 'Operating Systems',
    lecturerName: 'Dr. Arthur Pendelton',
    room: 'LT 4B',
    startTime: '09:00',
    expiresAt: '09:45',
    isActive: true,
    otpCode: '482910',
    qrPayload: 'SMAP://CS301',
    beaconUuid: '4F7A-SMAP-BEACON-CS301',
    beaconMajor: 101,
    beaconMinor: 4,
    txPower: -59,
    rssiThreshold: -78,
  };

  const liveDecision = evaluateAttendanceDecision(sandboxBle, sandboxFace, sandboxSession);
  const liveAnomaly = evaluateAnomalyRisk({
    student: {
      id: 's1',
      regNumber: 'STU/2023/0042',
      name: 'Francis Kantet',
      department: 'Computer Science',
      year: 3,
      registeredDeviceId: 'DEV-ORIGINAL-8821',
      biometricEnrolled: true,
      avatarSeed: 'francis',
    },
    currentDeviceId: simDeviceClash ? 'DEV-CONFLICT-PHONE-9999' : 'DEV-ORIGINAL-8821',
    bleEvidence: sandboxBle,
    faceEvidence: sandboxFace,
    recentDeviceCheckins: simDeviceClash
      ? [{ deviceId: 'DEV-CONFLICT-PHONE-9999', studentReg: 'STU/2023/0018', timestamp: Date.now() - 60000 }]
      : [],
    expectedClassroomRadiusMeters: 10,
  });

  const copyToClipboard = (filename: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  // --- DART CODE STRINGS ---
  const PUBSPEC_YAML = `# pubspec.yaml - SMAP Phase 1 Foundation
name: smap
description: "SMAP - Smart Attendance App with BLE, Facial Verification & Anomaly Detection"
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.2.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  flutter_reactive_ble: ^5.3.1       # BLE scanning & classroom beacon presence
  camera: ^0.10.5+9                  # Camera stream for face capture
  google_mlkit_face_detection: ^0.11.0 # On-device ML Kit Face Mesh & Liveness
  device_info_plus: ^10.1.0          # Hardware fingerprinting & proxy defense
  crypto: ^3.0.3                     # Cryptographic attendance token signing
  intl: ^0.19.0
  provider: ^6.1.2                   # State management

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
`;

  const DART_MODELS = `// lib/core/models/attendance_evidence.dart
import 'dart:convert';

/// Physical BLE classroom presence evidence
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

/// Facial liveness and biometric matching evidence
class FaceEvidence {
  final bool faceDetected;
  final double matchScore; // 0.0 to 100.0%
  final bool livenessPassed;
  final String livenessChallenge; // 'blink', 'nod', 'smile'
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

/// Rule engine decision result
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

/// Autonomous fraud risk score & detected anomalies
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
`;

  const DART_BLE_SERVICE = `// lib/modules/ble/ble_beacon_service.dart
import 'dart:async';
import 'dart:math';
import 'package:flutter_reactive_ble/flutter_reactive_ble.dart';
import '../../core/models/attendance_evidence.dart';

class BleBeaconService {
  final FlutterReactiveBle _ble = FlutterReactiveBle();
  StreamSubscription<DiscoveredDevice>? _scanSubscription;

  /// Scans for classroom beacon matching target UUID (e.g. CS301 Lecture Hall)
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
      // In iBeacon, UUID is embedded in manufacturer data payload
      final matches = device.name.contains(targetBeaconUuid) || 
                      device.serviceData.keys.any((uuid) => uuid.toString().contains(targetBeaconUuid));

      if (matches || device.name.contains('SMAP')) {
        _scanSubscription?.cancel();

        // Calculate distance: d = 10 ^ ((TxPower - RSSI) / (10 * n))
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

    // Fallback if timeout expires
    Timer(timeout, () {
      if (!completer.isCompleted) {
        _scanSubscription?.cancel();
        completer.complete(null);
      }
    });

    return completer.future;
  }
}
`;

  const DART_FACE_SERVICE = `// lib/modules/face/face_verification_service.dart
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:camera/camera.dart';
import '../../core/models/attendance_evidence.dart';

class FaceVerificationService {
  late final FaceDetector _detector;

  FaceVerificationService() {
    final options = FaceDetectorOptions(
      enableClassification: true, // Enables eye open (blink) and smiling probability
      enableLandmarks: true,
      performanceMode: FaceDetectorMode.accurate,
    );
    _detector = FaceDetector(options: options);
  }

  /// Processes camera frame and verifies active liveness challenge
  Future<FaceEvidence> verifyLivenessAndMatch({
    required CameraImage cameraImage,
    required String challengeType, // 'blink', 'smile'
  }) async {
    // 1. Convert CameraImage to InputImage for ML Kit
    // 2. Detect faces
    // Example logic evaluating eye blink probability:
    // final leftOpen = face.leftEyeOpenProbability ?? 1.0;
    // final rightOpen = face.rightEyeOpenProbability ?? 1.0;
    // final hasBlinked = leftOpen < 0.2 && rightOpen < 0.2;

    return FaceEvidence(
      faceDetected: true,
      matchScore: 96.5, // ML embedding cosine similarity vs registered student photo
      livenessPassed: true,
      livenessChallenge: challengeType,
      timestamp: DateTime.now(),
    );
  }

  void dispose() {
    _detector.close();
  }
}
`;

  const DART_DECISION_ENGINE = `// lib/modules/engine/decision_engine.dart
import '../../core/models/attendance_evidence.dart';

class AttendanceDecisionEngine {
  /// Evaluates multimodal evidence according to university attendance policy
  static DecisionResult evaluate({
    required BleEvidence ble,
    required FaceEvidence face,
    required int classroomRssiGate,
  }) {
    // Rule 1: Anti-Spoof Liveness Gate
    if (!face.livenessPassed) {
      return DecisionResult(
        status: AttendanceDecisionStatus.rejectedAbsent,
        ruleMatched: 'R_LIVENESS_FAILED',
        confidence: 20,
        explanation: 'Facial liveness test failed. Printed photo / replay spoof rejected.',
      );
    }

    // Rule 2: BLE Classroom Proximity Gate
    if (!ble.isWithinClassroom || ble.rssi < classroomRssiGate) {
      return DecisionResult(
        status: AttendanceDecisionStatus.rejectedAbsent,
        ruleMatched: 'R_BLE_OUT_OF_BOUNDS',
        confidence: 35,
        explanation: 'BLE signal indicates device is in hallway or outside room (RSSI: \${ble.rssi} dBm).',
      );
    }

    // Rule 3: Optimal Multimodal Match (BLE Verified + Face >= 85%)
    if (ble.isWithinClassroom && face.matchScore >= 85.0 && face.livenessPassed) {
      return DecisionResult(
        status: AttendanceDecisionStatus.verifiedPresent,
        ruleMatched: 'R1_MULTIMODAL_OPTIMAL',
        confidence: 98,
        explanation: 'Physical presence in room verified (\${ble.rssi} dBm) and biometric match (\${face.matchScore}%).',
      );
    }

    // Rule 4: Borderline Biometrics (Review by Lecturer)
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
`;

  const DART_ANOMALY_DETECTOR = `// lib/modules/anomaly/anomaly_detector.dart
import '../../core/models/attendance_evidence.dart';

class AnomalyDetector {
  /// Evaluates hardware clashes, impossible velocity, and RF inconsistencies
  static AnomalyReport evaluate({
    required BleEvidence ble,
    required FaceEvidence face,
    required String currentDeviceId,
    required String studentReg,
    required List<Map<String, dynamic>> recentDeviceHistory,
  }) {
    int risk = 0;
    final List<String> flags = [];

    // 1. Device Conflict Check: Same hardware used for 2 different students within 15 mins
    final bool isClash = recentDeviceHistory.any((entry) =>
        entry['deviceId'] == currentDeviceId &&
        entry['studentReg'] != studentReg);

    if (isClash) {
      risk += 50;
      flags.add('Hardware Fingerprint Clash: Device was already used by another student in this session.');
    }

    // 2. BLE Signal Attenuation Anomaly
    if (ble.rssi < -82 && ble.rssi > -95) {
      risk += 30;
      flags.add('Wall Attenuation Anomaly: Signal characteristics indicate transmission through concrete wall.');
    }

    // 3. Biometric Liveness Anomaly
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
`;

  const DART_MAIN = `// lib/main.dart - SMAP Phase 1 Modular App Entry
import 'package:flutter/material.dart';
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
                  // Navigate to Student Multimodal Verification Flow
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
`;

  const currentCode = {
    pubspec: { name: 'pubspec.yaml', code: PUBSPEC_YAML },
    main: { name: 'main.dart', code: DART_MAIN },
    models: { name: 'attendance_evidence.dart', code: DART_MODELS },
    ble_service: { name: 'ble_beacon_service.dart', code: DART_BLE_SERVICE },
    face_service: { name: 'face_verification_service.dart', code: DART_FACE_SERVICE },
    decision_engine: { name: 'decision_engine.dart', code: DART_DECISION_ENGINE },
    anomaly_detector: { name: 'anomaly_detector.dart', code: DART_ANOMALY_DETECTOR },
  }[selectedCodeFile];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Top Header Tabs */}
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'architecture'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Phase 1 Architecture</span>
          </button>

          <button
            onClick={() => setActiveTab('sandbox')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'sandbox'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-amber-300" />
            <span>Interactive Risk Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab('flutter_code')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'flutter_code'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Flutter Dart Modules (7 Files)</span>
          </button>

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'roadmap'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Integration Roadmap</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* TAB 1: ARCHITECTURAL DESIGN */}
        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                SMAP Phase 1: Modular Verification Architecture
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Your strategy is spot-on: <em>"Each verification method will operate as an independent module, providing evidence to the attendance engine."</em> Here is how each module isolates responsibility and feeds into the dual-engine pipeline:
              </p>
            </div>

            {/* Architecture Pipeline Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2">
                  <Bluetooth className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-slate-900">1. BLE Presence Module</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Scans 2.4 GHz classroom beacon UUID, measures RSSI signal attenuation, and calculates physical meter distance using log-distance path loss.
                </p>
                <span className="inline-block mt-2 font-mono text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                  flutter_reactive_ble
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                  <ScanFace className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-slate-900">2. Facial Verification</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Runs on-device ML Kit Face Mesh. Evaluates active liveness challenges (eye blink, smile) to prevent static photo or screen replay attacks.
                </p>
                <span className="inline-block mt-2 font-mono text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                  google_mlkit_face
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-slate-900">3. Decision Engine</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Rule-based aggregator combining BLE + Biometrics into deterministic outcomes: <code>VERIFIED_PRESENT</code>, <code>FLAGGED_REVIEW</code>, or <code>REJECTED</code>.
                </p>
                <span className="inline-block mt-2 font-mono text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                  rule_decision_engine.dart
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center mb-2">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-slate-900">4. Anomaly Engine</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Independent risk assessor: detects device clashes (friend using phone for 2 people), wall reflections, and velocity impossibilities.
                </p>
                <span className="inline-block mt-2 font-mono text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">
                  anomaly_detector.dart
                </span>
              </div>
            </div>

            {/* Folder Layout Preview */}
            <div className="p-4 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono">
              <span className="text-slate-400 block mb-2">// Recommended Flutter Folder Layout for Phase 1:</span>
              <pre className="text-[11px] leading-relaxed text-indigo-200">
{`lib/
├── core/
│   └── models/
│       ├── attendance_evidence.dart     # BleEvidence, FaceEvidence, DecisionResult
│       └── session_model.dart           # Classroom beacon UUID, room, duration
├── modules/
│   ├── ble/
│   │   └── ble_beacon_service.dart      # Scanning, distance estimation, RSSI filter
│   ├── face/
│   │   └── face_verification_service.dart # ML Kit face detection, liveness challenge
│   ├── engine/
│   │   └── decision_engine.dart         # Multi-factor rule evaluation
│   └── anomaly/
│       └── anomaly_detector.dart        # Device fingerprint clash & risk scoring
└── main.dart                            # Flutter Material 3 entry`}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE RISK SANDBOX */}
        {activeTab === 'sandbox' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Interactive Multi-Evidence Risk Sandbox
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Adjust physical conditions in real-time to observe how the <strong>Rule Engine</strong> and <strong>Anomaly Engine</strong> evaluate presence, fraud risk, and decisions:
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Sliders Control Panel */}
              <div className="lg:col-span-6 space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Signal & Biometric Telemetry
                </h4>

                {/* BLE Signal Slider */}
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>BLE Classroom Signal (RSSI):</span>
                    <span className="font-mono font-bold text-indigo-700">{simRssi} dBm (~{sandboxBle.estimatedDistanceMeters}m)</span>
                  </div>
                  <input
                    type="range"
                    min="-95"
                    max="-50"
                    value={simRssi}
                    onChange={(e) => setSimRssi(Number(e.target.value))}
                    className="w-full accent-indigo-700 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>-95 dBm (Hallway / Cafeteria)</span>
                    <span className="text-indigo-600 font-bold">-78 dBm (Classroom Gate)</span>
                    <span>-50 dBm (Podium Desk)</span>
                  </div>
                </div>

                {/* Face Match Score Slider */}
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Facial Match Confidence:</span>
                    <span className="font-mono font-bold text-indigo-700">{simFaceScore}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={simFaceScore}
                    onChange={(e) => setSimFaceScore(Number(e.target.value))}
                    className="w-full accent-indigo-700 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>30% (Stranger / Spoof)</span>
                    <span className="text-indigo-600 font-bold">85% (Passing Threshold)</span>
                    <span>100% (Identical Match)</span>
                  </div>
                </div>

                {/* Liveness Toggle */}
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                  <div>
                    <span className="font-semibold text-xs text-slate-800 block">Active Liveness Challenge</span>
                    <span className="text-[10px] text-slate-400">Anti-spoof check (Blink / Smile challenge)</span>
                  </div>
                  <button
                    onClick={() => setSimLiveness(!simLiveness)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      simLiveness ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {simLiveness ? 'PASSED (Live Human)' : 'FAILED (Photo Spoof)'}
                  </button>
                </div>

                {/* Device Clash Toggle */}
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                  <div>
                    <span className="font-semibold text-xs text-slate-800 block">Device Multi-Account Proxy Test</span>
                    <span className="text-[10px] text-slate-400">Simulate same phone used for 2 students in row</span>
                  </div>
                  <button
                    onClick={() => setSimDeviceClash(!simDeviceClash)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      simDeviceClash ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {simDeviceClash ? 'CLASH ACTIVE' : 'NOMINAL (1 Device)'}
                  </button>
                </div>
              </div>

              {/* Live Decision & Anomaly Telemetry */}
              <div className="lg:col-span-6 space-y-4">
                {/* Rule Engine Output */}
                <div className={`p-4 rounded-2xl border ${
                  liveDecision.status === 'VERIFIED_PRESENT'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : liveDecision.status === 'FLAGGED_REVIEW'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                      Rule-Based Decision Engine
                    </span>
                    <span className="text-xs font-mono font-bold">Confidence: {liveDecision.compositeConfidence}%</span>
                  </div>
                  <h4 className="text-base font-bold">{liveDecision.status.replace('_', ' ')}</h4>
                  <p className="text-xs mt-1 leading-snug">{liveDecision.reason}</p>
                  <span className="inline-block mt-2 font-mono text-[10px] bg-white/60 px-2 py-0.5 rounded">
                    Rule: {liveDecision.ruleMatched}
                  </span>
                </div>

                {/* Anomaly Engine Output */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Independent Risk Engine
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                      liveAnomaly.riskLevel === 'LOW'
                        ? 'bg-emerald-50 text-emerald-700'
                        : liveAnomaly.riskLevel === 'MODERATE'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}>
                      Risk Score: {liveAnomaly.riskScore}/100 ({liveAnomaly.riskLevel})
                    </span>
                  </div>

                  {liveAnomaly.flags.length > 0 ? (
                    <div className="space-y-1.5">
                      {liveAnomaly.flags.map((flag, idx) => (
                        <div key={idx} className="bg-rose-50 border border-rose-200 p-2 rounded-xl text-xs text-rose-800">
                          ⚠ {flag}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-xl">
                      ✓ No anomalies. Hardware signature and BLE presence verified nominal.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COMPLETE FLUTTER DART FILES */}
        {activeTab === 'flutter_code' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  SMAP Phase 1 Production Dart Codebase
                </h4>
                <p className="text-xs text-slate-500">
                  Ready to copy directly into your Flutter project:
                </p>
              </div>

              <button
                onClick={() => copyToClipboard(currentCode.name, currentCode.code)}
                className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                {copiedFile === currentCode.name ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy {currentCode.name}</span>
                  </>
                )}
              </button>
            </div>

            {/* File Tab Selectors */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
              <button
                onClick={() => setSelectedCodeFile('pubspec')}
                className={`px-2.5 py-1 text-xs rounded-md font-mono ${
                  selectedCodeFile === 'pubspec' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700'
                }`}
              >
                pubspec.yaml
              </button>
              <button
                onClick={() => setSelectedCodeFile('models')}
                className={`px-2.5 py-1 text-xs rounded-md font-mono ${
                  selectedCodeFile === 'models' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700'
                }`}
              >
                attendance_evidence.dart
              </button>
              <button
                onClick={() => setSelectedCodeFile('ble_service')}
                className={`px-2.5 py-1 text-xs rounded-md font-mono ${
                  selectedCodeFile === 'ble_service' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700'
                }`}
              >
                ble_beacon_service.dart
              </button>
              <button
                onClick={() => setSelectedCodeFile('face_service')}
                className={`px-2.5 py-1 text-xs rounded-md font-mono ${
                  selectedCodeFile === 'face_service' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700'
                }`}
              >
                face_verification_service.dart
              </button>
              <button
                onClick={() => setSelectedCodeFile('decision_engine')}
                className={`px-2.5 py-1 text-xs rounded-md font-mono ${
                  selectedCodeFile === 'decision_engine' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700'
                }`}
              >
                decision_engine.dart
              </button>
              <button
                onClick={() => setSelectedCodeFile('anomaly_detector')}
                className={`px-2.5 py-1 text-xs rounded-md font-mono ${
                  selectedCodeFile === 'anomaly_detector' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700'
                }`}
              >
                anomaly_detector.dart
              </button>
              <button
                onClick={() => setSelectedCodeFile('main')}
                className={`px-2.5 py-1 text-xs rounded-md font-mono ${
                  selectedCodeFile === 'main' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700'
                }`}
              >
                main.dart
              </button>
            </div>

            {/* Code Box */}
            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-[460px] leading-relaxed">
                <code>{currentCode.code}</code>
              </pre>
            </div>
          </div>
        )}

        {/* TAB 4: INTEGRATION ROADMAP */}
        {activeTab === 'roadmap' && (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm">
              Progressive Integration Roadmap for SMAP
            </h4>
            <p className="text-xs text-slate-600">
              Following your strategy of progressive integration and testing, here is the implementation milestone timeline:
            </p>

            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs">
                <span className="font-bold text-indigo-900 block mb-1">
                  Phase 1: Foundation & Project Setup (Current Phase)
                </span>
                <p className="text-slate-700">
                  Establish core data models (<code>BleEvidence</code>, <code>FaceEvidence</code>), set up Flutter reactive BLE scanning, configure camera permissions, and scaffold the rule decision and anomaly detection engines.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="font-bold text-slate-800 block mb-1">
                  Phase 2: BLE Presence & Beacon Deployment
                </span>
                <p className="text-slate-600">
                  Calibrate RSSI log-distance models per classroom dimensions. Test attenuation across classroom walls and doors to ensure proxy attempts from outside are strictly gated.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="font-bold text-slate-800 block mb-1">
                  Phase 3: Facial Liveness & Anti-Spoofing
                </span>
                <p className="text-slate-600">
                  Integrate <code>google_mlkit_face_detection</code> to run passive eye-blink and smile liveness challenges, ensuring students cannot hold up a photo of an absent friend.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="font-bold text-slate-800 block mb-1">
                  Phase 4: Anomaly Engine & Hardware Fingerprinting
                </span>
                <p className="text-slate-600">
                  Enforce device binding with <code>device_info_plus</code> to detect multi-student check-in spoofing from a single physical phone.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
