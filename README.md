# SMAP — University Smart Attendance Web Platform

SMAP is a comprehensive, responsive university smart attendance web platform designed to eliminate proxy attendance and automate classroom presence tracking through multimodal verification:

- **Web Bluetooth (BLE) Proximity Verification**: Detects physical classroom radio beacon transmitters and enforces perimeter boundaries (e.g. -78 dBm gate).
- **WebRTC Camera Biometric Liveness Verification**: Live browser webcam face scan with active liveness challenges (blink, nod, smile) to prevent photo replay attacks.
- **Dynamic Anti-Proxy Rotating QR Code**: 15-second rotating HMAC-hashed tokens displayed on classroom lecture hall screens.
- **Deterministic Multi-Modal Decision Engine**: Automated rules that combine radio proximity and biometric confidence into explainable verdicts.
- **Autonomous Anomaly & Anti-Fraud Engine**: Detects multi-student hardware collisions (same device used for multiple check-ins) and signal attenuation across walls.
- **Faculty Audit Ledger & Recharts Data Visualization**: Comprehensive audit logs with forensic evidence inspection, CSV export, and interactive Recharts attendance percentage trends over time.

---

## Web Architecture & Modules

```
├── src/
│   ├── components/
│   │   ├── StudentPortal.tsx          # Student dashboard, course roster, live Web BLE & camera check-in
│   │   ├── LecturerConsole.tsx        # Session broadcaster, rotating anti-proxy QR, live stream, manual override
│   │   ├── AuditLedgerView.tsx        # Full faculty audit ledger, search/filter, forensic modal, CSV export
│   │   ├── AttendanceTrendChart.tsx   # Recharts data visualization of attendance % per session over time
│   │   ├── DecisionSandbox.tsx        # Interactive rule engine & fraud simulation playground
│   │   ├── WebCamScanner.tsx          # WebRTC browser camera feed & biometric liveness prompt
│   │   └── QRCodeDisplay.tsx          # SVG vector QR code renderer
│   ├── services/
│   │   ├── decisionEngine.ts          # Deterministic multimodal decision logic
│   │   └── anomalyEngine.ts           # Hardware clash, wall decay & proxy detection
│   ├── types/
│   │   └── attendance.ts              # Type definitions for attendance records, evidence, and sessions
│   ├── data/
│   │   └── mockData.ts                # Initial university course catalog, student roster, and fraud presets
│   ├── App.tsx                        # Main responsive web portal shell
│   └── main.tsx                       # React SPA entry point
├── package.json                       # Node.js dependencies & scripts
├── vite.config.ts                     # Vite build configuration (port 3000, 0.0.0.0)
└── index.html                         # Web app entry point & PWA metadata
```

---

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev
```

Open `http://localhost:3000` to access the SMAP web platform.
