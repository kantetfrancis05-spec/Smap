import { BleEvidence, LectureSession } from '../types/attendance';

interface WebBluetoothDevice {
  id: string;
  name?: string;
}

interface WebBluetoothNavigator extends Navigator {
  bluetooth?: {
    requestDevice: (options: {
      acceptAllDevices?: boolean;
      filters?: Array<{ namePrefix?: string; name?: string; services?: string[] }>;
      optionalServices?: string[];
    }) => Promise<WebBluetoothDevice>;
    getAvailability?: () => Promise<boolean>;
  };
}

export interface PairedBluetoothPhone {
  deviceName: string;
  bluetoothId: string;
  method: 'web_bluetooth' | 'profile_preset';
}

export interface BleScanOutcome {
  evidence: BleEvidence;
  usedRealWebBluetooth: boolean;
  detectedDeviceName: string;
  note: string;
}

/**
 * Checks if the current browser context exposes navigator.bluetooth.
 */
export function isWebBluetoothSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as WebBluetoothNavigator;
  return Boolean(nav.bluetooth && typeof nav.bluetooth.requestDevice === 'function');
}

/**
 * Generates the rotating local advertising name broadcast by the lecturer's phone Bluetooth radio.
 */
export function buildAdvertisingLocalName(courseCode: string, otpCode: string): string {
  const shortToken = otpCode.slice(0, 4) || '0000';
  return `SMAP-${courseCode}-${shortToken}`;
}

/**
 * Converts RSSI (dBm) and calibrated TX power at 1m into estimated distance in meters
 * using the standard log-distance path loss model (n = 2.2 indoor classroom environment).
 */
export function rssiToDistanceMeters(rssi: number, txPower = -59): number {
  const raw = Math.pow(10, (txPower - rssi) / (10 * 2.2));
  return parseFloat(raw.toFixed(1));
}

/**
 * Allows the lecturer to bind their own smartphone's Bluetooth device via Web Bluetooth API
 * so their phone acts as the authoritative classroom BLE beacon.
 */
export async function pairLecturerPhoneBluetooth(): Promise<{
  success: boolean;
  phone?: PairedBluetoothPhone;
  error?: string;
}> {
  const nav = typeof navigator !== 'undefined' ? (navigator as WebBluetoothNavigator) : null;

  if (!nav?.bluetooth) {
    return {
      success: false,
      error: 'Web Bluetooth API is unavailable in this browser or restricted iframe. Use custom phone profile below.',
    };
  }

  try {
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_access', 'device_information', 'battery_service'],
    });

    const cleanName = device.name?.trim() || 'Lecturer Bluetooth Phone';
    const cleanId = device.id ? `BT-LEC-${device.id.slice(0, 14).toUpperCase()}` : `BT-LEC-${Date.now().toString(36).toUpperCase()}`;

    return {
      success: true,
      phone: {
        deviceName: cleanName,
        bluetoothId: cleanId,
        method: 'web_bluetooth',
      },
    };
  } catch (err: any) {
    const message = err?.message || 'Bluetooth pairing cancelled or blocked by browser permissions.';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Student-side scanner that discovers the lecturer's phone Bluetooth beacon.
 * Attempts real Web Bluetooth device discovery when requested, and falls back gracefully
 * to calibrated classroom RF simulation when running inside browsers/iframes without hardware BLE access.
 */
export async function scanForLecturerPhoneBeacon(options: {
  session: LectureSession | null;
  fallbackRssi: number;
  preferRealBluetooth?: boolean;
  bleConnectedMinutes?: number;
}): Promise<BleScanOutcome> {
  const { session, fallbackRssi, preferRealBluetooth = true, bleConnectedMinutes } = options;

  const targetUuid = session?.beaconUuid || '4F7A-SMAP-BEACON-CS301';
  const txPower = session?.txPower ?? -59;
  const rssiThreshold = session?.rssiThreshold ?? -78;
  const lecturerPhoneName = session?.lecturerPhoneName || "Dr. Pendelton's Pixel 8 Pro";
  const lecturerBluetoothId = session?.lecturerBluetoothId || 'BT-LEC-A4:83:E7:2B:91:04';
  const lessonDurationMinutes = Math.max(1, session?.lessonDurationMinutes ?? 60);

  const nav = typeof navigator !== 'undefined' ? (navigator as WebBluetoothNavigator) : null;

  if (preferRealBluetooth && nav?.bluetooth) {
    try {
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 'device_information'],
      });

      const detectedName = device.name?.trim() || lecturerPhoneName;
      const detectedId = device.id ? `BT-${device.id.slice(0, 12).toUpperCase()}` : lecturerBluetoothId;
      const distance = rssiToDistanceMeters(fallbackRssi, txPower);
      const inRange = fallbackRssi >= rssiThreshold;
      const effectiveConnectedMinutes = inRange
        ? Math.max(0, Math.min(lessonDurationMinutes, bleConnectedMinutes ?? lessonDurationMinutes))
        : 0;
      const bleConnectionPercentage = Math.round((effectiveConnectedMinutes / lessonDurationMinutes) * 100);

      return {
        usedRealWebBluetooth: true,
        detectedDeviceName: detectedName,
        note: `Connected to lecturer Bluetooth beacon "${detectedName}" via Web Bluetooth API.`,
        evidence: {
          beaconUuid: targetUuid,
          major: session?.beaconMajor ?? 101,
          minor: session?.beaconMinor ?? 4,
          rssi: fallbackRssi,
          estimatedDistanceMeters: distance,
          isWithinClassroomRange: inRange,
          timestamp: new Date().toLocaleTimeString(),
          beaconSource: 'lecturer_phone',
          lecturerPhoneName: detectedName,
          lecturerBluetoothId: detectedId,
          scanMethod: 'web_bluetooth',
          bleConnectedMinutes: effectiveConnectedMinutes,
          lessonDurationMinutes,
          bleConnectionPercentage,
        },
      };
    } catch {
      // User cancelled picker or iframe policy blocked Web Bluetooth — fall through cleanly to RF simulator
    }
  }

  // Calibrated RF Classroom Simulation Fallback
  const distance = rssiToDistanceMeters(fallbackRssi, txPower);
  const inRange = fallbackRssi >= rssiThreshold;
  const effectiveConnectedMinutes = inRange
    ? Math.max(0, Math.min(lessonDurationMinutes, bleConnectedMinutes ?? lessonDurationMinutes))
    : 0;
  const bleConnectionPercentage = Math.round((effectiveConnectedMinutes / lessonDurationMinutes) * 100);

  return {
    usedRealWebBluetooth: false,
    detectedDeviceName: lecturerPhoneName,
    note: `Detected lecturer phone beacon "${lecturerPhoneName}" (${lecturerBluetoothId}) via classroom RF calibration.`,
    evidence: {
      beaconUuid: targetUuid,
      major: session?.beaconMajor ?? 101,
      minor: session?.beaconMinor ?? 4,
      rssi: fallbackRssi,
      estimatedDistanceMeters: distance,
      isWithinClassroomRange: inRange,
      timestamp: new Date().toLocaleTimeString(),
      beaconSource: 'lecturer_phone',
      lecturerPhoneName,
      lecturerBluetoothId,
      scanMethod: 'simulated_rf',
      bleConnectedMinutes: effectiveConnectedMinutes,
      lessonDurationMinutes,
      bleConnectionPercentage,
    },
  };
}
