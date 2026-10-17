DROP POLICY IF EXISTS "settings public read" ON public.site_settings;
CREATE POLICY "staff read settings" ON public.site_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
REVOKE SELECT ON public.site_settings FROM anon;
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS SETOF public.site_settings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ select * from public.site_settings where id = 1 $$;
REVOKE ALL ON FUNCTION public.get_public_settings() FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;