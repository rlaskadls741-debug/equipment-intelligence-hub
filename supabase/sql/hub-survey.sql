create table public.hub_survey_responses (
  submission_id uuid primary key,
  survey_version text not null check (survey_version = '2026-10-v1'),
  scope text not null default 'production' check (scope = 'production' or scope ~ '^qa-[0-9a-f-]{36}$'),
  satisfaction smallint not null check (satisfaction between 1 and 5),
  learning smallint not null check (learning between 1 and 5),
  helpful text not null default '' check (char_length(helpful) <= 2000),
  improvements text not null default '' check (char_length(improvements) <= 2000),
  comments text not null default '' check (char_length(comments) <= 2000),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index hub_survey_responses_scope_created on public.hub_survey_responses(scope, created_at desc);
alter table public.hub_survey_responses enable row level security;
revoke all on public.hub_survey_responses from public, anon, authenticated;
grant select, insert on public.hub_survey_responses to service_role;
create policy survey_service_only on public.hub_survey_responses to service_role using (true) with check (true);
comment on table public.hub_survey_responses is 'Hub feedback. Public clients have no direct read or write access. Submission only via hub-survey Edge Function.';
