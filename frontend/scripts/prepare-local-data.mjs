import { mkdirSync, writeFileSync } from 'node:fs';

// Local builds may provide private seed files. Never overwrite those files.
const empty = { subscriptions: [], accounts: [], watchlist: [], promos: [], inbox: [] };
for (const filename of ['personal-workbook.json', 'pasted-audit.json']) {
  const url = new URL('../src/data/' + filename, import.meta.url);
  mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });
  try { writeFileSync(url, JSON.stringify(empty, null, 2) + '\n', { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}
try {
  writeFileSync(new URL('../src/lib/device-ai-seed.ts', import.meta.url),
    '// Optional local-only seed. Configure provider keys in Profile.\nexport const DEVICE_GEMINI_SEED = "";\n', { flag: 'wx' });
} catch (error) { if (error.code !== 'EEXIST') throw error; }
