import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Libraries change less often than app code, so each gets its own long-cached chunk. */
const VENDOR_GROUPS = [
  { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
  { name: 'firebase', test: /[\\/]node_modules[\\/](firebase|@firebase|idb|tslib)[\\/]/ },
  { name: 'dexie', test: /[\\/]node_modules[\\/](dexie|dexie-react-hooks)[\\/]/ },
];

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/**
 * Emits sw.js from sw/sw.js with the list of every file in this build, so the
 * installed app can start without a connection. Production builds only.
 */
function serviceWorker(): Plugin {
  return {
    name: 'private-ledger-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publicDir = join(import.meta.dirname, 'public');
      const built = Object.keys(bundle).filter((file) => file !== 'index.html' && !file.endsWith('.map'));
      const copied = listFiles(publicDir).map((file) => relative(publicDir, file).replace(/\\/g, '/'));
      const files = ['/', ...[...built, ...copied].sort().map((file) => `/${file}`)];
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync(join(import.meta.dirname, 'sw', 'sw.js'), 'utf8')
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('__PRECACHE__', JSON.stringify(files, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  server: { host: 'localhost' },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: VENDOR_GROUPS },
      },
    },
  },
});
