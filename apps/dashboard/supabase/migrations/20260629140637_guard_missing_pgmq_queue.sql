CREATE OR REPLACE FUNCTION public.process_function_queue(queue_name text, batch_size integer DEFAULT 950)
RETURNS void
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  calls_needed int;
  headers jsonb;
  queue_size bigint;
  request_timeout_ms int;
  url text;
BEGIN
  IF queue_name IS NULL OR queue_name = '' THEN
    RETURN;
  END IF;

  IF pg_catalog.to_regclass(pg_catalog.format('pgmq.%I', 'q_' || queue_name)) IS NULL THEN
    RAISE WARNING 'process_function_queue skipped missing pgmq queue "%"', queue_name;
    RETURN;
  END IF;

  EXECUTE pg_catalog.format('SELECT count(*) FROM pgmq.%I', 'q_' || queue_name) INTO queue_size;

  IF queue_size > 0 THEN
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'apisecret', public.get_apikey()
    );
    request_timeout_ms := CASE
      WHEN queue_name = 'on_manifest_create' THEN 60000
      ELSE 8000
    END;
    url := public.get_db_url() || '/functions/v1/triggers/queue_consumer/sync';
    calls_needed := pg_catalog.least(pg_catalog.ceil(queue_size / batch_size::double precision)::int, 10);

    FOR i IN 1..calls_needed LOOP
      PERFORM net.http_post(
        url := url,
        headers := headers,
        body := pg_catalog.jsonb_build_object('queue_name', queue_name, 'batch_size', batch_size),
        timeout_milliseconds := request_timeout_ms
      );
    END LOOP;
  END IF;
END;
$function$;

ALTER FUNCTION public.process_function_queue(text, integer) OWNER TO postgres;
