import { describe, it, expect } from 'vitest';
import {
  categoryTargets,
  equipmentGroup,
  exerciseCategories,
  equipmentGroups,
} from '../src/lib/exercise-categories';
import { trainingPart, trainingTargets } from '../src/lib/fitness-recording';
describe('exercise categories', () => {
  it('assigns every known primary target to exactly one category', () => {
    const targets = [
      ...new Set(Object.values(trainingTargets).flat()),
      'unrecognized muscle',
      'Rotator Cuff',
    ];
    for (const target of targets) {
      const matches = exerciseCategories.filter((category) =>
        categoryTargets(targets, category).includes(target),
      );
      expect(matches).toEqual([trainingPart(target)]);
    }
  });
  it('does not mix chest exercises into arms because of secondary muscles', () => {
    const chest = { target: 'pectorals', secondary_muscles: ['triceps', 'delts'] };
    expect(categoryTargets([chest.target], 'arms')).toEqual([]);
    expect(categoryTargets([chest.target], 'chest')).toEqual(['pectorals']);
  });
  it('groups fine-grained leg and back muscle names', () => {
    expect(categoryTargets(['glutes', 'quads', 'calves', 'hamstrings', 'lats'], 'legs')).toEqual([
      'glutes',
      'quads',
      'calves',
      'hamstrings',
    ]);
    expect(categoryTargets(['lats', 'traps', 'spine', 'pectorals'], 'back')).toEqual([
      'lats',
      'traps',
      'spine',
    ]);
  });
  it.each([
    ['body weight', 'bodyweight'],
    ['dumbbell', 'dumbbell'],
    ['ez barbell', 'barbell'],
    ['olympic barbell', 'barbell'],
    ['trap bar', 'barbell'],
    ['cable', 'cable'],
    ['smith machine', 'machine'],
    ['stationary bike', 'machine'],
    ['leverage machine', 'machine'],
    ['band', 'other'],
    ['kettlebell', 'other'],
  ])('classifies equipment %s as %s', (input, expected) =>
    expect(equipmentGroup(input)).toBe(expected),
  );
  it('deduplicates taxonomy rows and uses six equipment choices', () => {
    expect(categoryTargets(['lats', 'lats'], 'back')).toEqual(['lats']);
    expect(equipmentGroups).toHaveLength(6);
  });
});
