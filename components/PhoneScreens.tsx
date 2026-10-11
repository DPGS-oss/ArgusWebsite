"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "./Reveal";

type Lang = "en" | "hi";

// Real screenshots of the Android app (sample shop data).
const screens: { src: string; en: string; hi: string }[] = [
  { src: "/screens/dashboard.png", en: "Today at a glance", hi: "आज का हाल" },
  { src: "/screens/invoice.png", en: "A GST bill in seconds", hi: "सेकंडों में GST बिल" },
  { src: "/screens/gst.png", en: "GSTR summaries for your CA", hi: "CA के लिए GSTR सारांश" },
];

const copy = {
  en: { eyebrow: "The Android app", title: "Your shop in your pocket", sub: "Real screens from the Argus app, with a sample shop." },
  hi: { eyebrow: "Android ऐप", title: "दुकान आपकी जेब में", sub: "Argus ऐप की असली स्क्रीन, एक नमूना दुकान के साथ।" },
};

function Phone({ src, label, i }: { src: string; label: string; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.figure
      initial={reduce ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col items-center ${i === 1 ? "md:-mt-10" : "md:mt-8"}`}
    >
      <div className="relative w-[230px] rounded-[2.6rem] border-[10px] border-navy-deep bg-navy-deep shadow-[0_40px_80px_-30px_rgba(30,42,94,0.55)]">
        <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-navy-deep" aria-hidden />
        <div className="overflow-hidden rounded-[2rem] bg-white">
          <Image src={src} alt={label} width={540} height={1200} className="h-auto w-full" />
        </div>
      </div>
      <figcaption className="mt-5 text-sm font-semibold text-ink">{label}</figcaption>
    </motion.figure>
  );
}

/** Three real app screens in phone frames. */
export function PhoneScreens({ lang = "en" }: { lang?: Lang }) {
  const t = copy[lang];
  return (
    <section className="overflow-hidden bg-white py-20 md:py-28">
      <div className="container-page">
        <Reveal>
          <div className="section-header">
            <span className="eyebrow">{t.eyebrow}</span>
            <h2>{t.title}</h2>
            <p>{t.sub}</p>
          </div>
        </Reveal>
        <div className="flex flex-col items-center justify-center gap-10 md:flex-row md:items-start md:gap-12">
          {screens.map((s, i) => (
            <Phone key={s.src} src={s.src} label={s[lang]} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
