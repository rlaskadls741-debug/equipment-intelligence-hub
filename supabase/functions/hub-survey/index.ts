// Anonymous equipment-hub survey endpoint.
// A stable browser identifier is hashed before storage; raw identifiers are never persisted.
const trustedOrigin = 'https://rlaskadls741-debug.github.io';
const surveyHeader = 'survey-v3';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const visitorPattern = /^eh-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const qaScopePattern = /^qa-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': trustedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-equipment-hub',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
}

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders() });
}

function validScope(value: unknown): value is string {
  return value === 'production' || (typeof value === 'string' && qaScopePattern.test(value));
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function browserHash(visitorId: string) {
  return sha256('equipment-hub-survey-v3:' + visitorId);
}

Deno.serve(async (req: Request) => {
  if (req.headers.get('origin') !== trustedOrigin) return reply({ error: 'origin_not_allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.headers.get('x-equipment-hub') !== surveyHeader) return reply({ error: 'invalid_client' }, 403);
  if (!['GET', 'POST'].includes(req.method)) return reply({ error: 'method_not_allowed' }, 405);

  const serviceUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceUrl || !serviceKey) return reply({ error: 'unavailable' }, 503);
  const dbHeaders = { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' };
  const base = serviceUrl + '/rest/v1/hub_survey_responses';

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const visitorId = url.searchParams.get('visitor') || '';
      const scope = url.searchParams.get('scope') || 'production';
      if (!visitorPattern.test(visitorId) || !validScope(scope)) return reply({ error: 'invalid_status_request' }, 400);
      const hash = await browserHash(visitorId);
      const check = await fetch(base + '?scope=eq.' + encodeURIComponent(scope) + '&browser_hash=eq.' + hash + '&select=submission_id&limit=1', {
        headers: dbHeaders,
        signal: AbortSignal.timeout(10000)
      });
      if (!check.ok) return reply({ error: 'unavailable' }, 503);
      return reply({ ok: true, submitted: (await check.json()).length > 0 });
    }

    if (!(req.headers.get('content-type') || '').startsWith('application/json')) return reply({ error: 'json_required' }, 415);
    if (Number(req.headers.get('content-length') || 0) > 30000) return reply({ error: 'too_large' }, 413);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 30000) return reply({ error: 'too_large' }, 413);
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); } catch { return reply({ error: 'invalid_json' }, 400); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return reply({ error: 'invalid_data' }, 400);
    const submissionId = String(data.submission_id || '');
    const visitorId = String(data.visitor_id || '');
    if (!uuid.test(submissionId) || data.survey_version !== '2026-10-v3-one-browser') return reply({ error: 'invalid_submission' }, 400);
    if (!visitorPattern.test(visitorId)) return reply({ error: 'invalid_browser' }, 400);
    if (data.website !== '') return reply({ error: 'invalid_submission' }, 400);
    const scope = data.scope || 'production';
    if (!validScope(scope)) return reply({ error: 'invalid_scope' }, 400);
    for (const key of ['satisfaction', 'learning']) {
      if (!['satisfied', 'dissatisfied'].includes(String(data[key] || ''))) return reply({ error: 'invalid_rating' }, 400);
    }
    for (const key of ['helpful', 'improvements', 'comments']) {
      const value = data[key];
      if (typeof value !== 'string' || value.length > 2000) return reply({ error: 'invalid_text' }, 400);
    }

    const browser_hash = await browserHash(visitorId);
    const row = {
      submission_id: submissionId,
      survey_version: data.survey_version,
      scope,
      browser_hash,
      satisfaction: data.satisfaction === 'satisfied' ? 5 : 1,
      learning: data.learning === 'satisfied' ? 5 : 1,
      helpful: String(data.helpful).trim(),
      improvements: String(data.improvements).trim(),
      comments: String(data.comments).trim()
    };
    const payload_hash = await sha256(JSON.stringify(row));

    const priorId = await fetch(base + '?submission_id=eq.' + submissionId + '&select=payload_hash', {
      headers: dbHeaders,
      signal: AbortSignal.timeout(10000)
    });
    if (!priorId.ok) return reply({ error: 'unavailable' }, 503);
    const existingId = await priorId.json();
    if (existingId.length) {
      return existingId[0].payload_hash === payload_hash
        ? reply({ ok: true, receipt: submissionId, duplicate: true })
        : reply({ error: 'submission_conflict' }, 409);
    }

    const priorBrowser = await fetch(base + '?scope=eq.' + encodeURIComponent(scope) + '&browser_hash=eq.' + browser_hash + '&select=submission_id&limit=1', {
      headers: dbHeaders,
      signal: AbortSignal.timeout(10000)
    });
    if (!priorBrowser.ok) return reply({ error: 'unavailable' }, 503);
    if ((await priorBrowser.json()).length) return reply({ error: 'already_submitted', duplicate: true }, 409);

    const since = new Date(Date.now() - 60000).toISOString();
    const count = await fetch(base + '?scope=eq.' + encodeURIComponent(String(scope)) + '&created_at=gte.' + encodeURIComponent(since) + '&select=submission_id&limit=60', {
      headers: dbHeaders,
      signal: AbortSignal.timeout(10000)
    });
    if (!count.ok) return reply({ error: 'unavailable' }, 503);
    if ((await count.json()).length >= 60) return reply({ error: 'rate_limit' }, 429);

    const result = await fetch(base + '?select=submission_id', {
      method: 'POST',
      headers: { ...dbHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({ ...row, payload_hash }),
      signal: AbortSignal.timeout(10000)
    });
    if (result.status === 409) {
      const raced = await fetch(base + '?scope=eq.' + encodeURIComponent(String(scope)) + '&browser_hash=eq.' + browser_hash + '&select=submission_id&limit=1', {
        headers: dbHeaders,
        signal: AbortSignal.timeout(10000)
      });
      if (raced.ok && (await raced.json()).length) return reply({ error: 'already_submitted', duplicate: true }, 409);
    }
    if (!result.ok) {
      console.error('survey insert failed', result.status);
      return reply({ error: 'unavailable' }, 503);
    }
    return reply({ ok: true, receipt: submissionId }, 201);
  } catch (error) {
    console.error('survey failure', error instanceof Error ? error.name : 'unknown');
    return reply({ error: 'unavailable' }, 503);
  }
});
