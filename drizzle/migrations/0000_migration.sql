create type public.app_role as enum ('admin','editor','reporter');
create type public.content_format as enum ('article','video','interview','documentary');
create type public.content_status as enum ('draft','review','published');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id)
$$;
create or replace function public.is_editor(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role in ('admin','editor'))
$$;

create policy "own profile or admin read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "read own roles or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin add roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
create policy "admin remove roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'admin') and user_id <> auth.uid());

-- profile on signup; very first account becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.email,''));
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles (user_id, role) values (new.id,'admin');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select to anon, authenticated using (true);
create policy "admin manage categories ins" on public.categories for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin manage categories upd" on public.categories for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin manage categories del" on public.categories for delete to authenticated using (public.has_role(auth.uid(),'admin'));

insert into public.categories (slug,name,sort) values
 ('nigeria','Nigeria',1),('international','International',2),('politics','Politics',3),
 ('business','Business',4),('education','Education',5),('security','Security',6),
 ('entertainment','Entertainment',7),('sports','Sports',8);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 250),
  slug text not null unique,
  summary text not null default '',
  body text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  format public.content_format not null default 'article',
  status public.content_status not null default 'draft',
  publish_at timestamptz not null default now(),
  cover_image_url text,
  video_url text,
  facebook_url text,
  source_url text,
  is_featured boolean not null default false,
  is_breaking boolean not null default false,
  is_trending boolean not null default false,
  author_id uuid,
  author_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index articles_pub_idx on public.articles (status, publish_at desc);
grant select on public.articles to anon;
grant select, insert, update, delete on public.articles to authenticated;
grant all on public.articles to service_role;
alter table public.articles enable row level security;
create policy "public read published" on public.articles for select to anon, authenticated
  using (status='published' and publish_at <= now());
create policy "staff read all" on public.articles for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff insert" on public.articles for insert to authenticated
  with check (public.is_staff(auth.uid()) and author_id = auth.uid());
create policy "editors update any, reporters own" on public.articles for update to authenticated
  using (public.is_editor(auth.uid()) or (public.is_staff(auth.uid()) and author_id = auth.uid()));
create policy "editors delete" on public.articles for delete to authenticated
  using (public.is_editor(auth.uid()) or (public.is_staff(auth.uid()) and author_id = auth.uid() and status <> 'published'));

-- reporters cannot publish or set homepage flags
create or replace function public.articles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_editor(auth.uid()) then
    if new.status = 'published' then new.status := 'review'; end if;
    new.is_featured := false; new.is_breaking := false; new.is_trending := false;
  end if;
  return new;
end; $$;
create trigger articles_guard_trg before insert or update on public.articles
  for each row execute function public.articles_guard();

create table public.site_settings (
  id int primary key default 1 check (id = 1),
  live_stream_url text,
  live_title text not null default 'Serbia 15 Live',
  facebook_page_url text not null default 'https://www.facebook.com/share/1DndT6AgUx/',
  youtube_url text, x_url text, instagram_url text, tiktok_url text,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1);
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "settings public read" on public.site_settings for select to anon, authenticated using (true);
create policy "admin update settings" on public.site_settings for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_email text not null default '',
  action text not null,
  entity text not null,
  entity_id text,
  details text,
  created_at timestamptz not null default now()
);
grant select, insert on public.activity_log to authenticated;
grant all on public.activity_log to service_role;
alter table public.activity_log enable row level security;
create policy "staff insert log" on public.activity_log for insert to authenticated
  with check (public.is_staff(auth.uid()) and user_id = auth.uid());
create policy "admin read log" on public.activity_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "staff upload media" on storage.objects for insert to authenticated
  with check (bucket_id='media' and public.is_staff(auth.uid()));
create policy "staff update media" on storage.objects for update to authenticated
  using (bucket_id='media' and public.is_staff(auth.uid()));
create policy "editors delete media" on storage.objects for delete to authenticated
  using (bucket_id='media' and public.is_editor(auth.uid()));