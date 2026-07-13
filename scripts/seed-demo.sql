-- Ultraprompt demo data — marketing / screenshot seed.
--
-- SAFE: this only INSERTs data; it never creates or alters the schema, and it is meant
-- to be run against a DEMO build's database, NOT your real one. Your personal DB lives at
--   ~/Library/Application Support/at.ultraprompt/ultraprompt.db
-- To keep it untouched, build a demo variant with a different bundle identifier (see
-- RELEASE.md → "Demo data for screenshots"); that variant gets its own app-data dir and
-- its own fresh DB (with migrations already applied), and you run this against THAT file.
--
-- Usage (against the demo build's DB, after launching it once so the schema exists):
--   sqlite3 "<demo app-data dir>/ultraprompt.db" < scripts/seed-demo.sql

BEGIN;
DELETE FROM checklist_items;
DELETE FROM tasks;
DELETE FROM projects;

INSERT INTO projects (id,name,working_dir,target_subpath,position,is_favorite) VALUES
  (1,'Aurora Web','/work/aurora-web','',0,1),
  (2,'Payments API','/work/payments','',1,0),
  (3,'Mobile','/work/mobile','',2,0);

-- Board tasks (lanes: 1 Backlog, 2 Specify, 3 Plan, 4 Ready).
INSERT INTO tasks (project_id,lane_id,body,position,is_favorite) VALUES
  (1,1,'Redesign the marketing homepage hero',0,1),
  (1,1,'Add a dark-mode toggle to the top bar',1,0),
  (1,1,'Audit Lighthouse performance on /pricing',2,0),
  (1,2,'Spec: unified search across docs + blog',0,1),
  (1,2,'Spec: team invitations & seat management',1,0),
  (1,3,'Break the billing migration into steps',0,0),
  (1,3,'Plan the SSO (SAML) rollout',1,0),
  (1,4,'Wire up the /pricing A/B experiment',0,1),
  (1,4,'Add rate-limit headers to the public API',1,0);

INSERT INTO checklist_items (task_id,text,is_checked,position) VALUES
  ((SELECT id FROM tasks WHERE lane_id=1 AND project_id=1 ORDER BY position LIMIT 1),'Gather reference designs',1,0),
  ((SELECT id FROM tasks WHERE lane_id=1 AND project_id=1 ORDER BY position LIMIT 1),'Draft three hero directions',1,1),
  ((SELECT id FROM tasks WHERE lane_id=1 AND project_id=1 ORDER BY position LIMIT 1),'Pick a headline that fits the brand voice',0,2),
  ((SELECT id FROM tasks WHERE lane_id=1 AND project_id=1 ORDER BY position LIMIT 1),'Ship behind a feature flag',0,3);

-- Pipeline feed: sent tasks across projects with a Queued/Completed mix (last 24h).
INSERT INTO tasks (project_id,lane_id,body,position,is_locked,sent_at,sent_path,archived_at,completed_at) VALUES
  (1,NULL,'Redesign the marketing homepage hero',0,1,datetime('now'),'sent-0.md',datetime('now'),datetime('now')),
  (2,NULL,'Add rate-limit headers to the public API',0,1,datetime('now'),'sent-1.md',datetime('now'),datetime('now')),
  (1,NULL,'Wire up the /pricing A/B experiment',0,1,datetime('now'),'sent-2.md',datetime('now'),NULL),
  (3,NULL,'Fix pull-to-refresh on the feed screen',0,1,datetime('now'),'sent-3.md',datetime('now'),NULL),
  (1,NULL,'Add a dark-mode toggle to the top bar',0,1,datetime('now'),'sent-4.md',datetime('now'),NULL);
COMMIT;
