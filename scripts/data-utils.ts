import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
export const remote = process.argv.includes('--remote');
export const dryRun = process.argv.includes('--dry-run');
export const sql = (v: unknown): string =>
  v === null || v === undefined
    ? 'NULL'
    : typeof v === 'number'
      ? String(v)
      : `'${String(v).replaceAll("'", "''")}'`;
export async function source(key: 'fitness' | 'locations' | 'map', path: string) {
  const locks = JSON.parse(await readFile('data/sources.lock.json', 'utf8')) as Record<
    string,
    { repository: string; commit: string; license: string }
  >;
  const lock = locks[key];
  const url = `https://raw.githubusercontent.com/${lock.repository}/${lock.commit}/${path}`;
  const cache = `data/cache/${key}-${lock.commit}-${path.replaceAll('/', '-')}`;
  await mkdir('data/cache', { recursive: true });
  let content: string;
  try {
    content = await readFile(cache, 'utf8');
  } catch {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    content = await response.text();
    await writeFile(cache, content);
  }
  return { ...lock, url, content, sha256: createHash('sha256').update(content).digest('hex') };
}
export async function executeSQL(statements: string[], label: string) {
  await mkdir('data/generated', { recursive: true });
  // D1 import files are intentionally bounded; safe to resume because import statements are upserts.
  for (let offset = 0; offset < statements.length; offset += 2000) {
    const path = `data/generated/${label}-${Math.floor(offset / 2000)}.sql`;
    await writeFile(path, statements.slice(offset, offset + 2000).join('\n'));
    if (!dryRun)
      execFileSync(
        'pnpm',
        [
          'exec',
          'wrangler',
          'd1',
          'execute',
          'fubao',
          remote ? '--remote' : '--local',
          '--file',
          path,
        ],
        { stdio: 'pipe' },
      );
    if (offset % 4000 === 0)
      console.log(
        `${label}: ${Math.min(offset + 2000, statements.length)}/${statements.length} ${dryRun ? 'prepared' : 'imported'}`,
      );
  }
}
export function sourceSQL(
  key: string,
  s: { url: string; commit: string; sha256: string; license: string },
  count: number,
) {
  return `INSERT INTO data_source_versions (id,url,source_commit,sha256,license,record_count,imported_at) VALUES (${[key, s.url, s.commit, s.sha256, s.license, count, new Date().toISOString()].map(sql).join(',')}) ON CONFLICT(id) DO UPDATE SET url=excluded.url,source_commit=excluded.source_commit,sha256=excluded.sha256,license=excluded.license,record_count=excluded.record_count,imported_at=excluded.imported_at;`;
}
