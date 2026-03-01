ALTER TABLE public.posts ADD COLUMN tags TEXT[] DEFAULT '{}';
CREATE INDEX idx_posts_tags ON public.posts USING GIN(tags);