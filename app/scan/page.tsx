"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine, Check, X, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BrowserMultiFormatReader } from "@zxing/library";
import { postScanResult } from "@/lib/cloud-sync";

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [status, setStatus] = useState<"scanning" | "success" | "error" | "auth">("scanning");
  const [scannedCode, setScannedCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    if (!t) {
      setStatus("auth");
      return;
    }
    setToken(t);
    startScanner();

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

  async function startScanner() {
    const video = videoRef.current;
    if (!video) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

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
          if (!videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0 && results[0].rawValue) {
              clearInterval(interval);
              handleDetected(results[0].rawValue);
            }
          } catch {
            // normal between frames
          }
        }, 500);
      } else {
        const reader = new BrowserMultiFormatReader();
        zxingReaderRef.current = reader;

        reader.decodeFromStream(stream, video, (result) => {
          if (result) {
            const text = result.getText();
            if (text) {
              stopCamera();
              handleDetected(text);
            }
          }
        });
      }
    } catch {
      setStatus("error");
      setErrorMsg("Cannot access camera. Please allow camera permissions and try again.");
    }
  }

  async function handleDetected(code: string) {
    setScannedCode(code);
    stopCamera();

    if (token) {
      const ok = await postScanResult(token, code);
      if (ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg("Scanned barcode but failed to send to your computer. Please try again.");
      }
    } else {
      setStatus("auth");
    }
  }

  function handleRescan() {
    setScannedCode("");
    setStatus("scanning");
    startScanner();
  }

  if (status === "auth") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-midnight p-4 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-amber-400" />
        <h1 className="mb-2 text-xl font-bold text-starlight">Authentication Required</h1>
        <p className="mb-6 max-w-sm text-sm text-silver">
          You need to open the scanner link from the Argus web app while logged in.
          The link contains your session token.
        </p>
        <Link href="/app/" className="btn-primary">
          <ArrowLeft className="mr-1 h-4 w-4" /> Go to Web App
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight">
      <div className="flex items-center justify-between border-b border-lead/20 p-4">
        <Link href="/app/" className="flex items-center gap-2 text-sm text-silver hover:text-starlight">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="flex items-center gap-2 text-sm font-bold text-starlight">
          <ScanLine className="h-4 w-4" /> Argus Scanner
        </h1>
        <div className="w-16" />
      </div>

      {status === "success" ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-starlight">Barcode Scanned!</h2>
          <p className="mb-1 text-sm text-silver">Scanned code:</p>
          <p className="mb-6 rounded-lg bg-graphite px-4 py-2 font-mono text-sm text-starlight">
            {scannedCode}
          </p>
          <p className="mb-6 max-w-xs text-xs text-silver">
            The barcode has been sent to your computer. You can close this page or scan another.
          </p>
          <button onClick={handleRescan} className="btn-primary">
            <ScanLine className="mr-1 h-4 w-4" /> Scan Another
          </button>
        </div>
      ) : status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
          <h2 className="mb-2 text-lg font-bold text-starlight">Scanner Error</h2>
          <p className="mb-6 max-w-sm text-sm text-silver">{errorMsg}</p>
          <button onClick={handleRescan} className="btn-primary">
            Try Again
          </button>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            playsInline
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-1 w-3/4 rounded-full bg-red-500/70" />
          </div>
          <div className="absolute bottom-8 left-0 right-0 text-center text-sm text-white/80">
            Point camera at a barcode...
          </div>
        </div>
      )}
    </div>
  );
}
