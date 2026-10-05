-- update_agent_cron_schedule körs med ägarrättigheter och kunde anropas av
-- alla, även utloggade. Den anropas bara från edge-funktionen
-- update-cron-schedule med service_role, som nu också kräver admin.
revoke execute on function public.update_agent_cron_schedule(text) from public, anon, authenticated;

-- Filer i bucketen announcements ligger i mappen <profile_id>/. Tidigare
-- kunde alla inloggade ladda upp och radera vilken fil som helst.
drop policy if exists "Authenticated users can upload announcements" on storage.objects;
create policy "Authenticated users can upload announcements" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'announcements'
    and (
      exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.id::text = (storage.foldername(name))[1])
      or public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

drop policy if exists "Users can delete own announcement files" on storage.objects;
create policy "Users can delete own announcement files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'announcements'
    and (
      exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.id::text = (storage.foldername(name))[1])
      or public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
