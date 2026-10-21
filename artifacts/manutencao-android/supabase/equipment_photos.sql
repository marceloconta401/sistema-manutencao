-- Add the optional storage path for equipment photos.
-- Existing equipment, relationships, and RLS policies remain unchanged.
begin;

alter table public.equipment
  add column if not exists photo_path text;

comment on column public.equipment.photo_path is
  'Path of the optional equipment photo in the private maintenance-photos storage bucket.';

commit;
