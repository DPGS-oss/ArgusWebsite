import { Check, Minus } from "lucide-react";
import { Reveal } from "./Reveal";

type Cell = boolean | string;

const rows: { label: string; free: Cell; business: Cell }[] = [
  { label: "Bills per month", free: "20", business: "Unlimited" },
  { label: "\"Made with Argus\" watermark on bills", free: "Yes", business: "No" },
  { label: "Android app", free: true, business: true },
  { label: "Web app (same login)", free: false, business: true },
  { label: "Speak the bill (Hindi / English)", free: true, business: true },
  { label: "Customers and UPI payment links", free: true, business: true },
  { label: "Purchases, stock and khata", free: false, business: true },
  { label: "GSTR-1, 2B and 3B summaries + GSTR-1 JSON", free: false, business: true },
  { label: "Free read-only access for your CA", free: false, business: true },
  { label: "Cloud sync between phone and web", free: false, business: true },
  { label: "Quotes, credit notes, challans, recurring bills", free: false, business: true },
];

function Value({ v }: { v: Cell }) {
  if (v === true) return <Check className="mx-auto h-5 w-5 text-brand-violet" aria-label="Included" />;
  if (v === false) return <Minus className="mx-auto h-5 w-5 text-cloud" aria-label="Not included" />;
  return <span className="font-semibold text-ink">{v}</span>;
}

/** Free vs Business at a glance, under the pricing cards. */
export function PlanComparison() {
  return (
    <Reveal delay={0.15}>
      <div className="mx-auto mt-16 max-w-3xl overflow-hidden rounded-card-lg border border-bone bg-white">
        <table className="w-full text-sm">
          <caption className="border-b border-bone px-5 py-4 text-left font-display text-lg font-bold text-ink">
            Free vs Business
          </caption>
          <thead>
            <tr className="bg-mist text-xs uppercase tracking-wider text-slate">
              <th scope="col" className="px-5 py-3 text-left font-semibold">Feature</th>
              <th scope="col" className="w-28 px-3 py-3 text-center font-semibold">Free</th>
              <th scope="col" className="w-28 px-3 py-3 text-center font-semibold text-brand-violet">Business</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-bone">
                <th scope="row" className="px-5 py-3 text-left font-normal text-ink">{r.label}</th>
                <td className="px-3 py-3 text-center"><Value v={r.free} /></td>
                <td className="px-3 py-3 text-center"><Value v={r.business} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}
