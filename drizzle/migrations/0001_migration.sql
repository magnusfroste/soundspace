DROP POLICY IF EXISTS "Anyone can view announcements" ON storage.objects;
CREATE POLICY "Owners and admins can list announcement files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'announcements' AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.id::text = (storage.foldername(objects.name))[1])
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ));