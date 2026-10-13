ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS live_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_live boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_started_at timestamptz;
ALTER TABLE public.site_settings ALTER COLUMN live_title SET DEFAULT 'Serbia 15 Online News Live';

CREATE OR REPLACE FUNCTION public.set_live_broadcast(_url text, _title text, _description text, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_editor(auth.uid()) then raise exception 'Only editors and admins can control broadcasts'; end if;
  if _active and (_url is null or _url !~* '^https://([a-z0-9-]+\.)?(facebook\.com|fb\.watch|youtube\.com|youtu\.be)/') then
    raise exception 'Enter a valid https Facebook or YouTube live link';
  end if;
  if length(coalesce(_title,'')) < 2 or length(_title) > 120 then raise exception 'Title must be 2–120 characters'; end if;
  if length(coalesce(_description,'')) > 1000 then raise exception 'Description too long'; end if;
  update public.site_settings set
    live_stream_url = nullif(trim(_url),''), live_title = trim(_title), live_description = coalesce(trim(_description),''),
    is_live = _active, live_started_at = case when _active then coalesce(case when is_live then live_started_at end, now()) else null end,
    updated_at = now()
  where id = 1;
  insert into public.activity_log(user_id, user_email, action, entity, entity_id, details)
  values (auth.uid(), coalesce((select email from public.profiles where id = auth.uid()),''), case when _active then 'go_live' else 'end_live' end, 'broadcast', '1', _title);
end; $$;
REVOKE ALL ON FUNCTION public.set_live_broadcast(text,text,text,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_live_broadcast(text,text,text,boolean) TO authenticated;