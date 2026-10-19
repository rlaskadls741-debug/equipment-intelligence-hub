// Purpose-limited public anonymous metrics; no user login or browser admin key.
const trustedOrigin = "https://rlaskadls741-debug.github.io";
function headers(req: Request) {
  const origin=req.headers.get("origin");
  return {"Access-Control-Allow-Origin":origin==="null"?"null":trustedOrigin,
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type,X-Equipment-Hub",
    "Cache-Control":"no-store","Vary":"Origin"};
}
function response(req: Request, body: unknown, status=200) {
  return Response.json(body,{status,headers:headers(req)});
}
function week(date: string) {
  const d=new Date(date+"T00:00:00Z");
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||isNaN(d.getTime())||d.toISOString().slice(0,10)!==date)throw Error("Invalid date");
  d.setUTCDate(d.getUTCDate()-d.getUTCDay());return d.toISOString().slice(0,10);
}
Deno.serve(async(req: Request)=>{
  const origin=req.headers.get("origin"),allowed=origin===trustedOrigin||origin==="null";
  if(req.method==="OPTIONS")return new Response(null,{status:allowed?204:403,headers:headers(req)});
  try{
    const url=new URL(req.url),scope=url.searchParams.get("test")||"production";
    if(scope!=="production"&&!/^qa-[a-f0-9-]{36}$/.test(scope))return response(req,{error:"Invalid scope"},400);
    const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul"}).format(new Date());
    let type="read",target=url.searchParams.get("week")||"",visitor=null,event=null,report=null;
    if(req.method==="POST"){
      if(!allowed||(origin==="null"&&req.headers.get("X-Equipment-Hub")!=="metrics-v3"))return response(req,{error:"Origin not allowed"},403);
      if(Number(req.headers.get("content-length")||0)>2048)return response(req,{error:"Too large"},413);
      const raw=await req.text();if(raw.length>2048)return response(req,{error:"Too large"},413);
      const data=JSON.parse(raw);
      if(!/^eh-[a-f0-9-]{36}$/.test(data.visitor||""))return response(req,{error:"Invalid visitor"},400);
      visitor=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(data.visitor))),b=>b.toString(16).padStart(2,"0")).join("");
      type=data.type;
      if(type==="visit")target=url.searchParams.get("week")||"";
      else if(type==="open"){
        if(data.date>today||data.date<"2026-01-01")return response(req,{error:"Invalid date"},400);
        target=week(data.date);event=data.event;report=data.report;
        if(!/^[-a-zA-Z0-9_]{1,150}$/.test(event||"")||!/^[-a-zA-Z0-9_]{1,100}$/.test(report||""))return response(req,{error:"Invalid event"},400);
      }else return response(req,{error:"Invalid type"},400);
    }else if(req.method!=="GET")return response(req,{error:"Method not allowed"},405);
    if(week(target)!==target||target>today)return response(req,{error:"Invalid week"},400);
    const serviceUrl=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!serviceUrl||!key)throw Error("Missing server configuration");
    const r=await fetch(serviceUrl+"/rest/v1/rpc/hub_metrics",{
      method:"POST",headers:{"Content-Type":"application/json",apikey:key,Authorization:"Bearer "+key},
      body:JSON.stringify({p_scope:scope,p_type:type,p_week:target,p_visitor:visitor,p_event:event,p_report:report}),
      signal:AbortSignal.timeout(10000)
    });
    if(!r.ok){console.error("metrics RPC failed",r.status);return response(req,{error:"Metrics unavailable"},503)}
    const data=await r.json();
    return response(req,data,data.error==="rate_limit"?429:200);
  }catch(error){console.error("metrics failure",error instanceof Error?error.message:"unknown");return response(req,{error:"Metrics unavailable"},503)}
});
