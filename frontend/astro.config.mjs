// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  output: 'static',
  
  i18n: {
    locales: ["sk"],
    defaultLocale: "sk",
  },

  experimental: {
    svgo: true,
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
