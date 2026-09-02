import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage, PageCtas } from "@/components/MarketingPage";
import { HINDI_LINE, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Free CA portal for your shop books | Argus",
  description:
    "Give your accountant a read-only link. They see GST summaries and books. You keep billing. No extra paid seat.",
  path: "/ca/",
});

export default function CaPage() {
  return (
    <MarketingPage>
      <p className="text-sm font-medium text-ink">{HINDI_LINE}</p>
      <h1 className="text-4xl font-bold tracking-tight text-ink md:text-5xl">
        Invite your CA. No extra seat.
      </h1>
      <p>
        Billing is how shops start. The CA portal is why they stay. You raise bills on the phone.
        Your accountant opens the same books in a browser, without paying for another login and
        without you emailing PDFs at month-end.
      </p>
      <p>Bill on your phone. Books your CA can file from.</p>

      <h2>A read-only link, free</h2>
      <p>
        In the web app, open Settings and choose Invite CA. Argus gives you a link that lasts seven
        days, plus a backup code. Your CA signs in with Google or email, redeems the invite once,
        and lands on a read-only dashboard. They do not pay. You do not buy them a seat. Book
        shares are end-to-end encrypted for the invite path.
      </p>
      <p>
        After they redeem, the link is used. You can revoke access later if the CA changes. The
        shop login stays yours. They cannot raise a bill, edit stock, or collect dues from that
        portal.
      </p>

      <h2>What your CA can see</h2>
      <p>The portal is built from your books. A linked CA can read:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>Invoices and credit notes</li>
        <li>Purchases and expenses</li>
        <li>Khata</li>
        <li>Inventory and parties</li>
        <li>A GST pack, including a GSTR-1 CSV from those invoices</li>
      </ul>
      <p>
        They cannot write back. If they need a bill corrected, they tell you. You change it in
        Argus. The next time they open the portal, they see the updated books.
      </p>

      <h2>What they cannot do</h2>
      <p>
        The CA portal is not a second billing login. It is not a paid accountant plan. It does not
        let the CA file your GST return on the government portal, and it does not let them change
        your GSTIN, prices, or dues. Filing still happens on gst.gov.in, using the{" "}
        <Link href="/gstr/">GSTR summaries</Link> you both can check.
      </p>

      <h2>Why send this instead of Excel and WhatsApp PDFs</h2>
      <p>
        Spreadsheets go stale the moment you raise the next bill. A WhatsApp folder of PDFs is
        missing the khata, the purchase, and the GST split. The portal is the live books: same
        invoices, same GST summaries, same outstanding. Your CA spends time on the return, not on
        asking you for last Tuesday&apos;s bill.
      </p>
      <p>
        You keep the phone workflow. They keep a browser. One login family, two jobs.
      </p>

      <h2>For the shopkeeper</h2>
      <p>
        Start on Android (unlimited invoices on the free plan) or start the 14-day Business trial
        on the web. Same login. When your CA asks for books, generate the invite from Settings.
        Business is ₹500/month. Lifetime ₹18,000 is on this website only. iOS is coming soon.
      </p>
      <PageCtas />

      <h2>A note CAs can forward</h2>
      <p>
        If a client bills in Argus, ask them to send you their CA invite link. Sign in, redeem
        once, and you get a free read-only view of invoices, purchases, khata, and GSTR-style
        summaries. You do not need a paid Argus seat. You still file on the GST portal. For help:{" "}
        <a href="mailto:support@argusinvoicing.com">support@argusinvoicing.com</a>.
      </p>
    </MarketingPage>
  );
}
