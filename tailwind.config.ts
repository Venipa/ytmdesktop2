
import svgToDataUri from "mini-svg-data-uri";
import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";
// @ts-ignore
import { default as flattenColorPalette } from "tailwindcss/lib/util/flattenColorPalette";
function addVariablesForColors({ addBase, theme }: any) {
  let allColors = flattenColorPalette(theme("colors"));
  let newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val]),
  );

  addBase({
    ":root": newVars,
  });
}
export default {
  darkMode: ["class"],
  content: ["src/renderer/**/*.{vue,ts,html}"],
  corePlugins: {
    outlineWidth: false,
    outlineColor: false,
    outlineStyle: false,
  },
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
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        moveUp: "moveUp 1.4s ease forwards",
        appear: "appear 1s 1s forwards",
        marquee: "marquee var(--duration, 30s) linear infinite",
      },
    },
  },
  plugins: [
    require("daisyui"),
    tailwindAnimate,
    addVariablesForColors,
    function ({ matchUtilities, theme, addUtilities }: any) {
      matchUtilities(
        {
          "bg-grid": (value: any) => ({
            backgroundImage: `url("${svgToDataUri(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="${value}"><path d="M0 .5H31.5V32"/></svg>`,
            )}")`,
          }),
          "bg-grid-small": (value: any) => ({
            backgroundImage: `url("${svgToDataUri(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="8" height="8" fill="none" stroke="${value}"><path d="M0 .5H31.5V32"/></svg>`,
            )}")`,
          }),
          "bg-dot": (value: any) => ({
            backgroundImage: `url("${svgToDataUri(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="16" height="16" fill="none"><circle fill="${value}" id="pattern-circle" cx="10" cy="10" r="1.6257413380501518"></circle></svg>`,
            )}")`,
          }),
          "bg-dot-thick": (value: any) => ({
            backgroundImage: `url("${svgToDataUri(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="16" height="16" fill="none"><circle fill="${value}" id="pattern-circle" cx="10" cy="10" r="2.5"></circle></svg>`,
            )}")`,
          }),
        },
        { values: flattenColorPalette(theme("backgroundColor")), type: "color" },
      );
    },
    function ({ addUtilities, theme }) {
      const newUtilities = {
        ".vignette-clip": {
          "--vignette-color": "black",
          "--vignette-width": "100%",
          "--vignette-height": "100%",
          maskImage:
            "radial-gradient(ellipse var(--vignette-width) var(--vignette-height) at center, var(--vignette-color) 50%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse var(--vignette-width) var(--vignette-height) at center, var(--vignette-color) 50%, transparent 100%)",
        },
      };

      // Generate utilities for vignette colors
      const vignetteColors = theme("colors");
      Object.keys(vignetteColors).forEach((color) => {
        const colorValue = vignetteColors[color];
        if (typeof colorValue === "string") {
          newUtilities[`.vignette-${color}`] = {
            "--vignette-color": colorValue,
          };
        } else if (typeof colorValue === "object") {
          Object.keys(colorValue).forEach((shade) => {
            newUtilities[`.vignette-${color}-${shade}`] = {
              "--vignette-color": colorValue[shade],
            };
          });
        }
      });

      // Generate utilities for vignette width and height
      const percentages = Array.from({ length: 21 }, (_, i) => i * 5);
      percentages.forEach((percent) => {
        newUtilities[`.vignette-w-${percent}`] = {
          "--vignette-width": `${percent}%`,
        };
        newUtilities[`.vignette-h-${percent}`] = {
          "--vignette-height": `${percent}%`,
        };
      });

      addUtilities(newUtilities);
    },
  ],
} satisfies Config;
