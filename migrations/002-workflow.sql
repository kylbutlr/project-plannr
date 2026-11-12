ALTER TABLE project_plannr.workspace ADD COLUMN IF NOT EXISTS workflow jsonb;
INSERT INTO project_plannr.migrations(version) VALUES (2) ON CONFLICT DO NOTHING;
