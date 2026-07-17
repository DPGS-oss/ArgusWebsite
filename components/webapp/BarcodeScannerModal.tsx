"use client";

import { useEffect, useRef, useState } from "react";
import { X, ScanLine, Smartphone, Camera } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/library";
import { useAuth } from "@/lib/auth-provider";
import { pollScanResult, clearScanResult } from "@/lib/cloud-sync";

type BarcodeScannerModalProps = {
  onClose: () => void;
  onDetected: (code: string) => void;
};

type ScanMode = "camera" | "phone";

export function BarcodeScannerModal({ onClose, onDetected }: BarcodeScannerModalProps) {
  const { token } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(true);
  const [mode, setMode] = useState<ScanMode>("camera");
  const [phoneWaiting, setPhoneWaiting] = useState(false);
  const controlsRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (mode === "phone") {
      startPhoneScan();
      return;
    }
    startCameraScan();

    return () => {
      stopCamera();
    };
  }, [mode]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (zxingReaderRef.current) {
      zxingReaderRef.current.reset();
      zxingReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function startCameraScan() {
    setError("");
    setScanning(true);
    stopCamera();

    const video = videoRef.current;
    if (!video) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      controlsRef.current = video;

      const BarcodeDetectorCtor = (window as unknown as {
        BarcodeDetector?: new (opts?: { formats?: string[] }) => {
          detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
        };
      }).BarcodeDetector;

      if (BarcodeDetectorCtor) {
        const detector = new BarcodeDetectorCtor({
          formats: ["code_39", "code_128", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
        });

        const interval = setInterval(async () => {
          if (!videoRef.current || !detector) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0 && results[0].rawValue) {
              clearInterval(interval);
              onDetected(results[0].rawValue);
            }
          } catch {
            // detection errors are normal between frames
          }
        }, 500);

        return () => clearInterval(interval);
      } else {
        const reader = new BrowserMultiFormatReader();
        zxingReaderRef.current = reader;

        reader.decodeFromStream(stream, video, (result, err) => {
          if (result) {
            const text = result.getText();
            if (text) {
              stopCamera();
              onDetected(text);
            }
          }
        });
      }
    } catch (err) {
      setError(
        "Cannot access camera. Please allow camera permissions and try again. " +
          "If you're on a PC without a camera, use 'Phone as Scanner' mode."
      );
    }
  }

  async function startPhoneScan() {
    setError("");
    setPhoneWaiting(true);

    if (!token) {
      setError("You need to be signed in to use phone as scanner.");
      setPhoneWaiting(false);
      return;
    }

    await clearScanResult(token);

    const pollInterval = setInterval(async () => {
      if (!token) return;
      const code = await pollScanResult(token);
      if (code) {
        clearInterval(pollInterval);
        setPhoneWaiting(false);
        onDetected(code);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }

  const scanUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/scan?t=${token || ""}`
      : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-lg bg-midnight p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg text-starlight">
            <ScanLine className="h-5 w-5" /> Scan Barcode
          </h3>
          <button onClick={onClose} className="rounded p-1 text-silver hover:text-starlight">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 flex gap-2 rounded-lg bg-graphite p-1">
          <button
            onClick={() => setMode("camera")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-btn px-3 py-2 text-xs ${
              mode === "camera" ? "bg-mercury-blue text-white" : "text-silver"
            }`}
          >
            <Camera className="h-3.5 w-3.5" /> Camera
          </button>
          <button
            onClick={() => setMode("phone")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-btn px-3 py-2 text-xs ${
              mode === "phone" ? "bg-mercury-blue text-white" : "text-silver"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" /> Phone as Scanner
          </button>
        </div>

        {mode === "camera" && error && (
          <div className="rounded-lg bg-graphite p-4 text-center text-sm text-silver">
            {error}
          </div>
        )}

        {mode === "camera" && !error && (
          <div className="relative overflow-hidden rounded-lg">
            <video
              ref={videoRef}
              className="w-full"
              autoPlay
              playsInline
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-1 w-3/4 rounded-full bg-red-500/70" />
            </div>
            {scanning && (
              <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">
                Point camera at a barcode...
              </div>
            )}
          </div>
        )}

        {mode === "phone" && (
          <div className="space-y-4">
            {phoneWaiting && (
              <div className="rounded-lg bg-graphite p-4 text-center">
                <div className="mb-3 animate-pulse text-sm text-silver">
                  Waiting for scan from phone...
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-silver">
                  <Smartphone className="h-4 w-4 animate-bounce" />
                  Scan using your phone
                </div>
              </div>
            )}
            {scanUrl && (
              <div className="space-y-3">
                <div className="rounded-lg bg-graphite p-4 text-center">
                  <p className="mb-2 text-sm text-silver">
                    Open this URL on your phone camera:
                  </p>
                  <a
                    href={scanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-xs text-mercury-blue underline"
                  >
                    {scanUrl}
                  </a>
                </div>
                <div className="rounded-lg bg-graphite p-4 text-center">
                  <p className="mb-2 text-sm text-silver">Or scan this QR code:</p>
                  <QRCodeDisplay url={scanUrl} />
                </div>
                <p className="text-center text-xs text-silver">
                  The barcode scanned on your phone will appear here automatically.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QRCodeDisplay({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !url) return;

    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 200,
        margin: 1,
        color: { dark: "#202020", light: "#f8f9fa" },
      }).catch(() => {});
    }).catch(() => {
      // qrcode not installed, show URL as text
    });
  }, [url]);

  return <canvas ref={canvasRef} className="mx-auto rounded-lg" />;
}
