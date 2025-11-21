/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      rotate: ['peer-checked'],
      colors: {
        primary: "#16A34A",
        secondary: "#DCFCE7",
        section: "#F0FDF4",
        feature: "#1B1C22",
      },
    },
  },
  plugins: [],
};
