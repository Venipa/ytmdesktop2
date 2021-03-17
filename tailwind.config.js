const colors = require("tailwindcss/colors");

module.exports = {
  purge: { content: ["./public/**/*.html", "./src/**/*.vue"] },
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        ...require("daisyui/colors"),
        gray: {
          "50": "#f4f4f4",
          "100": "#e9e9ea",
          "200": "#c8c9ca",
          "300": "#a7a9aa",
          "400": "#65686a",
          "500": "#23272a",
          "600": "#202326",
          "700": "#1a1d20",
          "800": "#151719",
          "900": "#111315",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("daisyui")],
};
