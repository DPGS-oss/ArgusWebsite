import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mercury: {
          blue: "#6647f0",
          ghost: "#0091ff",
        },
        // Light theme mapping (old dark names → new light values)
        abyss: "#ffffff",
        midnight: "#f8f9fa",
        graphite: "#e9ebf0",
        lead: "#b3b3b3",
        starlight: "#202020",
        silver: "#646464",
        // New semantic colors
        ink: "#202020",
        onyx: "#090c1d",
        carbon: "#2a2a2a",
        slate: "#646464",
        ash: "#838383",
        fog: "#b3b3b3",
        cloud: "#d4d4d4",
        bone: "#e8e8e8",
        mist: "#f8f9fa",
        plaster: "#e9ebf0",
        "brand-violet": "#6647f0",
        "signal-blue": "#0091ff",
        mint: "#6ee7b7",
        emerald: "#00c07a",
      },
      fontFamily: {
        sans: [
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
      },
    },
  },
  plugins: [],
};

export default config;
