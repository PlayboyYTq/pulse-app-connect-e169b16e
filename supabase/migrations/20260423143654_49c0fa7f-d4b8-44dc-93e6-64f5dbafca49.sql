-- Allow admins (not just owners) to update member roles, but only:
--   - they cannot change owner's role
--   - they cannot promote anyone to owner (only owner -> transfer flow does that, which uses owner's RLS)
DROP POLICY IF EXISTS "Owner can update member roles" ON public.group_members;

CREATE POLICY "Admins and owners can update member roles"
ON public.group_members
FOR UPDATE
USING (
  public.is_group_admin_or_owner(group_id, auth.uid())
  AND role <> 'owner'
)
WITH CHECK (
  public.is_group_admin_or_owner(group_id, auth.uid())
  AND role IN ('admin','member')
);

-- Owner-only escalation: allow owner to promote someone to owner (transfer ownership)
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
WITH CHECK (true);