import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, FileText, Mic, Package, Share2, Users } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { AuthModal } from "@/components/AuthModal";
import { ProfileModal } from "@/components/ProfileModal";
import { Reveal } from "@/components/Reveal";
import { PhoneScreens } from "@/components/PhoneScreens";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Argus — दुकान के लिए GST बिलिंग और हिसाब-किताब",
    description:
      "बोलकर बिल बनाइए, स्टॉक और उधार संभालिए, GSTR सारांश तैयार कीजिए और अपने CA के साथ बही शेयर कीजिए। Android पर हर महीने 20 बिल मुफ़्त।",
    path: "/hi/",
  }),
  alternates: { canonical: "/hi/", languages: { "en-IN": "/", "hi-IN": "/hi/" } },
};

const features = [
  { icon: Mic, title: "बोलकर बिल", body: "हिंदी या अंग्रेज़ी में बोलिए — \"शर्मा जी को दो अलमारी, नौ हज़ार वाली\"। Argus बिल बना देता है, आप एक बार जाँच लीजिए।" },
  { icon: FileText, title: "सही GST बिल", body: "0, 5, 18 और 40% की नई दरें पहले से। Rule 46 की सारी ज़रूरी जानकारी हर बिल पर। डिलीवरी चार्ज पर भी सही टैक्स।" },
  { icon: Share2, title: "WhatsApp पर भेजिए", body: "बिल की PDF और UPI पेमेंट लिंक सीधे ग्राहक को WhatsApp पर।" },
  { icon: Package, title: "स्टॉक और ख़रीद", body: "बेचते ही स्टॉक घटता है, ख़रीद पर बढ़ता है। कम स्टॉक की याद दिलाता है।" },
  { icon: BookOpen, title: "उधार-खाता", body: "किसका कितना बाक़ी है, एक नज़र में। याद दिलाने का मैसेज एक टैप में।" },
  { icon: Users, title: "CA के लिए मुफ़्त", body: "अपने CA को बुलाइए — वे बही देख सकते हैं, बदल नहीं सकते। जब चाहें बंद कीजिए।" },
];

const faqs = [
  {
    q: "क्या Argus मुफ़्त है?",
    a: "हाँ। Android ऐप पर हर महीने 20 बिल मुफ़्त हैं (बिल पर छोटा \"Made with Argus\" लिखा रहता है)। असीमित बिल, वेब ऐप, GST सारांश और CA पोर्टल Business प्लान में हैं — ₹500 महीना या ₹5,000 साल।",
  },
  {
    q: "क्या Argus मेरा GST रिटर्न भरता है?",
    a: "नहीं। Argus आपके बिल और GSTR सारांश तैयार करता है, और GSTR-1 की फ़ाइल देता है। रिटर्न आप या आपके CA GST पोर्टल पर भरते हैं।",
  },
  {
    q: "इंटरनेट न हो तो?",
    a: "फ़ोन पर बिल बिना इंटरनेट के भी बनते हैं। इंटरनेट आने पर Business प्लान में वेब ऐप से सिंक हो जाते हैं।",
  },
  {
    q: "मेरा डेटा सुरक्षित है?",
    a: "आपकी बही आपके फ़ोन पर रहती है। क्लाउड सिंक चालू करने पर Google Cloud पर सुरक्षित रखी जाती है। हम आपका डेटा न बेचते हैं, न विज्ञापन के लिए इस्तेमाल करते हैं।",
  },
];

export default function HindiHomePage() {
  return (
    <>
      <Navbar />
      <main lang="hi">
        <section className="relative isolate overflow-hidden bg-gradient-to-b from-[#f3f7fb] to-white pb-20 pt-32 md:pt-40">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(110,231,183,0.35),transparent)] blur-2xl" />
            <div className="absolute right-[-10%] top-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(253,186,116,0.22),transparent)] blur-2xl" />
          </div>
          <div className="container-page flex flex-col items-center text-center">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm font-semibold text-amber-600">
              नई GST दरें 0 / 5 / 18 / 40% पहले से शामिल
            </span>
            <h1 className="font-display text-5xl font-extrabold leading-tight text-ink md:text-7xl">
              हिसाब-किताब, <span className="text-brand-violet">एकदम साफ़।</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate">
              ग्राहकों के बिल, स्टॉक और उधार, GSTR सारांश और CA के साथ बही — भारत की दुकानों के लिए एक
              ही जगह, फ़ोन पर भी और कंप्यूटर पर भी।
            </p>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-base font-medium text-ink">
              {["बोलकर बिल", "CA के लिए मुफ़्त", "फ़ोन और वेब पर एक ही लॉगिन"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-5 w-5 text-brand-violet" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <a href="/app/" className="btn-primary group px-7 py-3.5 text-base">
                14 दिन मुफ़्त आज़माइए
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </a>
              <span className="btn-secondary pointer-events-none px-7 py-3.5 text-base text-slate">
                Android ऐप जल्द Play Store पर
              </span>
            </div>
            <p className="mt-4 text-sm text-slate">कोई कार्ड नहीं चाहिए</p>
          </div>
        </section>

        <PhoneScreens lang="hi" />

        <section className="bg-mist py-20 md:py-28">
          <div className="container-page">
            <Reveal>
              <h2 className="mb-12 text-center font-display text-4xl font-bold text-ink">दुकान का पूरा काम, एक ऐप में</h2>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <div key={title} className="card p-6">
                  <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mb-2 text-xl font-bold text-ink">{title}</h3>
                  <p className="leading-relaxed text-slate">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="container-page max-w-3xl">
            <h2 className="mb-10 text-center font-display text-4xl font-bold text-ink">अक्सर पूछे जाने वाले सवाल</h2>
            <div className="divide-y divide-bone rounded-card-lg border border-bone bg-white">
              {faqs.map((f) => (
                <details key={f.q} className="group px-6">
                  <summary className="cursor-pointer list-none py-5 text-lg font-semibold text-ink">{f.q}</summary>
                  <p className="pb-5 leading-relaxed text-slate">{f.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-8 text-center text-slate">
              और सवाल? नीचे WhatsApp बटन से हमसे बात कीजिए, या{" "}
              <Link href="/" className="font-semibold text-brand-violet hover:underline">
                English में पढ़िए
              </Link>
              ।
            </p>
          </div>
        </section>

        <section className="relative isolate overflow-hidden bg-navy py-20 text-center text-white md:py-24">
          <div className="container-page">
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold">इस महीने का GST, बिना टेंशन</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">पूरा Business प्लान 14 दिन मुफ़्त। कोई कार्ड नहीं।</p>
            <a href="/app/" className="btn-primary group mt-8 px-7 py-3.5 text-base">
              मुफ़्त शुरू कीजिए
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
      <AuthModal />
      <ProfileModal />
    </>
  );
}
