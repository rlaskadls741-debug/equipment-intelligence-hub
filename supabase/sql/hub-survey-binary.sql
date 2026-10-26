alter table public.hub_survey_responses drop constraint hub_survey_responses_survey_version_check;
alter table public.hub_survey_responses add constraint hub_survey_responses_survey_version_check
  check (survey_version in ('2026-10-v1', '2026-10-v2-binary'));
alter table public.hub_survey_responses add constraint hub_survey_responses_binary_choice_check
  check (survey_version <> '2026-10-v2-binary' or (satisfaction in (1,5) and learning in (1,5)));
comment on column public.hub_survey_responses.satisfaction is 'v1: 1-5 scale. v2-binary: 5=satisfied, 1=dissatisfied. Aggregate each survey_version separately.';
comment on column public.hub_survey_responses.learning is 'v1: 1-5 scale. v2-binary: 5=satisfied, 1=dissatisfied. Aggregate each survey_version separately.';
