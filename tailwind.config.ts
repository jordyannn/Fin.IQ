import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        income: {
          DEFAULT: "#10b981",
          light: "#d1fae5",
          dark: "#047857",
        },
        expense: {
          DEFAULT: "#ef4444",
          light: "#fee2e2",
          dark: "#b91c1c",
        },
        transfer: {
          DEFAULT: "#3b82f6",
          light: "#dbeafe",
          dark: "#1d4ed8",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        "level-1": "0px 4px 20px -2px rgba(15, 23, 42, 0.03), 0px 2px 6px -1px rgba(15, 23, 42, 0.02)",
        "level-2": "0px 12px 32px -4px rgba(15, 23, 42, 0.06), 0px 4px 12px -2px rgba(15, 23, 42, 0.03)",
        "glow-emerald": "0px 8px 20px -4px rgba(5, 150, 105, 0.2)",
      },
      borderRadius: {
        "3xl": "16px",
        "2xl": "14px",
        xl: "12px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "4px",
        xs: "2px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
