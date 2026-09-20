import { trainingPart, type TrainingPart } from './fitness-recording';
export const exerciseCategories: TrainingPart[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'cardio',
  'other',
];
export const equipmentGroups = [
  'bodyweight',
  'dumbbell',
  'barbell',
  'cable',
  'machine',
  'other',
] as const;
export type EquipmentGroup = (typeof equipmentGroups)[number];
export function equipmentGroup(value: string): EquipmentGroup {
  const equipment = value.toLowerCase().trim();
  if (equipment === 'body weight') return 'bodyweight';
  if (equipment === 'dumbbell') return 'dumbbell';
  if (/barbell|trap bar/.test(equipment)) return 'barbell';
  if (equipment === 'cable') return 'cable';
  if (/machine|bike|elliptical|stepmill|ergometer|skierg/.test(equipment)) return 'machine';
  return 'other';
}
export function categoryTargets(targets: string[], category: TrainingPart) {
  return [...new Set(targets.filter((target) => trainingPart(target) === category))];
}
export const equipmentGroupLabels: Record<EquipmentGroup, [string, string]> = {
  bodyweight: ['徒手', 'Bodyweight'],
  dumbbell: ['哑铃', 'Dumbbell'],
  barbell: ['杠铃', 'Barbell'],
  cable: ['绳索', 'Cable'],
  machine: ['固定器械', 'Machines'],
  other: ['其他器械', 'Other equipment'],
};
