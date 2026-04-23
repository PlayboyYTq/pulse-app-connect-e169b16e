DROP POLICY IF EXISTS "Owner can transfer ownership" ON public.group_members;

CREATE POLICY "Owner can transfer ownership"
ON public.group_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.group_members m
    WHERE m.group_id = group_members.group_id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  )
)
WITH CHECK (
  role IN ('owner','admin','member')
);