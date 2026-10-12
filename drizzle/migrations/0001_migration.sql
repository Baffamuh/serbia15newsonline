create policy "staff read media" on storage.objects for select to authenticated
  using (bucket_id='media' and public.is_staff(auth.uid()));