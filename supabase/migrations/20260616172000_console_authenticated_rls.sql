DROP POLICY IF EXISTS org_users_read_own_membership ON public.org_users;
CREATE POLICY org_users_read_own_membership
  ON public.org_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS orgs_read_member_orgs ON public.orgs;
CREATE POLICY orgs_read_member_orgs
  ON public.orgs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_users
      WHERE org_users.org_id = orgs.id
        AND org_users.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS apps_read_member_org_apps ON public.apps;
CREATE POLICY apps_read_member_org_apps
  ON public.apps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_users
      WHERE org_users.org_id = apps.owner_org
        AND org_users.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS releases_read_member_org_releases ON public.releases;
CREATE POLICY releases_read_member_org_releases
  ON public.releases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_users
      WHERE org_users.org_id = releases.owner_org
        AND org_users.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS channels_read_member_org_channels ON public.channels;
CREATE POLICY channels_read_member_org_channels
  ON public.channels
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.apps
      JOIN public.org_users ON org_users.org_id = apps.owner_org
      WHERE apps.app_id = channels.app_id
        AND org_users.user_id = auth.uid()::text
    )
  );

GRANT SELECT ON TABLE public.org_users TO authenticated;
GRANT SELECT ON TABLE public.orgs TO authenticated;
GRANT SELECT ON TABLE public.apps TO authenticated;
GRANT SELECT ON TABLE public.releases TO authenticated;
GRANT SELECT ON TABLE public.channels TO authenticated;
