ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS gallery_images text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.articles
  ADD CONSTRAINT articles_gallery_images_limit
  CHECK (cardinality(gallery_images) <= 12);