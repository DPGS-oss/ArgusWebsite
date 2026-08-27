#!/usr/bin/env python3
"""Generate Argus Marketing Brief PDF for AI marketing planning."""

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parents[1] / "docs" / "Argus_Marketing_Brief.pdf"


class BriefPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 110)
        self.cell(0, 6, "Argus Marketing Brief  |  Confidential product context for planning", align="L", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(130, 130, 140)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="C")

    def _reset_x(self):
        self.set_x(self.l_margin)

    def h1(self, text: str):
        self._reset_x()
        self.set_font("Helvetica", "B", 20)
        self.set_text_color(30, 30, 40)
        self.multi_cell(0, 10, text)
        self.ln(2)

    def h2(self, text: str):
        self.ln(3)
        self._reset_x()
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(70, 60, 180)
        self.multi_cell(0, 8, text)
        self.ln(1)

    def h3(self, text: str):
        self.ln(2)
        self._reset_x()
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(40, 40, 50)
        self.multi_cell(0, 7, text)
        self.ln(0.5)

    def body(self, text: str):
        self._reset_x()
        self.set_font("Helvetica", "", 10)
        self.set_text_color(45, 45, 55)
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def bullet(self, text: str, indent: float = 4):
        self._reset_x()
        self.set_font("Helvetica", "", 10)
        self.set_text_color(45, 45, 55)
        usable = self.w - self.l_margin - self.r_margin - indent
        self.set_x(self.l_margin + indent)
        self.multi_cell(usable, 5.5, f"-  {text}")

    def prompt_box(self, title: str, text: str):
        self.ln(2)
        self._reset_x()
        y0 = self.get_y()
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(70, 60, 180)
        self.multi_cell(0, 6, title)
        self._reset_x()
        self.set_font("Helvetica", "", 9.5)
        self.set_text_color(40, 40, 55)
        self.multi_cell(0, 5.2, text)
        y1 = self.get_y()
        self.set_draw_color(91, 91, 214)
        self.set_line_width(0.6)
        self.line(self.l_margin, y0, self.l_margin, y1)
        self.ln(2)
        self._reset_x()


