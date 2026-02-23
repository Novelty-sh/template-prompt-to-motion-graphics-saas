-- Migration: add model column to sessions
alter table sessions add column if not exists model text not null default 'gpt-5.2:low';
