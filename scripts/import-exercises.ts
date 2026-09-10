import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { source, executeSQL, sql, sourceSQL, dryRun } from './data-utils';
const s = await source('fitness', 'data/exercises.json');
const schema = z.array(
  z.object({
    id: z.string().regex(/^\d{4}$/),
    name: z.string().min(1),
    body_part: z.string(),
    target: z.string(),
    secondary_muscles: z.array(z.string()),
    equipment: z.string(),
    instruction_steps: z.object({ en: z.array(z.string()).min(1), zh: z.array(z.string()).min(1) }),
  }),
);
const rows = schema.parse(JSON.parse(s.content));
const names = JSON.parse(await readFile('data/exercise-names.zh-CN.json', 'utf8')) as Record<
  string,
  string
>;
const missing = rows.filter((e) => !names[e.id]);
if (missing.length) throw new Error(`Missing Chinese names: ${missing.map((e) => e.id).join(',')}`);
if (new Set(rows.map((e) => e.id)).size !== rows.length) throw new Error('Duplicate exercise IDs');
let previous: string[] = [];
try {
  previous = JSON.parse(await readFile('data/generated/fitness-ids.json', 'utf8'));
} catch {}
console.log(
  JSON.stringify({
    records: rows.length,
    added: rows.filter((e) => !previous.includes(e.id)).length,
    removed: previous.filter((id) => !rows.some((e) => e.id === id)).length,
    chineseNames: rows.length,
    chineseInstructions: rows.length,
    mediaImported: 0,
    commit: s.commit,
  }),
);
const queries = rows.map(
  (e) =>
    `INSERT INTO exercise_library(id,name_en,name_zh,body_part,target,secondary_muscles,equipment,instructions_en,instructions_zh,source_commit,active) VALUES(${[e.id, e.name, names[e.id], e.body_part, e.target, JSON.stringify(e.secondary_muscles), e.equipment, JSON.stringify(e.instruction_steps.en), JSON.stringify(e.instruction_steps.zh), s.commit, 1].map(sql).join(',')}) ON CONFLICT(id) DO UPDATE SET name_en=excluded.name_en,name_zh=excluded.name_zh,body_part=excluded.body_part,target=excluded.target,secondary_muscles=excluded.secondary_muscles,equipment=excluded.equipment,instructions_en=excluded.instructions_en,instructions_zh=excluded.instructions_zh,source_commit=excluded.source_commit,active=1;`,
);
await executeSQL(
  [
    ...queries,
    `UPDATE exercise_library SET active=0 WHERE source_commit<>${sql(s.commit)};`,
    sourceSQL('fitness', s, rows.length),
  ],
  'fitness',
);
if (!dryRun)
  await writeFile('data/generated/fitness-ids.json', JSON.stringify(rows.map((e) => e.id)));
