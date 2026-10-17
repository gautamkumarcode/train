import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Nostalgic Indian Railways palette
        berth: {
          night: "#0b1020",
          deep: "#111a33",
          steel: "#1c2b4d",
        },
        coach: {
          red: "#b3261e",
          maroon: "#7a1c17",
          cream: "#f4e9d2",
        },
        signal: {
          amber: "#f5b301",
          green: "#1f8a4c",
          red: "#d64545",
        },
      },
      fontFamily: {
        // Evokes the chunky departure-board / ticker lettering of railway stations.
        board: ["'Courier New'", "ui-monospace", "monospace"],
        display: ["Georgia", "'Times New Roman'", "serif"],
      },
      keyframes: {
        "track-scroll": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "-80px 0" },
        },
        "chain-pull": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(6px) rotate(-6deg)" },
          "75%": { transform: "translateY(-2px) rotate(4deg)" },
        },
        "steam-rise": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "0.6" },
          "100%": { transform: "translateY(-40px) scale(1.6)", opacity: "0" },
        },
        "eq-bar": {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
        // Endless-journey parallax: layers scroll by shifting background-position.
        "hill-scroll": {
          "0%": { backgroundPosition: "0 center" },
          "100%": { backgroundPosition: "-1200px center" },
        },
        "pole-scroll": {
          "0%": { backgroundPosition: "0 bottom" },
          "100%": { backgroundPosition: "-360px bottom" },
        },
        "rail-scroll": {
          "0%": { backgroundPosition: "0 bottom" },
          "100%": { backgroundPosition: "-48px bottom" },
        },
        // Trackside crowd sliding past (train running by a waiting platform).
        "platform-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        // Generic seamless parallax scroll (duration set per-layer inline).
        "scroll-x": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "wheel-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "train-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-1.5px)" },
        },
        // High-frequency carbody jolt as the wheels clack over each sleeper.
        "train-clack": {
          "0%, 100%": { transform: "translateY(0)" },
          "25%": { transform: "translateY(-0.6px)" },
          "50%": { transform: "translateY(0.2px)" },
          "75%": { transform: "translateY(-0.4px)" },
        },
        // Foreground motion-blur speed lines (period 60 divides the 120px slide).
        "streak-scroll": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "-120px 0" },
        },
      },
      animation: {
        "track-scroll": "track-scroll 1s linear infinite",
        "chain-pull": "chain-pull 0.5s ease-in-out",
        "steam-rise": "steam-rise 1.8s ease-out infinite",
        "eq-bar": "eq-bar 0.9s ease-in-out infinite",
        "hill-scroll": "hill-scroll 24s linear infinite",
        "pole-scroll": "pole-scroll 4s linear infinite",
        "rail-scroll": "rail-scroll 0.5s linear infinite",
        "platform-scroll": "platform-scroll 9s linear infinite",
        "scroll-x": "scroll-x 20s linear infinite",
        "wheel-spin": "wheel-spin 0.4s linear infinite",
        "train-bob": "train-bob 0.7s ease-in-out infinite",
        "train-clack": "train-clack 0.34s linear infinite",
        "streak-scroll": "streak-scroll 0.3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
