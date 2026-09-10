export type Locale = 'zh-CN' | 'en-US';
export type Visibility = 'private' | 'public';
export type WorkoutStatus = 'draft' | 'active' | 'completed';
export interface User {
  id: string;
  username: string;
}
export interface Preferences {
  language: Locale;
  theme: 'light' | 'dark' | 'system';
  weightUnit: 'kg' | 'lb';
  distanceUnit: 'km' | 'mile';
  weekStart: 0 | 1;
  weeklyGoal: number;
  timezone: string;
  mapStyle: 'countries' | 'places';
}
export interface Widget {
  key: 'fitness' | 'travel' | 'weekly' | 'recent';
  visible: boolean;
  size: 'small' | 'medium' | 'large';
  order: number;
}
export const defaultPreferences: Preferences = {
  language: 'zh-CN',
  theme: 'system',
  weightUnit: 'kg',
  distanceUnit: 'km',
  weekStart: 1,
  weeklyGoal: 3,
  timezone: 'Asia/Shanghai',
  mapStyle: 'countries',
};
export const defaultWidgets: Widget[] = [
  { key: 'fitness', visible: true, size: 'medium', order: 0 },
  { key: 'travel', visible: true, size: 'medium', order: 1 },
  { key: 'weekly', visible: true, size: 'medium', order: 2 },
  { key: 'recent', visible: true, size: 'medium', order: 3 },
];
export interface Exercise {
  id: string;
  name_en: string;
  name_zh: string;
  body_part: string;
  target: string;
  secondary_muscles: string[];
  equipment: string;
  instructions_en: string[];
  instructions_zh: string[];
  image: string | null;
  animation: string | null;
  favorite?: boolean;
  usage_count?: number;
}
export interface FitnessSet {
  id: string;
  reps: number | null;
  weight: number | null;
  duration: number | null;
  distance: number | null;
  rpe: number | null;
  note: string;
  completed: boolean;
}
export interface SessionExercise {
  id: string;
  exercise_id: string;
  name_en: string;
  name_zh: string;
  target: string;
  sets: FitnessSet[];
}
export interface Workout {
  id: string;
  user_id: string;
  title: string;
  mode: 'quick' | 'detailed';
  status: WorkoutStatus;
  body_parts: string[];
  start_at: string;
  end_at: string | null;
  timezone: string;
  note: string;
  visibility: Visibility;
  exercises: SessionExercise[];
  updated_at: string;
}
export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: SessionExercise[];
}
export interface Location {
  spot_id?: string | null;
  id: string;
  kind: 'country' | 'region' | 'city';
  country_code: string;
  country_name: string;
  country_name_zh: string;
  region: string;
  city: string;
  name: string;
  name_zh: string;
  latitude: number | null;
  longitude: number | null;
}
export interface TravelPhoto {
  id: string;
  large_key: string;
  thumbnail_key: string;
  width: number;
  height: number;
  size: number;
  position: number;
}
export interface Trip {
  place_name?: string;
  spot_id?: string | null;
  id: string;
  user_id: string;
  location_id: string;
  location: Location;
  start_date: string | null;
  end_date: string | null;
  description: string;
  tags: string[];
  rating: number | null;
  visibility: Visibility;
  photos: TravelPhoto[];
  updated_at: string;
}
export interface Wish {
  spot_id?: string | null;
  id: string;
  location_id: string;
  location: Location;
  visibility: Visibility;
}
export interface ApiError {
  error: { code: string; fields?: Record<string, string[]> };
}
