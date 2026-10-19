-- Anonymous aggregate metrics. Raw events are inaccessible to browser roles.
create schema if not exists hub_metrics_private;
revoke all on schema hub_metrics_private from public, anon, authenticated;

create table if not exists hub_metrics_private.visits (
  scope text not null, week date not null, visitor text not null,
  created_at timestamptz not null default now(),
  primary key (scope, week, visitor)
);
create table if not exists hub_metrics_private.opens (
  scope text not null, event_id text not null, week date not null,
  report text not null, visitor text not null,
  created_at timestamptz not null default now(),
  primary key (scope, event_id)
);
create index if not exists hub_opens_week on hub_metrics_private.opens(scope, week);
create table if not exists hub_metrics_private.request_limits (
  scope text not null, client text not null, minute timestamptz not null,
  requests integer not null,
  primary key (scope, client, minute)
);

create or replace function public.hub_metrics(
 p_scope text, p_type text, p_week date, p_visitor text default null,
 p_event text default null, p_report text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare w date := p_week; today date := (now() at time zone 'Asia/Seoul')::date;
 n integer;
begin
 if p_scope <> 'production' and p_scope !~ '^qa-[a-f0-9-]{36}$' then
  raise exception 'Invalid scope';
 end if;
 if p_type not in ('read','visit','open') then raise exception 'Invalid type'; end if;
 if p_type = 'visit' then w := today - extract(dow from today)::integer; end if;
 if w is null or extract(dow from w) <> 0 or w < date '2026-01-01' or w > today then
  raise exception 'Invalid week';
 end if;
 if p_type <> 'read' then
  if p_visitor is null or p_visitor !~ '^[a-f0-9]{64}$' then raise exception 'Invalid visitor'; end if;
  insert into hub_metrics_private.request_limits(scope,client,minute,requests)
   values(p_scope,p_visitor,date_trunc('minute',now()),1)
   on conflict(scope,client,minute) do update
    set requests=hub_metrics_private.request_limits.requests+1
   returning requests into n;
  if n > 120 then return jsonb_build_object('error','rate_limit'); end if;
 end if;
 if p_type = 'visit' then
  insert into hub_metrics_private.visits(scope,week,visitor)
   values(p_scope,w,p_visitor) on conflict do nothing;
 elsif p_type = 'open' then
  if p_event is null or p_event !~ '^[-a-zA-Z0-9_]{1,150}$'
   or p_report is null or p_report !~ '^[-a-zA-Z0-9_]{1,100}$' then raise exception 'Invalid event'; end if;
  insert into hub_metrics_private.opens(scope,event_id,week,report,visitor)
   values(p_scope,p_event,w,p_report,p_visitor) on conflict do nothing;
 end if;
 return jsonb_build_object('week',w,
  'visitors',(select count(*) from hub_metrics_private.visits where scope=p_scope and week=w),
  'opens',(select count(*) from hub_metrics_private.opens where scope=p_scope and week=w));
end $$;
revoke all on function public.hub_metrics(text,text,date,text,text,text) from public,anon,authenticated;
grant execute on function public.hub_metrics(text,text,date,text,text,text) to service_role;

alter table hub_metrics_private.visits enable row level security;
alter table hub_metrics_private.opens enable row level security;
alter table hub_metrics_private.request_limits enable row level security;
grant usage on schema hub_metrics_private to service_role;
grant select,insert on hub_metrics_private.visits,hub_metrics_private.opens to service_role;
grant select,insert,update on hub_metrics_private.request_limits to service_role;
