import type { Workout } from './domain';
/** Lightweight session headers. Exercise graphs are loaded only in the workspace. */
export interface FitnessDay {
  date: string;
  items: Workout[];
  current: Workout | null;
  weekCount: number;
  recent: Workout[];
}
