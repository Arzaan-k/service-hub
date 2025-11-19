import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 4px 12px rgba(255, 180, 150, 0.25)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        peach: {
          50: "#FFF5F3",
          100: "#FFE1D9",
          200: "#FFC9B8",
          300: "#FFB89E",
        },
        // Global theme overrides
        lightBg: "#FFF9F7",
        lightCard: "#FFE9E0",
        darkText: "#1F1F1F",
        accentPeach: "#FFD4E3",
        accentOrange: "#FFB899",
        accentHover: "#FFC6A3",
        // Named palette tokens
        babyPink: "#FFD4E3",
        peach: "#FFE5B4",
        warmOrange: "#FFA07A",
        softWhite: "#FFFDFB",
        borderPeach: "#FFE0D6",
        coral: "#FF6F61",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          light: "hsl(var(--primary-light))",
          dark: "hsl(var(--primary-dark))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        // Functional Area Colors
        dashboard: {
          DEFAULT: "hsl(var(--dashboard))",
          foreground: "hsl(var(--dashboard-foreground))",
          light: "hsl(var(--dashboard-light))",
          dark: "hsl(var(--dashboard-dark))",
        },
        containers: {
          DEFAULT: "hsl(var(--containers))",
          foreground: "hsl(var(--containers-foreground))",
          light: "hsl(var(--containers-light))",
          dark: "hsl(var(--containers-dark))",
        },
        alerts: {
          DEFAULT: "hsl(var(--alerts))",
          foreground: "hsl(var(--alerts-foreground))",
          light: "hsl(var(--alerts-light))",
          dark: "hsl(var(--alerts-dark))",
        },
        service: {
          DEFAULT: "hsl(var(--service))",
          foreground: "hsl(var(--service-foreground))",
          light: "hsl(var(--service-light))",
          dark: "hsl(var(--service-dark))",
        },
        technicians: {
          DEFAULT: "hsl(var(--technicians))",
          foreground: "hsl(var(--technicians-foreground))",
          light: "hsl(var(--technicians-light))",
          dark: "hsl(var(--technicians-dark))",
        },
        scheduling: {
          DEFAULT: "hsl(var(--scheduling))",
          foreground: "hsl(var(--scheduling-foreground))",
          light: "hsl(var(--scheduling-light))",
          dark: "hsl(var(--scheduling-dark))",
        },
        clients: {
          DEFAULT: "hsl(var(--clients))",
          foreground: "hsl(var(--clients-foreground))",
          light: "hsl(var(--clients-light))",
          dark: "hsl(var(--clients-dark))",
        },
        whatsapp: {
          DEFAULT: "hsl(var(--whatsapp))",
          foreground: "hsl(var(--whatsapp-foreground))",
          light: "hsl(var(--whatsapp-light))",
          dark: "hsl(var(--whatsapp-dark))",
        },
        inventory: {
          DEFAULT: "hsl(var(--inventory))",
          foreground: "hsl(var(--inventory-foreground))",
          light: "hsl(var(--inventory-light))",
          dark: "hsl(var(--inventory-dark))",
        },
        analytics: {
          DEFAULT: "hsl(var(--analytics))",
          foreground: "hsl(var(--analytics-foreground))",
          light: "hsl(var(--analytics-light))",
          dark: "hsl(var(--analytics-dark))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
