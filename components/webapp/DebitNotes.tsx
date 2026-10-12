"use client";

import type { AppData } from "@/lib/types";
import { AdjustmentNotes } from "./AdjustmentNotes";

export function DebitNotes({ data, onSaved }: { data: AppData; onSaved: () => void }) {
  return <AdjustmentNotes data={data} onSaved={onSaved} kind="debit_note" />;
}
