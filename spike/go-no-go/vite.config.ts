import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const RESULTS_DIR = fileURLToPath(new URL('./results/', import.meta.url));
const MAX_BODY_BYTES = 2_000_000;

/**
 * Dev-only endpoint: the test page POSTs its report here so the results land
 * on disk (results/latest.json) instead of having to be copied by hand.
 */
function resultsWriter(): Plugin {
  return {
    name: 'go-no-go-results-writer',
    configureServer(server) {
      server.middlewares.use('/__results', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            res.statusCode = 413;
            res.end('report too large');
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        req.on('end', () => {
          if (res.writableEnded) return;
          try {
            const report = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const text = JSON.stringify(report, null, 2);
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            mkdirSync(RESULTS_DIR, { recursive: true });
            writeFileSync(`${RESULTS_DIR}run-${stamp}.json`, text);
            writeFileSync(`${RESULTS_DIR}latest.json`, text);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ saved: `results/run-${stamp}.json` }));
          } catch {
            res.statusCode = 400;
            res.end('invalid JSON');
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [resultsWriter()],
  server: { host: 'localhost' },
});
