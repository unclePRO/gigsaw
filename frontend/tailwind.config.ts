import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--card-bg)",
        border: "var(--border-color)",
        teal: {
          deep: '#10413E',
          ocean: '#168C80',
          dark: '#126B64',
          hover: '#10766D',
        },
        aqua: {
          DEFAULT: '#32B6A5',
          soft: '#73D8C7',
          pale: '#C5EEE6',
          mint: '#E5F5F1',
        },
        merchant: {
          bg: '#F0F8F6',
          darkBg: '#102B2B',
          card: '#FFFFFF',
          darkCard: '#1B3B39',
          heading: '#10413E',
          darkHeading: '#F0FAF8',
          text: '#527773',
          darkText: '#A3C5BF',
          border: '#D8E9E4',
          darkBorder: '#345451',
          primary: '#168C80',
          darkPrimary: '#32B6A5',
          activeNav: '#E5F5F1',
          darkActiveNav: '#254542',
        },
        freelancer: {
          bg: '#F0F8F6',
          darkBg: '#102B2B',
          card: '#FFFFFF',
          darkCard: '#1B3B39',
          heading: '#10413E',
          darkHeading: '#F0FAF8',
          text: '#527773',
          darkText: '#A3C5BF',
          border: '#D8E9E4',
          darkBorder: '#345451',
          primary: '#168C80',
          darkPrimary: '#32B6A5',
          secondary: '#73D8C7',
          highlight: '#C5EEE6',
          darkHighlight: '#254542',
          activeNav: '#E5F5F1',
          darkActiveNav: '#254542',
        },
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
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.3)',
        'glow-royal': '0 0 25px -5px rgba(37, 99, 235, 0.3)',
        'glow-aqua': '0 0 25px -5px rgba(115, 216, 199, 0.35)',
      }
    },
  },
  plugins: [],
};
export default config;
