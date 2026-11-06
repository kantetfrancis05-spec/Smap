# SMAP — Smart Attendance App

SMAP is a secure university attendance verification system designed to eliminate attendance fraud through multimodal verification:
- **Bluetooth Low Energy (BLE)** classroom presence verification
- **Facial verification & anti-spoof liveness** challenge
- **Rule-based attendance decision engine**
- **Independent fraud risk & anomaly detection engine**

---

## Repository Structure

```
├── lib/                             # Flutter Mobile Application Source
│   ├── core/models/                 # BleEvidence, FaceEvidence, DecisionResult
│   ├── modules/
│   │   ├── ble/                     # BLE Beacon Presence Service (flutter_reactive_ble)
│   │   ├── face/                    # ML Kit Face Detection & Liveness Service
│   │   ├── engine/                  # Rule-based Multimodal Decision Engine
│   │   └── anomaly/                 # Autonomous Risk & Device Anomaly Detector
│   └── main.dart                    # Flutter Material 3 Application Entry
├── android/                         # Android Native Configs & BLE/Camera Manifest
│   └── app/src/main/AndroidManifest.xml
├── .github/workflows/               # Cloud CI/CD
│   └── build_apk.yml                # Automated GitHub Actions APK Compiler
├── src/                             # Web Preview, Portal & Interactive Simulator
├── pubspec.yaml                     # Flutter Dependencies & Metadata
└── package.json                     # Web Applet Dependencies
```

---

## How to Build the Release APK

### 1. Local Build
```bash
flutter pub get
flutter build apk --release
```
The output APK is generated at:
`build/app/outputs/flutter-apk/app-release.apk`

### 2. Free Cloud Build (GitHub Actions)
Whenever you push to this repository, `.github/workflows/build_apk.yml` runs automatically on GitHub's cloud runners and publishes the signed `.apk` under the repository's **Actions** tab.

---

## How to Run the Web Application & Simulation
```bash
npm install
npm run dev
```
Accessible at `http://localhost:3000`.
