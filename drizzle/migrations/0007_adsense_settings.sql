ALTER TABLE public.site_settings
  ADD COLUMN adsense_client_id text,
  ADD COLUMN adsense_slot_top text,
  ADD COLUMN adsense_slot_article text,
  ADD COLUMN adsense_slot_sidebar text;

COMMENT ON COLUMN public.site_settings.adsense_client_id IS 'Google AdSense publisher ID, e.g. ca-pub-1234567890123456. Empty means ad slots render as labelled placeholders.';
COMMENT ON COLUMN public.site_settings.adsense_slot_top IS 'Optional AdSense slot ID for the top leaderboard unit.';
COMMENT ON COLUMN public.site_settings.adsense_slot_article IS 'Optional AdSense slot ID for the in-article unit.';
COMMENT ON COLUMN public.site_settings.adsense_slot_sidebar IS 'Optional AdSense slot ID for the sidebar unit.';