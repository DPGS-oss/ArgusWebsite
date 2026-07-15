"use client";

import { useEffect, useRef, useState } from "react";
import { X, ScanLine } from "lucide-react";

type BarcodeScannerModalProps = {
  onClose: () => void;
  onDetected: (code: string) => void;
};

export function BarcodeScannerModal({ onClose, onDetected }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    let detector: { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> } | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function startScanner() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        if (BarcodeDetectorCtor) {
          detector = new BarcodeDetectorCtor({
            formats: ["code_39", "code_128", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
          });

          interval = setInterval(async () => {
            if (!videoRef.current || !detector) return;
            try {
              const results = await detector.detect(videoRef.current);
              if (results.length > 0 && results[0].rawValue) {
                onDetected(results[0].rawValue);
              }
            } catch {
              // detection errors are normal between frames
            }
          }, 500);
        } else {
          setError("BarcodeDetector API not available in this browser. Try Chrome on Android.");
        }
      } catch (err) {
        setError("Cannot access camera. Please allow camera permissions and try again.");
      }
    }

    startScanner();

    return () => {
      if (interval) clearInterval(interval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onDetected]);

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

        {error ? (
          <div className="rounded-lg bg-graphite p-4 text-center text-sm text-silver">
            {error}
          </div>
        ) : (
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
      </div>
    </div>
  );
}
