import type { Config } from "tailwindcss";
import defaultColors from "tailwindcss/colors";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mercury: {
          blue: "#1e2a5e",
          ghost: "#12a150",
        },
        // Brand: navy + green ("Accounting made clear").
        navy: { DEFAULT: "#1e2a5e", deep: "#172349", soft: "#eef1f8" },
        // Light theme mapping (old dark names → new light values)
        abyss: "#ffffff",
        midnight: "#f8f9fa",
        graphite: "#e9ebf0",
        lead: "#b3b3b3",
        starlight: "#1b2550",
        silver: "#646464",
        // New semantic colors
        ink: "#1b2550",
        onyx: "#090c1d",
        carbon: "#2a2a2a",
        slate: "#5b6478",
        ash: "#838383",
        fog: "#b3b3b3",
        cloud: "#d4d4d4",
        bone: "#e8e8e8",
        mist: "#f8f9fa",
        plaster: "#e9ebf0",
        "brand-violet": "#12a150",
        "signal-blue": "#0e8f7e",
        mint: "#6ee7b7",
        // Keep Tailwind's emerald-50…950 scale; bare `emerald` is the brand green.
        emerald: { ...defaultColors.emerald, DEFAULT: "#00c07a" },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "var(--font-jakarta)",
          "Plus Jakarta Sans",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "Sometype Mono",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        btn: "9999px",
        "btn-lg": "9999px",
        card: "12px",
        "card-lg": "20px",
        input: "9px",
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.035em",
      },
      boxShadow: {
        subtle: "rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.1) 0px 1px 2px -1px",
        card: "rgba(13, 21, 48, 0.04) 0px 4px 4px 0px",
        lift: "0 1px 2px rgba(16, 24, 40, 0.04), 0 12px 32px -12px rgba(49, 36, 120, 0.18)",
        glow: "0 0 0 1px rgba(18, 161, 80, 0.15), 0 20px 48px -20px rgba(18, 161, 80, 0.45)",
      },
      keyframes: {
        aurora: {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(2%, -3%, 0) scale(1.06)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        aurora: "aurora 14s ease-in-out infinite",
        "float-slow": "float-slow 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
