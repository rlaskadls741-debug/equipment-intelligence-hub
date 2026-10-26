const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto,randomUUID}=require('node:crypto');
function setup(){
  let handler,rateLimit=false;const rows=new Map();
  const context={Request,Response,URL,TextEncoder,Uint8Array,crypto:webcrypto,AbortSignal,Date,console,
    Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://db.test':'server-only-secret'},serve:f=>handler=f},
    fetch:async(url,opts={})=>{
      assert.equal(opts.headers.apikey,'server-only-secret');
      const u=new URL(url);
      if(opts.method==='POST'){
        const row=JSON.parse(opts.body);
        if(rows.has(row.submission_id))return Response.json([]);
        rows.set(row.submission_id,row);return Response.json([row],{status:201});
      }
      const id=u.searchParams.get('submission_id');
      if(id)return Response.json(rows.has(id.slice(3))?[rows.get(id.slice(3))]:[]);
      return Response.json(rateLimit?Array(60).fill({}):[...rows.values()]);
    }};
  vm.runInNewContext(fs.readFileSync(__dirname+'/../supabase/functions/hub-survey/index.ts','utf8'),context);
  const answers={submission_id:randomUUID(),survey_version:'2026-10-v1',scope:'production',satisfaction:4,learning:5,helpful:'원리 설명',improvements:'사례 추가',comments:'',website:''};
  const send=(body=answers,origin='https://rlaskadls741-debug.github.io',method='POST')=>handler(new Request('https://functions.test/hub-survey',{method,headers:{origin,'content-type':'application/json'},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}));
  return {send,answers,rows,limit:()=>rateLimit=true};
}
test('valid response is saved once and identical retry returns same receipt',async()=>{
  const s=setup();const first=await s.send();assert.equal(first.status,201);assert.equal((await first.json()).receipt,s.answers.submission_id);
  const retry=await s.send();assert.equal(retry.status,200);assert.equal((await retry.json()).duplicate,true);assert.equal(s.rows.size,1);
  assert.equal((await s.send({...s.answers,satisfaction:1})).status,409);
});
test('ratings, text, body and honeypot validation reject malformed responses',async()=>{
  const s=setup();for(const field of ['satisfaction','learning'])for(const value of [0,6,1.5,'4',null])assert.equal((await s.send({...s.answers,[field]:value})).status,400);
  assert.equal((await s.send({...s.answers,helpful:'가'.repeat(2001)})).status,400);
  assert.equal((await s.send({...s.answers,comments:12})).status,400);
  assert.equal((await s.send({...s.answers,website:'spam'})).status,400);
  assert.equal((await s.send('{')).status,400);
  assert.equal((await s.send('x'.repeat(30001))).status,413);
  assert.equal(s.rows.size,0);
});
test('results cannot be read; origins, preflight and throttle behave correctly',async()=>{
  const s=setup();assert.equal((await s.send(s.answers,'https://bad.example')).status,403);
  assert.equal((await s.send(s.answers,undefined,'GET')).status,405);
  const preflight=await s.send(s.answers,undefined,'OPTIONS');assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),'https://rlaskadls741-debug.github.io');
  s.limit();assert.equal((await s.send()).status,429);assert.equal(s.rows.size,0);
});
