import { it } from "vitest";
import fs from "node:fs";
import { checkBooks } from "@/lib/compliance";
import { exceptionReport } from "@/lib/exceptions";
const AUTH = "http://127.0.0.1:9099", FN = "http://127.0.0.1:5001/argus-invocing/us-central1";
const BOOK = JSON.parse(fs.readFileSync("public/data/gst-rates.json", "utf8"));
it("what owners see in the GST check at year end", async () => {
  const seen: Record<string, Set<string>> = {};
  const exc: Record<string, Set<string>> = {};
  for (let n = 1; n <= 20; n++) {
    const j = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `owner${n}@argus.test`, password: "argus-emulator-test-1", returnSecureToken: true }) }).then((r) => r.json());
    const d = (await fetch(`${FN}/apiDataLoad/api/data/load`, { headers: { Authorization: `Bearer ${j.idToken}` } }).then((r) => r.json())).data;
    const name = d.businesses[0]?.name || `owner${n}`;
    for (const i of checkBooks(d, new Date("2026-04-08T10:00:00Z"), BOOK)) (seen[`${i.severity} | ${i.title.replace(/[A-Z]{2,4}\/\d\d-\d\d\/\S+/g, "#")}`] ||= new Set()).add(`${name}: ${i.detail.slice(0, 140)}`);
    try { for (const e of exceptionReport(d, "2026-04-08") as any[]) (exc[String(e.title || e.kind).replace(/[A-Z]{2,4}\/\d\d-\d\d\/\S+/g, "#")] ||= new Set()).add(`${name}: ${String(e.detail || "").slice(0, 120)}`); } catch (e) { console.log("exceptionReport threw", String(e)); }
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(seen)) out.push(`${k}  [${v.size} shops]\n    e.g. ${[...v][0]}`);
  out.push("---- exceptions screen");
  for (const [k, v] of Object.entries(exc)) out.push(`${k}  [${v.size}]\n    e.g. ${[...v][0]}`);
  fs.writeFileSync("scripts/sim/last-run-issues.json", out.join("\n"));
});
