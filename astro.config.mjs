// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// Cambia SITE por el dominio real en producción
const SITE = process.env.SITE_URL || 'https://meridiano.example';

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'ignore',

  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: false, // ES en /, EN en /en/
    },
    fallback: {
      en: 'es', // si falta una traducción, cae a español
    },
  },

  integrations: [
    tailwind({ applyBaseStyles: false }),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'es',
        locales: {
          es: 'es-CO',
          en: 'en-US',
        },
      },
    }),
  ],

  build: {
    inlineStylesheets: 'auto',
    assets: '_assets',
  },

  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
});
