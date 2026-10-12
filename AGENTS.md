<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Public news reads go through server functions in `src/lib/news.functions.ts` using a publishable-key client — keeps SSR/SEO working and RLS limits anon to published, due rows.
- Scheduling is enforced by RLS (`status='published' AND publish_at <= now()`), not cron — no background job needed.
- Staff permissions live in `user_roles` (admin/editor/reporter); a DB trigger downgrades reporter publishes to review — server-side authorization, not UI-only.
- Media bucket is private; uploads get long-lived signed URLs — workspace blocks public buckets.
- Facebook import resolves share links, then uses Graph oEmbed (optional META_ACCESS_TOKEN or META_APP_ID+META_APP_SECRET, server-only) plus public Open Graph; results are imported / embed_only / failed and never fabricated — direct page scraping is login-walled.
