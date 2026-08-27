"use client";

import { useState } from "react";
import { FolderOpen, Check, Info, AlertCircle } from "lucide-react";
import { isFileSystemSupported, pickFolder, isUsingFileSystem, getFolderName } from "@/lib/storage";

type FolderPickerProps = {
  onPicked: () => void;
};

export function FolderPicker({ onPicked }: FolderPickerProps) {
  const [picking, setPicking] = useState(false);
  const [folderChosen, setFolderChosen] = useState(isUsingFileSystem());
  const supported = isFileSystemSupported();

  async function handlePick() {
    setPicking(true);
    const name = await pickFolder();
    setPicking(false);
    if (name) {
      setFolderChosen(true);
      onPicked();
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-lg border border-lead/20 bg-midnight p-8 text-center">
        <FolderOpen className="mx-auto mb-4 h-16 w-16 text-mercury-blue" />

        <h2 className="mb-3 text-2xl text-starlight">
          {supported ? "Select working folder" : "Local browser storage"}
        </h2>

        <p className="mb-6 text-sm text-silver">
          {supported
            ? "Choose a folder where Argus will save argus-books.json and invoice exports."
            : "Firefox and Safari do not allow websites to open a disk folder. Your books still save in this browser; use Settings → Export for a portable JSON file."}
        </p>

        {supported ? (
          <>
            <div className="mb-6 rounded-lg bg-graphite p-4 text-left">
              <div className="mb-2 flex items-center gap-2 text-sm text-starlight">
                <Info className="h-4 w-4 text-mercury-blue" />
                How it works
              </div>
              <ul className="space-y-1 text-xs text-silver">
                <li>• Full books snapshot: argus-books.json</li>
                <li>• Invoice exports under business / date folders</li>
                <li>• Files stay on your computer</li>
                <li>• Folder access is remembered for this site (Chrome / Edge)</li>
              </ul>
            </div>

            {folderChosen ? (
              <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                <Check className="h-5 w-5" />
                Folder selected: {getFolderName()}
              </div>
            ) : null}

            <button
              onClick={handlePick}
              disabled={picking}
              className="btn-primary w-full"
            >
              {picking
                ? "Waiting for folder selection..."
                : folderChosen
                ? "Change Folder"
                : "Select or Create Folder"}
            </button>

            {folderChosen && (
              <button
                onClick={onPicked}
                className="mt-3 w-full text-sm text-mercury-blue hover:underline"
              >
                Continue to Dashboard →
              </button>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-300">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                Use Chrome or Edge if you want a live attached folder. Otherwise continue —
                IndexedDB + Export / Import cover Firefox and Safari.
              </div>
            </div>
            <button onClick={onPicked} className="btn-primary w-full">
              Continue to Dashboard →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
