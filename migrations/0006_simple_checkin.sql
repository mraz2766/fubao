ALTER TABLE fitness_sessions ADD COLUMN workout_date TEXT;
ALTER TABLE fitness_sessions ADD COLUMN time_precision TEXT NOT NULL DEFAULT 'exact' CHECK(time_precision IN ('date','exact'));
ALTER TABLE fitness_sessions ADD COLUMN duration_seconds INTEGER CHECK(duration_seconds IS NULL OR duration_seconds BETWEEN 0 AND 604800);