def build() -> Path:
    pdf = BriefPDF(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(18, 16, 18)
    pdf.add_page()

    # Cover
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(30, 30, 40)
    pdf.ln(20)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 12, "Argus")
    pdf.set_font("Helvetica", "", 14)
    pdf.set_text_color(70, 60, 180)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 8, "GST Billing and Invoicing for Indian SMEs")
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(30, 30, 40)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 9, "Marketing Brief")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(70, 70, 80)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(
        0,
        6,
        "Product context document for Claude (or any marketing strategist) "
        "to design a full go-to-market and growth plan.",
    )
    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 5.5, "Website: https://argusinvoicing.com")
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 5.5, "Support: support@argusinvoicing.com")
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 5.5, "Category: Business  |  Platform: Android + Web  |  Market: India")
    pdf.ln(8)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 110)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(
        0,
        5,
        "How to use: Paste this PDF (or its text) into Claude with the prompt in Section 11. "
        "Ask for a 90-day marketing plan, channel strategy, messaging, and content calendar.",
    )

    # 1 Purpose
    pdf.add_page()
    pdf.h1("1. Purpose of this brief")
    pdf.body(
        "This document explains what Argus is, who it is for, how it makes money, how it differs "
        "from competitors, and what constraints matter for marketing. It is written so an AI "
        "assistant can produce a concrete marketing plan without guessing product facts."
    )
    pdf.body(
        "Argus is early-stage / launching on Google Play with a companion marketing site and web app. "
        "Treat growth as acquisition + activation + paid conversion, not brand awareness alone."
    )

    # 2 Product
    pdf.h2("2. Product overview")
    pdf.body(
        "Argus is an offline-first GST billing and invoicing app for Indian small businesses, "
        "retailers, wholesalers, and accountants. Users create GST-compliant invoices, track "
        "customer credit (khata), manage inventory, view GST return summaries, and collaborate "
        "with accountants -- from a phone or the web."
    )
    pdf.h3("One-line pitch")
    pdf.body(
        "GST billing that works offline, keeps data private with encrypted sync, and connects "
        "shop owners to their accountant -- without expensive desktop software."
    )
    pdf.h3("Tagline options already in use")
    pdf.bullet("Offline GST billing, invoicing, khata, and accountant collaboration for India.")
    pdf.bullet("GST Billing Made Simple")
    pdf.h3("Platforms")
    pdf.bullet("Android app (primary distribution via Google Play)")
    pdf.bullet("Web app at argusinvoicing.com/app (Business plan)")
    pdf.bullet("Marketing site: argusinvoicing.com")
    pdf.h3("Tech posture (useful for trust messaging)")
    pdf.bullet("Flutter client + FastAPI backend + Firebase Auth / Firestore")
    pdf.bullet("Local-first storage (Hive / secure offline store); sync when online")
    pdf.bullet("Encrypted accountant collaboration / E2EE sync story as a differentiator")
    pdf.bullet("Payments: Google Play Billing (Android) and Razorpay (web)")

    # 3 Problem
    pdf.h2("3. Problem and market opportunity")
    pdf.body(
        "Indian MSMEs need GST-compliant billing every day, often in shops with unreliable "
        "internet. Existing apps (Vyapar, myBillBook, Swipe) are popular but users complain about "
        "sync failures, crashes during billing, high yearly prices, cluttered UIs, weak offline "
        "behavior, and opaque cloud data handling."
    )
    pdf.h3("Jobs to be done")
    pdf.bullet("Create a professional GST invoice in under a minute at the counter")
    pdf.bullet("Track who owes money (khata) and nudge payment via WhatsApp")
    pdf.bullet("Know GST liability (collected vs ITC) without hiring software training")
    pdf.bullet("Hand clean data to an accountant for filing without WhatsApp PDFs chaos")
    pdf.bullet("Keep working when the network drops")

    # 4 Audience
    pdf.h2("4. Target audience")
    pdf.h3("Primary: GST-registered small business owners")
    pdf.bullet("Retailers, wholesalers, traders, service SMEs with a GSTIN")
    pdf.bullet("Need invoices, HSN/SAC, CGST/SGST/IGST, purchase ITC tracking")
    pdf.bullet("Price-sensitive; often compare yearly cost vs Vyapar / myBillBook")
    pdf.bullet("Languages: English, Hindi, Hinglish")
    pdf.h3("Secondary: Everyday shops (non-GST / simple billing)")
    pdf.bullet("Onboarding path: \"Everyday Shop\" vs \"GST-registered Business\"")
    pdf.bullet("May start free and upgrade when they need unlimited invoices + GST tools")
    pdf.h3("Tertiary: Accountants / CAs")
    pdf.bullet("Manage multiple client businesses; verify bills; export; encrypted share")
    pdf.bullet("Potential B2B2C channel: accountants recommend Argus to clients")
    pdf.h3("Persona sketches")
    pdf.bullet(
        "Ramesh -- hardware retailer, 1 shop, Android phone, Hindi/Hinglish, hates apps "
        "that freeze when a customer is waiting"
    )
    pdf.bullet(
        "Priya -- CA with 40 MSME clients; wants clean GSTR summaries and secure client links, "
        "not ZIP files on WhatsApp"
    )
    pdf.bullet(
        "Amit -- growing wholesaler; needs inventory, reports, recurring invoices, web access "
        "for evening desk work"
    )

    # 5 Features
    pdf.h2("5. Features and value propositions")
    pdf.h3("Core free-path")
    pdf.bullet("Create up to 5 invoices on Free (trial of product value)")
    pdf.bullet("Basic billing; works offline on mobile")
    pdf.h3("Business plan capabilities")
    pdf.bullet("Unlimited GST invoices with HSN/SAC, auto tax calc, PDF / WhatsApp share")
    pdf.bullet("Digital khata: credit/debit, outstanding dashboard, WhatsApp reminders")
    pdf.bullet("Customers with GSTIN, phone, address, purchase history")
    pdf.bullet("Purchases & input tax credit")
    pdf.bullet("Inventory: stock, low-stock alerts, barcode, CSV import")
    pdf.bullet("GST Hub: GSTR-1, GSTR-2B, GSTR-3B summaries; HSN-wise reports; e-way credentials path")
    pdf.bullet("Reports: sales trends, category breakdown, profit margins, collections")
    pdf.bullet("Quotations, credit notes, delivery challans, expenses, recurring invoices, templates")
    pdf.bullet("Accountant collaboration with secure sharing")
    pdf.bullet("AI assist: voice invoice creation, photo-to-invoice, AI HSN suggestions")
    pdf.bullet("Smart notifications: payment reminders, pending bills, re-engagement")
    pdf.bullet("Auth: email/password, Google Sign-In, phone OTP")
    pdf.bullet("Web app access on Business")
    pdf.h3("Differentiating claims to lean on in marketing")
    pdf.bullet("Offline-first: bill even when internet is down")
    pdf.bullet("Privacy / encrypted accountant collaboration vs plain cloud-only apps")
    pdf.bullet("Simple two-tier pricing; no ads on Free")
    pdf.bullet("Voice + AI HSN to reduce typing and compliance mistakes")
    pdf.bullet("Built for shop floor + accountant workflow, not just desktop accounting clones")

    # 6 Pricing
    pdf.h2("6. Pricing and business model")
    pdf.body("Monetization is SaaS subscription. Same prices on web and Android.")
    pdf.h3("Free")
    pdf.bullet("Rs 0 -- up to 5 invoice creations; limited features (acquisition funnel)")
    pdf.h3("Business")
    pdf.bullet("Rs 500 / month  OR  Rs 5,000 / year (save Rs 1,000 vs 12x monthly)")
    pdf.bullet("All features + web app")
    pdf.bullet("Android: Google Play subscriptions (business_monthly / business_yearly)")
    pdf.bullet("Web: Razorpay checkout")
    pdf.body(
        "Marketing implication: Free is intentionally tight (5 invoices) so users feel the "
        "product quickly and hit a clear upgrade moment. Messaging should emphasize yearly "
        "value (Rs 5,000/year ~ Rs 417/month) versus competitor annual fees that users call expensive."
    )

    # 7 Competition
    pdf.h2("7. Competitive landscape")
    pdf.body(
        "Main competitors: Vyapar (very large free install base), myBillBook, Swipe. "
        "All offer offline GST billing, WhatsApp share, GST returns, inventory. Argus must "
        "not claim \"only GST app\" -- claim sharper wedges."
    )
    pdf.h3("Competitor pain points Argus can attack")
    pdf.bullet("Sync unreliability and multi-device inconsistency")
    pdf.bullet("App hangs during live billing")
    pdf.bullet("Subscription sticker shock for tiny shops")
    pdf.bullet("Feature bloat / confusing UI for non-accountants")
    pdf.bullet("Cloud data privacy anxiety")
    pdf.h3("Honest gaps (do not overclaim)")
    pdf.bullet(
        "Mature competitors may still lead on POS depth, multi-store, and polished e-invoice/"
        "e-way flows depending on release status -- verify before ads"
    )
    pdf.bullet("Prefer claims grounded in offline-first, privacy, accountant collab, AI/voice, price clarity")

    # 8 Brand
    pdf.h2("8. Brand, voice, and assets")
    pdf.h3("Brand")
    pdf.bullet("Name: Argus")
    pdf.bullet("Domain / site: argusinvoicing.com")
    pdf.bullet("Accent / brand violet used on site (~ #5B5BD6)")
    pdf.bullet("Category listing: Business; content rating Everyone")
    pdf.h3("Voice")
    pdf.bullet("Plain English / Hinglish-friendly; avoid CA jargon unless targeting accountants")
    pdf.bullet("Confident, practical, shop-floor: speed, trust, GST correctness")
    pdf.bullet("No hype about \"AI revolution\" -- AI is a helper for HSN / voice / photo entry")
    pdf.h3("Existing assets")
    pdf.bullet("Marketing site with hero, features, pricing, download")
    pdf.bullet("Play Store listing copy (short + full description)")
    pdf.bullet("User guide (in-app + PDF) and phone screenshots set for store")
    pdf.bullet("Support email: support@argusinvoicing.com")
    pdf.bullet("Privacy / Terms URLs on the site")

    # 9 Funnel
    pdf.h2("9. Current funnel and conversion logic")
    pdf.bullet("Discover: Play Store search / ads / SEO / social / accountant referral / website")
    pdf.bullet("Install or open web -> auth (Google / email / phone)")
    pdf.bullet("Onboarding: Everyday Shop vs GST-registered; optional GSTIN + business profile")
    pdf.bullet("Aha moment: first GST invoice created + shared on WhatsApp OR khata balance clear")
    pdf.bullet("Upgrade trigger: 5th invoice limit OR need inventory / GST hub / accountant / web")
    pdf.bullet("Retain: reminders, reports, filing season (GSTR), recurring invoices")
    pdf.body(
        "Seasonality tip: GST return deadlines and financial year start/end are natural "
        "campaign peaks in India."
    )

    # 10 Constraints
    pdf.h2("10. Constraints and stage assumptions")
    pdf.bullet("India-first; INR pricing; GST and HSN language in creatives")
    pdf.bullet("Android + web; do not assume strong iOS presence unless confirmed")
    pdf.bullet("Compliance-sensitive: do not promise \"auto-file GST for you\" if the product generates summaries / assists rather than replacing a CA")
    pdf.bullet("Store policies: Play Billing for in-app Android subs; keep claims consistent with listing")
    pdf.bullet("Early growth: prefer channels with measurable CAC and creative that demos the UI")
    pdf.bullet("Support capacity may be lean -- set expectations in onboarding content")

    # 11 Claude instructions
    pdf.h2("11. Instructions for Claude -- produce the marketing plan")
    pdf.prompt_box(
        "MASTER PROMPT (copy into Claude with this PDF)",
        "You are a senior growth marketer for Indian B2B SaaS / SME apps. Using ONLY the facts "
        "in the Argus Marketing Brief, create a practical marketing plan. Do not invent features, "
        "prices, or platforms. If something is unknown, list it under Assumptions / Open Questions. "
        "Optimize for installs -> first invoice -> paid Business conversion in India.",
    )
    pdf.h3("Required deliverables")
    pdf.bullet("Positioning statement (1 paragraph) + 3 messaging pillars")
    pdf.bullet("ICP ranking and which persona to win first in 90 days")
    pdf.bullet("Competitive wedge: what we say vs Vyapar / myBillBook / Swipe (fair, specific)")
    pdf.bullet("90-day plan week-by-week: goals, channels, owners (founder-default), KPIs")
    pdf.bullet("Channel strategy: Play Store ASO, Google Ads / UAC, Meta, WhatsApp/community, SEO, CA partnerships, YouTube/Reels")
    pdf.bullet("Budget scenarios: Rs 0 organic-only; Rs 25k/mo; Rs 1L/mo -- expected focus per tier")
    pdf.bullet("Funnel metrics: CTR, install, signup, first invoice, paywall view, trial-to-paid, monthly churn proxies")
    pdf.bullet("Creative briefs: 5 ad angles + 5 organic post ideas (Hindi + English variants)")
    pdf.bullet("Play Store ASO: title/subtitle tests, keyword list, screenshot order rationale")
    pdf.bullet("Launch / relaunch checklist and content calendar (first 4 weeks detailed)")
    pdf.bullet("Risks and \"do not claim\" list for compliance and trust")
    pdf.h3("Tone of the plan")
    pdf.body(
        "Be specific and operational. Prefer numbered actions over theory. Call out what a "
        "small team can ship this week. Separate \"must do\" from \"nice to have.\""
    )

    # 12 Quick facts
    pdf.h2("12. Quick fact sheet")
    pdf.bullet("Product: Argus - GST Billing & Invoicing")
    pdf.bullet("Market: India MSME / retailers / wholesalers / accountants")
    pdf.bullet("Plans: Free (5 invoices) | Business Rs 500/mo or Rs 5,000/yr")
    pdf.bullet("Key wedge: offline-first + encrypted accountant collab + simple pricing + AI/voice helpers")
    pdf.bullet("Site: https://argusinvoicing.com")
    pdf.bullet("Support: support@argusinvoicing.com")
    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 110)
    pdf.multi_cell(
        0,
        5,
        "End of brief. Update this PDF when pricing, feature set, or store presence changes "
        "so marketing plans stay accurate.",
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    return OUT


if __name__ == "__main__":
    path = build()
    print(f"Wrote {path}")
