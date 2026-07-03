import type { Config } from "tailwindcss";

/*
 * Sanctuary — Warm Vault theme. Semantic tokens map to the CSS variables in
 * app/globals.css (single source of truth). Use bg-surface / text-fg-muted /
 * text-primary etc. — never raw hex in components.
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: {
          DEFAULT: "var(--color-surface)",
          2: "var(--color-surface-2)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          fg: "var(--color-on-primary)",
        },
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        success: "var(--color-success)",
        fg: {
          DEFAULT: "var(--color-fg)",
          muted: "var(--color-fg-muted)",
        },
        border: "var(--color-border)",
        destructive: "var(--color-destructive)",
        ring: "var(--color-ring)",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        glow: "var(--shadow-glow)",
      },
      ringColor: {
        DEFAULT: "var(--color-ring)",
      },
    },
  },
  plugins: [],
};
export default config;
