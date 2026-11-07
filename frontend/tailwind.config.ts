import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F8FAFC",
        surface: "#FFFFFF",
        navy: {
          950: "#080d1a",
          900: "#0F172A",
          800: "#1E293B",
          700: "#334155",
        },
        royal: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563EB",
          700: "#1d4ed8",
        },
        cyan: {
          50: "#ecfeff",
          100: "#cffafe",
          400: "#22d3ee",
          500: "#06B6D4",
          600: "#0891B2",
          700: "#0e7490",
        },
        badge: {
          completed: "#10B981",
          progress: "#F59E0B",
          declined: "#F43F5E",
        }
      },
    },
  },
  plugins: [],
};
export default config;
