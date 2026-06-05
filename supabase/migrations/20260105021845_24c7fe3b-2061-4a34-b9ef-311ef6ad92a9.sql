-- Fix search_path security warnings for the new functions
ALTER FUNCTION public.auto_checkout_from_chat() SET search_path = public;
ALTER FUNCTION public.run_booking_status_updates() SET search_path = public;