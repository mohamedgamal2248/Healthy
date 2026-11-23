-- Hourly reminder scheduler (Supabase pg_cron + pg_net). Run once per project in the SQL editor.
-- Replace <SCHEDULER_SECRET> with the same value as the SCHEDULER_SECRET environment variable on Vercel.
-- The endpoint sends each person ONE reminder at their own chosen local hour (see hl_claim_reminders in 0010_growth.sql).
select cron.schedule(
  'hl-reminders-hourly',
  '0 * * * *',
  $job$select net.http_get(
    url := 'https://<your-domain>/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer <SCHEDULER_SECRET>'),
    timeout_milliseconds := 60000
  )$job$
);
