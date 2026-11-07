CREATE OR REPLACE FUNCTION public.gen_short_code() RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (floor(random()*31)+1)::int, 1), '') FROM generate_series(1,5);
$$;

ALTER TABLE public.articles ADD COLUMN short_code text DEFAULT public.gen_short_code();
UPDATE public.articles SET short_code = public.gen_short_code() WHERE short_code IS NULL;
CREATE UNIQUE INDEX articles_short_code_key ON public.articles(short_code);

CREATE TABLE public.site_visits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id text NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_visits TO authenticated;
GRANT ALL ON public.site_visits TO service_role;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read visits" ON public.site_visits FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX site_visits_created_idx ON public.site_visits(created_at);

CREATE OR REPLACE FUNCTION public.record_visit(_visitor text, _path text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.site_visits(visitor_id, path)
  SELECT left(_visitor, 64), left(_path, 300)
  WHERE length(coalesce(_visitor,'')) BETWEEN 8 AND 64 AND _path LIKE '/%';
$$;
REVOKE ALL ON FUNCTION public.record_visit(text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_visit(text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.visit_stats() RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN json_build_object(
    'today_visitors', (SELECT count(DISTINCT visitor_id) FROM site_visits WHERE created_at >= date_trunc('day', now())),
    'today_views', (SELECT count(*) FROM site_visits WHERE created_at >= date_trunc('day', now())),
    'week_visitors', (SELECT count(DISTINCT visitor_id) FROM site_visits WHERE created_at >= now() - interval '7 days'),
    'month_visitors', (SELECT count(DISTINCT visitor_id) FROM site_visits WHERE created_at >= now() - interval '30 days'),
    'total_visitors', (SELECT count(DISTINCT visitor_id) FROM site_visits),
    'total_views', (SELECT count(*) FROM site_visits),
    'top_pages', (SELECT coalesce(json_agg(t),'[]'::json) FROM (SELECT path, count(*) AS views FROM site_visits WHERE created_at >= now() - interval '30 days' GROUP BY path ORDER BY views DESC LIMIT 10) t)
  );
END $$;
REVOKE ALL ON FUNCTION public.visit_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.visit_stats() TO authenticated;