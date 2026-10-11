"use client";

import { SUPPORT_WHATSAPP } from "@/lib/legal";

const message = "Hi Argus, I have a question about billing for my shop.";

/** Floating "Chat on WhatsApp" button for support. */
export function WhatsAppButton() {
  if (!SUPPORT_WHATSAPP) return null;
  const href = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Argus support on WhatsApp"
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#25d366] py-3 pl-3 pr-3 text-white shadow-lift transition hover:pr-5 hover:shadow-glow sm:bottom-6 sm:right-6"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" fill="currentColor" aria-hidden>
        <path d="M16.04 3C9.4 3 4 8.32 4 14.87c0 2.62.87 5.04 2.34 7L4.8 28.5l6.9-1.78a12.2 12.2 0 0 0 4.34.8c6.63 0 12.03-5.32 12.03-11.87S22.67 3 16.04 3Zm0 21.6c-1.4 0-2.77-.3-4.03-.86l-.29-.13-4.1 1.05.97-3.9-.2-.31a9.66 9.66 0 0 1-1.6-5.33c0-5.38 4.45-9.75 9.25-9.75 5.43 0 9.26 4.37 9.26 9.75s-4.13 9.48-9.26 9.48Zm5.3-7.28c-.29-.14-1.72-.84-1.99-.93-.27-.1-.46-.14-.65.14-.2.28-.75.93-.92 1.12-.17.19-.34.21-.63.07-.29-.14-1.23-.45-2.34-1.43-.86-.76-1.45-1.7-1.62-1.99-.17-.28-.02-.43.13-.57.13-.13.29-.33.43-.5.15-.17.2-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.65-1.55-.89-2.12-.23-.56-.47-.48-.65-.49h-.55c-.2 0-.5.07-.77.36-.26.28-1 .97-1 2.38 0 1.4 1.03 2.76 1.17 2.95.15.19 2.03 3.06 4.92 4.29.69.29 1.22.47 1.64.6.69.21 1.32.18 1.81.11.55-.08 1.72-.69 1.96-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.33Z" />
      </svg>
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 group-hover:max-w-[12rem]">
        Chat on WhatsApp
      </span>
    </a>
  );
}
