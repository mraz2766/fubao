import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/server/services/password';
import { executeSQL, sql } from './data-utils';
import { defaultPreferences, defaultWidgets } from '../src/types/domain';
const username = process.env.FUBAO_USERNAME ?? 'fubao',
  password = process.env.FUBAO_PASSWORD ?? 'fubao';
const id = randomUUID();
const hash = await hashPassword(password);
await executeSQL(
  [
    `INSERT INTO users(id,username,password_hash,created_at) SELECT ${[id, username, hash, new Date().toISOString()].map(sql).join(',')} WHERE NOT EXISTS(SELECT 1 FROM users);`,
    `INSERT OR IGNORE INTO user_settings(user_id,preferences) SELECT id,${sql(JSON.stringify(defaultPreferences))} FROM users;`,
    ...defaultWidgets.map(
      (w) =>
        `INSERT OR IGNORE INTO dashboard_widgets(user_id,key,visible,size,position) SELECT id,${[w.key, +w.visible, w.size, w.order].map(sql).join(',')} FROM users;`,
    ),
  ],
  'initialize-user',
);
console.log('Owner initialized if no owner existed. Existing credentials were not changed.');
