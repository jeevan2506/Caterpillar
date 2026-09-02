/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cat: {
          yellow: "#FFCD11",
          "yellow-600": "#EBBB00",
          ink: "#161514",
          dark: "#0B0B0C",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["Sora", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // warm-tinted, layered shadows — reads softer and more considered than a flat drop
        card: "0 1px 2px rgba(28,24,16,0.04), 0 4px 12px -2px rgba(28,24,16,0.05), 0 12px 28px -12px rgba(28,24,16,0.06)",
        "card-hover": "0 1px 2px rgba(28,24,16,0.05), 0 8px 20px -4px rgba(28,24,16,0.08), 0 24px 48px -16px rgba(28,24,16,0.12)",
        lift: "0 20px 44px -14px rgba(28,24,16,0.20)",
        glow: "0 0 0 1px rgba(255,205,17,0.35), 0 8px 30px -6px rgba(255,205,17,0.25)",
        "inner-t": "inset 0 1px 0 rgba(255,255,255,0.10)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.3s ease-out both",
        "scale-in": "scale-in 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};
