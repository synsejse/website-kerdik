// @ts-check
import { defineConfig } from "astro/config";
import icon from "astro-icon";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
    output: "static",

    integrations: [icon()],

    i18n: {
        locales: ["sk"],
        defaultLocale: "sk",
    },

    experimental: {
        svgo: true,
    },

    vite: {
        plugins: [/** @type {any} */ (tailwindcss())],
    },
});
