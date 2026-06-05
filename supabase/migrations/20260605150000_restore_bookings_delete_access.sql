GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deleted_booking_archives TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deleted_booking_archives TO service_role;

GRANT EXECUTE ON FUNCTION public.archive_booking_deletion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_booking_deletion(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.restore_deleted_booking_archive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_deleted_booking_archive(uuid) TO service_role;
