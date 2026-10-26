alter table public.hub_survey_responses
  add column if not exists survey_week_start date;

update public.hub_survey_responses
set survey_week_start = (
  (created_at at time zone 'Asia/Seoul')::date
  - extract(dow from (created_at at time zone 'Asia/Seoul')::date)::integer
)
where survey_week_start is null;

alter table public.hub_survey_responses
  alter column survey_week_start set not null;

drop index if exists public.hub_survey_responses_one_browser_per_scope_uidx;

create unique index if not exists hub_survey_responses_one_browser_per_week_uidx
  on public.hub_survey_responses (scope, survey_week_start, browser_hash)
  where browser_hash is not null;

alter table public.hub_survey_responses
  drop constraint if exists hub_survey_responses_survey_version_check;

alter table public.hub_survey_responses
  add constraint hub_survey_responses_survey_version_check
  check (survey_version = any (array[
    '2026-10-v1'::text,
    '2026-10-v2-binary'::text,
    '2026-10-v3-one-browser'::text,
    '2026-10-v4-weekly'::text
  ]));

alter table public.hub_survey_responses
  drop constraint if exists hub_survey_responses_binary_choice_check;

alter table public.hub_survey_responses
  add constraint hub_survey_responses_binary_choice_check
  check (
    survey_version not in ('2026-10-v2-binary', '2026-10-v3-one-browser', '2026-10-v4-weekly')
    or (satisfaction in (1, 5) and learning in (1, 5))
  );

comment on column public.hub_survey_responses.survey_week_start is
  'Sunday starting the report week covered by this feedback, interpreted in Asia/Seoul.';

revoke all on table public.hub_survey_responses from anon, authenticated;
