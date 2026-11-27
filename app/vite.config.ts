import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Libraries change less often than app code, so each gets its own long-cached chunk. */
const VENDOR_GROUPS = [
  { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
  { name: 'firebase', test: /[\\/]node_modules[\\/](firebase|@firebase|idb|tslib)[\\/]/ },
  { name: 'dexie', test: /[\\/]node_modules[\\/](dexie|dexie-react-hooks)[\\/]/ },
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: 'localhost' },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: VENDOR_GROUPS },
      },
    },
  },
});
