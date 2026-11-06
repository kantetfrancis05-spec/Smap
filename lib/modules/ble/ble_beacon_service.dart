import 'dart:async';
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
