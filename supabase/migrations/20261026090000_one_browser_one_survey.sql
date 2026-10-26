alter table public.hub_survey_responses
  add column if not exists browser_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hub_survey_responses_browser_hash_check'
      and conrelid = 'public.hub_survey_responses'::regclass
  ) then
    alter table public.hub_survey_responses
      add constraint hub_survey_responses_browser_hash_check
      check (browser_hash is null or browser_hash ~ '^[0-9a-f]{64}$');
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'hub_survey_responses_survey_version_check'
      and conrelid = 'public.hub_survey_responses'::regclass
  ) then
    alter table public.hub_survey_responses
      drop constraint hub_survey_responses_survey_version_check;
  end if;
end
$$;

alter table public.hub_survey_responses
  add constraint hub_survey_responses_survey_version_check
  check (survey_version = any (array['2026-10-v1'::text, '2026-10-v2-binary'::text, '2026-10-v3-one-browser'::text]));

alter table public.hub_survey_responses
  drop constraint if exists hub_survey_responses_binary_choice_check;

alter table public.hub_survey_responses
  add constraint hub_survey_responses_binary_choice_check
  check (
    survey_version not in ('2026-10-v2-binary', '2026-10-v3-one-browser')
    or (satisfaction in (1, 5) and learning in (1, 5))
  );

create unique index if not exists hub_survey_responses_one_browser_per_scope_uidx
  on public.hub_survey_responses (scope, browser_hash)
  where browser_hash is not null;

comment on column public.hub_survey_responses.browser_hash is
  'SHA-256 of the browser-local identifier. Raw browser identifiers are not stored.';

revoke all on table public.hub_survey_responses from anon, authenticated;
