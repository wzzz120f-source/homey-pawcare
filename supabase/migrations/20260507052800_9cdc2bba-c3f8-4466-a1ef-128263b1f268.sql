ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sitter';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'groomer';

ALTER TABLE public.driver_applications
  ADD COLUMN IF NOT EXISTS role_requested text NOT NULL DEFAULT 'sitter';