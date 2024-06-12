import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      black: colors.black,
      white: colors.white,
      gray: colors.gray,
      indigo: colors.indigo,
      red: colors.rose,
      yellow: colors.amber,
      outer: {
        100: "rgb(0,0,0,0.6)",
      },
      beep: {
        100: "#D7F8F7",
      },

      nice: {
        50: "#E6FEF4",
        100: "#D3FDEC",
        200: "#A2FBD6",
        300: "#76FAC3",
        400: "#49F8AF",
        500: "#1CF69A",
        600: "#08D37F",
        700: "#069D5E",
        800: "#04673E",
        900: "#023620",
        950: "#01190F",
      },
      naughty: {
        50: "#FDEDF1",
        100: "#FBDFE7",
        200: "#F7BACC",
        300: "#F49AB4",
        400: "#F07A9C",
        500: "#EC5780",
        600: "#E61E57",
        700: "#AE143F",
        800: "#730D2A",
        900: "#3C0716",
        950: "#1B030A",
      },
    },
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
