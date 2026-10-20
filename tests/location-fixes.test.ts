import { expect, it } from 'vitest';
import { locationFixSQL, scenicRelinkSQL } from '../scripts/location-fixes';

it('assigns Chinese city names by province, never by romanization alone', () => {
  const sql = locationFixSQL().join('\n');
  expect(sql).toMatch(
    /SET name_zh='苏州',popularity=3 WHERE country_code='CN' AND kind='city' AND region='Jiangsu'/,
  );
  expect(sql).toMatch(
    /SET name_zh='宿州',popularity=3 WHERE country_code='CN' AND kind='city' AND region='Anhui'/,
  );
  // Wrong names left on homonyms are cleared before curated names are applied.
  expect(sql.indexOf('DELETE FROM location_aliases WHERE alias IN')).toBeLessThan(
    sql.indexOf("'苏州',popularity=3"),
  );
});

it('relinks catalog spots within their own province', () => {
  expect(scenicRelinkSQL().join('\n')).toContain("name='Dali' AND region LIKE 'Yunnan%'");
});
