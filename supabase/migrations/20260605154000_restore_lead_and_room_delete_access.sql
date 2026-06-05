GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leads TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deleted_lead_archives TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deleted_lead_archives TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deleted_room_archives TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deleted_room_archives TO service_role;

GRANT EXECUTE ON FUNCTION public.archive_lead_deletion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_lead_deletion(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.restore_deleted_lead_archive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_deleted_lead_archive(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.archive_room_deletion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_room_deletion(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.restore_deleted_room_archive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_deleted_room_archive(uuid) TO service_role;
