import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FAF6F0",
          50: "#FDFBF7",
          100: "#FAF6F0",
          200: "#F3EBE0",
          300: "#E6D8C5",
        },
        botanical: {
          50: "#F1F7F4",
          100: "#E0ECE4",
          200: "#C1DACB",
          500: "#2B5E43",
          600: "#214C35",
          700: "#1A3D2A",
          800: "#142F21",
          900: "#0F2218",
        },
        petal: {
          50: "#FCF4F5",
          100: "#F9E4E7",
          200: "#F3C5CD",
          400: "#E27B8F",
          500: "#CF4D67",
          600: "#B0344D",
        },
        marigold: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          400: "#F59E0B",
          500: "#D97706",
          600: "#B45309",
        }
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "serif"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(27, 61, 42, 0.06)',
        'elevated': '0 10px 30px -4px rgba(27, 61, 42, 0.1)',
      }
    },
  },
  plugins: [],
};

export default config;
