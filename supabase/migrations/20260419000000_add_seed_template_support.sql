-- Migration: add seed-template support to sessions
-- seed_template_id: which seed template this session was started from (null for blank / pattern starts)
-- fps, duration_in_frames: persisted from the template so the player renders correctly on first load
alter table sessions add column if not exists seed_template_id text;
alter table sessions add column if not exists fps int;
alter table sessions add column if not exists duration_in_frames int;
