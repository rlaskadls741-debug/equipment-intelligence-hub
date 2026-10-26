// Public survey submission. JWT gateway remains enabled. No public result endpoint.
const trustedOrigin = 'https://rlaskadls741-debug.github.io';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function headers() {
  return { 'Access-Control-Allow-Origin': trustedOrigin,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
    'Cache-Control': 'no-store', 'Vary': 'Origin' };
}
function reply(body, status = 200) { return Response.json(body, { status, headers: headers() }); }
Deno.serve(async (req) => {
  if (req.headers.get('origin') !== trustedOrigin) return reply({error:'origin_not_allowed'}, 403);
  if (req.method === 'OPTIONS') return new Response(null, {status:204, headers:headers()});
  if (req.method !== 'POST') return reply({error:'method_not_allowed'}, 405);
  if (!(req.headers.get('content-type') || '').startsWith('application/json')) return reply({error:'json_required'}, 415);
  try {
    if (Number(req.headers.get('content-length') || 0) > 30000) return reply({error:'too_large'}, 413);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 30000) return reply({error:'too_large'}, 413);
    let data;
    try { data = JSON.parse(raw); } catch { return reply({error:'invalid_json'}, 400); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return reply({error:'invalid_data'},400);
    if (!uuid.test(data.submission_id || '') || data.survey_version !== '2026-10-v1') return reply({error:'invalid_submission'},400);
    if (data.website !== '') return reply({error:'invalid_submission'},400);
    const scope = data.scope || 'production';
    if (scope !== 'production' && !/^qa-[0-9a-f-]{36}$/.test(scope)) return reply({error:'invalid_scope'},400);
    for (const key of ['satisfaction','learning']) {
      if (!Number.isInteger(data[key]) || data[key] < 1 || data[key] > 5) return reply({error:'invalid_rating'},400);
    }
    for (const key of ['helpful','improvements','comments']) {
      if (typeof data[key] !== 'string' || data[key].length > 2000) return reply({error:'invalid_text'},400);
    }
    const row = { submission_id:data.submission_id, survey_version:data.survey_version, scope,
      satisfaction:data.satisfaction, learning:data.learning, helpful:data.helpful.trim(),
      improvements:data.improvements.trim(), comments:data.comments.trim() };
    const encoded = new TextEncoder().encode(JSON.stringify(row));
    const hash = await crypto.subtle.digest('SHA-256', encoded);
    const payload_hash = Array.from(new Uint8Array(hash), b=>b.toString(16).padStart(2,'0')).join('');
    const serviceUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceUrl || !serviceKey) return reply({error:'unavailable'},503);
    const dbHeaders = {apikey:serviceKey, Authorization:'Bearer '+serviceKey, 'Content-Type':'application/json'};
    const base = serviceUrl + '/rest/v1/hub_survey_responses';
    // Enforce idempotency before considering new submissions.
    const prior = await fetch(base+'?submission_id=eq.'+data.submission_id+'&select=payload_hash',
      {headers:dbHeaders, signal:AbortSignal.timeout(10000)});
    if (!prior.ok) return reply({error:'unavailable'},503);
    const existing = await prior.json();
    if (existing.length) return existing[0].payload_hash === payload_hash
      ? reply({ok:true, receipt:data.submission_id, duplicate:true}) : reply({error:'submission_conflict'},409);
    const since = new Date(Date.now()-60000).toISOString();
    const count = await fetch(base+'?scope=eq.'+scope+'&created_at=gte.'+since+'&select=submission_id&limit=60',
      {headers:dbHeaders, signal:AbortSignal.timeout(10000)});
    if (!count.ok) return reply({error:'unavailable'},503);
    if ((await count.json()).length >= 60) return reply({error:'rate_limit'},429);
    const result = await fetch(base+'?on_conflict=submission_id&select=submission_id,payload_hash', {
      method:'POST', headers:{...dbHeaders, Prefer:'resolution=ignore-duplicates,return=representation'},
      body:JSON.stringify({...row,payload_hash}), signal:AbortSignal.timeout(10000)
    });
    if (!result.ok) { console.error('survey insert failed',result.status); return reply({error:'unavailable'},503); }
    const inserted = await result.json();
    if (!inserted.length) {
      const retry = await fetch(base+'?submission_id=eq.'+data.submission_id+'&select=payload_hash',
        {headers:dbHeaders,signal:AbortSignal.timeout(10000)});
      if (!retry.ok) return reply({error:'unavailable'},503);
      const found = await retry.json();
      if (!found.length || found[0].payload_hash !== payload_hash) return reply({error:'submission_conflict'},409);
      return reply({ok:true,receipt:data.submission_id,duplicate:true});
    }
    return reply({ok:true,receipt:data.submission_id},201);
  } catch (error) {
    console.error('survey failure',error instanceof Error ? error.name : 'unknown');
    return reply({error:'unavailable'},503);
  }
});
