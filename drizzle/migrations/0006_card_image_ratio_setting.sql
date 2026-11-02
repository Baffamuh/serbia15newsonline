ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS card_image_ratio text NOT NULL DEFAULT '4:3';
ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_card_image_ratio_check;
ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_card_image_ratio_check CHECK (card_image_ratio IN ('4:3','16:9','3:2','1:1'));
COMMENT ON COLUMN public.site_settings.card_image_ratio IS 'Aspect ratio used for news card thumbnails site-wide; chosen by admins in Dashboard settings';