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
          blue: "#5266eb",
          ghost: "#cdddff",
        },
        abyss: "#171721",
        midnight: "#1e1e2a",
        graphite: "#272735",
        lead: "#70707d",
        starlight: "#ededf3",
        silver: "#c3c3cc",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        btn: "32px",
        "btn-lg": "40px",
      },
    },
  },
  plugins: [],
};

export default config;
