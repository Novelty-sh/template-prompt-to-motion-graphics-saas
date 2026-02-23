-- Migration: add aspect_ratio column to sessions
alter table sessions add column if not exists aspect_ratio text not null default '16:9';
