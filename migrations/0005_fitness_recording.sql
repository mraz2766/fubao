ALTER TABLE fitness_sessions ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fitness_sessions ADD COLUMN last_mutation_id TEXT;
ALTER TABLE fitness_session_exercises ADD COLUMN recording_type TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE workout_template_exercises ADD COLUMN recording_type TEXT NOT NULL DEFAULT 'auto';
CREATE TABLE fitness_write_guards (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid=1));
