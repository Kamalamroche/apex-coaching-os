-- Video calls: the coach can save their own meeting link (Zoom, Google Meet, Teams…) for booked calls.
-- Without one, the app gives each call its own private Jitsi room, which needs nothing in the database.
-- Safe to run more than once.
alter table public.coach_booking_settings add column if not exists video_link text;
alter table public.coach_booking_settings drop constraint if exists coach_booking_settings_video_link_check;
alter table public.coach_booking_settings add constraint coach_booking_settings_video_link_check
  check (video_link is null or (video_link like 'https://%' and length(video_link) <= 300));
