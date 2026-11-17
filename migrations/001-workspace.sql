CREATE SCHEMA IF NOT EXISTS project_plannr;
CREATE TABLE IF NOT EXISTS project_plannr.migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project_plannr.workspace (
  id integer PRIMARY KEY CHECK (id = 1),
  counter bigint NOT NULL DEFAULT 0 CHECK (counter >= 0)
);
INSERT INTO project_plannr.workspace(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS project_plannr.entities (
  kind text NOT NULL CHECK (kind IN ('project','ticket','agent','session','attempt','replay')),
  id text NOT NULL,
  project_id text,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  PRIMARY KEY (kind,id)
);
CREATE INDEX IF NOT EXISTS entities_project ON project_plannr.entities(project_id,kind);
CREATE TABLE IF NOT EXISTS project_plannr.audit (
  id uuid PRIMARY KEY,
  happened_at timestamptz NOT NULL,
  project_id text,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object')
);
CREATE INDEX IF NOT EXISTS audit_recent ON project_plannr.audit(happened_at DESC);
INSERT INTO project_plannr.migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
