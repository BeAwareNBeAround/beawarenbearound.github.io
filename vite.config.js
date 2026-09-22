import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lingui } from '@lingui/vite-plugin';
import babel from '@rolldown/plugin-babel';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    lingui(),
    react(),
    babel({ plugins: ['@lingui/babel-plugin-lingui-macro'] }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: "香港腦癇基金會 - 守望相助 (EFHK Be Aware n' Be Around)",
        short_name: 'EFHK 守望相助',
        description: '處理急性腦癇發作的口訣 / Acute Seizure Management Slogan',
        display: 'standalone',
        background_color: '#fff9f5',
        theme_color: '#f57c00',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  define: {
    'import.meta.env.VITE_VISIT_COUNTER_URL': JSON.stringify(
      'https://epilepsy.org.hk/counter/',
    ),
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
