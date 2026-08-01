import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { border: "hsl(var(--border))", background: "hsl(var(--background))", foreground: "hsl(var(--foreground))", muted: "hsl(var(--muted))", "muted-foreground": "hsl(var(--muted-foreground))", primary: "hsl(var(--primary))" },
      boxShadow: { soft: "0 12px 32px rgba(15, 23, 42, .07)" },
    },
  },
  plugins: [],
};
export default config;
