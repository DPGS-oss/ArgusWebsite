import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage, PageCtas } from "@/components/MarketingPage";
import { HINDI_LINE, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "GSTR-1, 2B, 3B from daily bills | Argus",
  description:
    "Invoice once. Get GSTR-1, GSTR-2B, and GSTR-3B style summaries from the same books. Check them with your CA before you file.",
  path: "/gstr/",
});

export default function GstrPage() {
  return (
    <MarketingPage>
      <p className="text-sm font-medium text-ink">{HINDI_LINE}</p>
      <h1 className="text-4xl font-bold tracking-tight text-ink md:text-5xl">
        Daily bills. GSTR-ready summaries.
      </h1>
      <p>
        You already write bills all month. GST still asks for GSTR-1, GSTR-2B, and GSTR-3B when
        the month closes. Argus keeps those summaries next to the same invoices, khata, and stock
        you use on the shop floor. You still file on the GST portal. Argus does not file the return
        for you.
      </p>
      <p>
        Bill on your phone. Books your CA can file from. Same login on the web if you want a bigger
        screen at month-end.
      </p>

      <h2>Invoice as usual</h2>
      <p>
        Create the bill the way you already do. Add the party, the items, HSN, and the GST rate.
        Argus splits CGST and SGST for local sales, and IGST when the supply is interstate. The
        invoice is the record. Nothing extra to type into a GST worksheet later.
      </p>
      <p>
        Credit notes, challans, and quotes sit in the same books. When a bill is cancelled or
        adjusted, the summaries can follow the books instead of a notebook you kept on WhatsApp.
      </p>

      <h2>What Argus prepares</h2>
      <p>
        From those daily bills and purchases, Argus builds GSTR-1, GSTR-2B, and GSTR-3B style
        summaries:
      </p>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong className="text-ink">GSTR-1</strong> — outward supplies from the invoices you
          issued, including HSN-wise totals you can download as CSV for the portal.
        </li>
        <li>
          <strong className="text-ink">GSTR-2B</strong> — a view of input tax credit from the
          purchases you recorded, so you can check ITC before you claim it.
        </li>
        <li>
          <strong className="text-ink">GSTR-3B</strong> — a monthly summary of GST collected minus
          ITC, so you can see the number you will take to the portal.
        </li>
      </ul>
      <p>
        Month-end should be a check: open the GST hub, read the summaries, fix any bill that looks
        wrong, then file on gst.gov.in. It should not be rebuilding sales from chats, paper, and
        three spreadsheets.
      </p>

      <h2>You file. Argus does not.</h2>
      <p>
        Argus prepares the numbers from your books. You (or your CA) still log in to the GST portal
        and file the return there. Treat the in-app summaries as a working copy of what you will
        submit, not as a filed return. Argus does not generate e-invoice IRNs or e-way bills on the
        government network.
      </p>

      <h2>Your CA can see the same numbers</h2>
      <p>
        If you invite your accountant, they get a free read-only link. They can open invoices,
        purchases, khata, and the GST pack without another paid seat. You keep billing. They check
        the summaries before you file. Read how that invite works on the{" "}
        <Link href="/ca/">CA portal</Link> page.
      </p>

      <h2>What is GSTR-1 in Argus?</h2>
      <p>
        GSTR-1 is the list of bills you sent out. In Argus it is a summary built from your saved
        invoices: invoice number, party, date, taxable value, and GST. You can export CSV and use
        it while filing GSTR-1 on the portal. It is not a substitute for the portal itself.
      </p>

      <h2>Does this file my return?</h2>
      <p>
        No. Argus does not e-file GSTR-1, GSTR-2B, or GSTR-3B. It turns daily bills into summaries
        so you and your CA can check the books, then you file on the GST portal.
      </p>

      <h2>Who this is for</h2>
      <p>
        Shopkeepers who raise GST invoices, keep khata, and want month-end GST to match the bills
        already on the phone. Free Android is 5 invoices a month. The 14-day Business trial is on
        the web with the same login. Business is ₹500/month. Lifetime ₹18,000 is sold on this
        website only, not inside the Play app. iOS is coming soon.
      </p>
      <p>
        Questions: <a href="mailto:support@argusinvoicing.com">support@argusinvoicing.com</a>.
      </p>
      <PageCtas />
    </MarketingPage>
  );
}
