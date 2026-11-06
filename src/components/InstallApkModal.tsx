import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  CheckCircle2,
  Terminal,
  ExternalLink,
  QrCode,
  Github,
  X,
  FileArchive,
  ArrowRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { QRCodeDisplay } from './QRCodeDisplay';
import { generateFlutterProjectZip } from '../utils/flutterProjectZip';

interface InstallApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallApkModal: React.FC<InstallApkModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isAndroid, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'pwa' | 'download_zip' | 'cli'>('pwa');
  const [isZipping, setIsZipping] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const currentAppUrl = typeof window !== 'undefined' ? window.location.href : 'https://smap.app';

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const blob = await generateFlutterProjectZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SMAP_Flutter_Project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (e) {
      console.error('Failed to generate Flutter zip:', e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-indigo-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-700/80 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="text-base font-bold">Install SMAP on Android / Build APK</h3>
              <p className="text-xs text-indigo-200">
                Choose instant mobile installation or compile the native Flutter APK
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'border-indigo-700 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>1. Install to Android Phone (Instant)</span>
          </button>

          <button
            onClick={() => setActiveTab('download_zip')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'download_zip'
                ? 'border-indigo-700 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileArchive className="w-4 h-4" />
            <span>2. Download Flutter Project (.ZIP)</span>
          </button>

          <button
            onClick={() => setActiveTab('cli')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'cli'
                ? 'border-indigo-700 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>3. Compile APK Commands</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* TAB 1: INSTANT ANDROID INSTALLATION */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-950 text-sm">
                    Direct Android WebAPK Installation
                  </h4>
                  <p className="text-emerald-800 text-xs mt-0.5 leading-relaxed">
                    Android and Google Chrome generate an official <strong>WebAPK</strong> directly from this site. It installs straight to your phone's home screen & app drawer, launches full-screen with native animations, and runs offline.
                  </p>
                </div>
              </div>

              {/* Install trigger button */}
              {isInstallable && (
                <div className="text-center py-2">
                  <button
                    onClick={install}
                    className="w-full sm:w-auto px-6 py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mx-auto"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install App on this Device Now</span>
                  </button>
                </div>
              )}

              {/* QR Code to open on Phone */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-5">
                <div className="shrink-0 flex flex-col items-center">
                  <QRCodeDisplay value={currentAppUrl} size={130} />
                  <span className="text-[10px] text-slate-500 font-medium mt-1">Scan with Android Camera</span>
                </div>
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    How to install on Android in 10 seconds:
                  </h5>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>Scan the QR code above or open this URL on your phone's Chrome browser.</li>
                    <li>Tap the <strong>three dots (⋮)</strong> in Chrome at the top right.</li>
                    <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                    <li>Android will automatically generate and install the native app onto your device!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOWNLOAD COMPLETE FLUTTER ZIP */}
          {activeTab === 'download_zip' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Download Full Flutter Project Archive
                </h4>
                <p className="text-slate-600 text-xs mt-1">
                  Download the complete standalone Flutter project including all modular Dart services, Android permissions manifest, and build configuration.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-xs text-slate-800 block">Package Contents:</span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono text-slate-600">
                  <li>✓ <code>pubspec.yaml</code> (BLE, Camera, ML Kit)</li>
                  <li>✓ <code>AndroidManifest.xml</code> (BLE permissions)</li>
                  <li>✓ <code>lib/main.dart</code></li>
                  <li>✓ <code>lib/modules/ble/ble_beacon_service.dart</code></li>
                  <li>✓ <code>lib/modules/face/face_verification_service.dart</code></li>
                  <li>✓ <code>lib/modules/engine/decision_engine.dart</code></li>
                  <li>✓ <code>lib/modules/anomaly/anomaly_detector.dart</code></li>
                  <li>✓ <code>.github/workflows/build_apk.yml</code> (Cloud builder)</li>
                </ul>
              </div>

              <div className="text-center pt-2">
                <button
                  onClick={handleDownloadZip}
                  disabled={isZipping}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mx-auto"
                >
                  <Download className="w-4 h-4" />
                  <span>{isZipping ? 'Packaging Flutter Files...' : 'Download SMAP_Flutter_Project.zip'}</span>
                </button>

                {downloadSuccess && (
                  <p className="text-emerald-700 font-bold text-xs mt-2">
                    ✓ Download started! Extract the ZIP and run <code>flutter build apk</code>.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CLI APK BUILD INSTRUCTIONS */}
          {activeTab === 'cli' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  How to Compile the Release APK
                </h4>
                <p className="text-slate-600 text-xs mt-1">
                  Once you extract <code>SMAP_Flutter_Project.zip</code>, use either method to get the <code>.apk</code> file:
                </p>
              </div>

              <div className="space-y-3">
                {/* Option 1: Local Terminal */}
                <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-indigo-400 font-sans font-bold text-xs">
                    <span>Option A: On your computer (Terminal)</span>
                  </div>
                  <pre className="text-emerald-300">
{`# 1. Unzip the project
unzip SMAP_Flutter_Project.zip
cd SMAP_Flutter_Project

# 2. Get dependencies
flutter pub get

# 3. Build release APK
flutter build apk --release`}
                  </pre>
                  <p className="text-slate-400 font-sans text-[11px] pt-1">
                    Your APK is ready at: <code className="text-amber-300">build/app/outputs/flutter-apk/app-release.apk</code>
                  </p>
                </div>

                {/* Option 2: Cloud GitHub Actions */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-indigo-800 font-bold text-xs">
                    <Github className="w-4 h-4" />
                    <span>Option B: Free Cloud Build (No Flutter install needed on PC!)</span>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    The downloaded project includes <code>.github/workflows/build_apk.yml</code>. Simply push the folder to a GitHub repository, and GitHub's cloud runners will automatically compile the APK and give you a direct download link under the <strong>Actions</strong> tab!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
