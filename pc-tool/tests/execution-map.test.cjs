const fs=require('fs'),vm=require('vm'),assert=require('assert');const raw=fs.readFileSync(require('path').join(__dirname,'../execution-map.html'),'utf8');const data=JSON.parse(raw.match(/<script id="flow-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);let js=raw.match(/<script>\n([\s\S]*?)<\/script>/)[1];js=js.slice(0,js.indexOf("$('overview').innerHTML="));const encoded=JSON.stringify(data);const controls={value:'compact',textContent:encoded};const ctx=vm.createContext({document:{getElementById:()=>controls},console});vm.runInContext(js,ctx);let nodes=0,edges=0;
for(const [id,f] of Object.entries(data.functions)){const g=vm.runInContext('buildGraph(F['+JSON.stringify(id)+'])',ctx);const ids=new Set(g.nodes.map(n=>n.id));assert.equal(ids.size,g.nodes.length,id+' unique nodes');for(const e of g.edges){assert(ids.has(e.a)&&ids.has(e.b),id+' edge endpoints');}for(const n of g.nodes){assert(n.line>=f.start&&n.end<=f.end,id+' source range '+n.line+' '+n.end);assert(Number.isFinite(n.x)&&Number.isFinite(n.y),id+' layout');for(const c of n.calls||[])assert(data.functions[c.target]||c.target.startsWith('SDK::'),id+' target '+c.target);}nodes+=g.nodes.length;edges+=g.edges.length;}
const g=vm.runInContext('buildGraph(F["CAutoDlg::StartAutoRun"])',ctx);assert.equal(g.nodes.filter(n=>n.calls?.some(c=>c.kind==='스레드 시작')).length,2);for(const n of g.nodes.filter(n=>n.kind==='return'))assert(g.edges.some(e=>e.a===n.id&&e.b===g.exit));
const auto=vm.runInContext('buildGraph(F["CAutoDlg::OnButtonAutoRun"])',ctx);const branch=auto.nodes.find(n=>n.kind==='if');assert.deepEqual(auto.edges.filter(e=>e.a===branch.id).map(e=>e.label),['예','아니오']);
const th=vm.runInContext('buildGraph(F["CAutoDlg::gAutoRunECatThread"])',ctx);assert(th.edges.some(e=>e.loop));assert(th.nodes.some(n=>n.line===513&&n.calls.some(c=>c.target==='CAutoDlg::ECat_LoadingPosition_Go')));
console.log(`PASS: ${Object.keys(data.functions).length} functions; ${nodes} nodes; ${edges} edges; source ranges, targets, branches, loopback, return, thread separation.`);
const prep=th.nodes.find(n=>n.parts&&n.parts.some(p=>p.text.includes('m_bThreadECatAbort')));
assert(prep,'ECAT preparation is grouped');
assert.equal(prep.parts.length,6,'every preparation action remains visible');
assert(prep.parts.every(p=>p.note&&p.line),'each action retains its own explanation and source');
assert(prep.note.includes('ECAT 중단 요청 해제'));
assert(prep.h>=prep.parts.length*52,'card grows to fit its actions');
assert(!raw.includes('개 문장 · 변수 초기화·상태 변경·외부 호출 등'));
console.log('PASS: grouped actions show concrete actions and preserve individual source explanations.');

for(const mode of ['compact','full']){
 controls.value=mode;
 for(const id of Object.keys(data.functions)){
  const graph=vm.runInContext('buildGraph(F['+JSON.stringify(id)+'])',ctx);
  for(let i=0;i<graph.nodes.length;i++)for(let j=i+1;j<graph.nodes.length;j++){
   const a=graph.nodes[i],b=graph.nodes[j];
   assert(!(a.x<b.x+b.w-1&&a.x+a.w>b.x+1&&a.y<b.y+b.h-1&&a.y+a.h>b.y+1),`${mode} ${id}: boxes overlap ${a.id}/${b.id} (${a.line}/${b.line})`);
  }
  ctx.graph=graph;
  const routes=vm.runInContext('graph.edges.map(e=>({e,points:edgeRoute(e,graph)}))',ctx);
  for(const {e,points} of routes){if(!points)continue;
   for(let i=1;i<points.length;i++){
    const [x1,y1]=points[i-1],[x2,y2]=points[i];
    for(const n of graph.nodes){if(n.id===e.a||n.id===e.b)continue;
     const crossing=x1===x2?x1>n.x+2&&x1<n.x+n.w-2&&Math.max(y1,y2)>n.y+2&&Math.min(y1,y2)<n.y+n.h-2:y1>n.y+2&&y1<n.y+n.h-2&&Math.max(x1,x2)>n.x+2&&Math.min(x1,x2)<n.x+n.w-2;
     assert(!crossing,`${mode} ${id}: connector ${e.a}/${e.b} crosses box ${n.id} line ${n.line}`);
    }
   }
  }
 }
}
console.log('PASS: compact/full layouts of all 214 functions have no overlapping boxes or connectors crossing unrelated boxes.');

controls.value='compact';
const dg=vm.runInContext('buildGraph(F["CAutoDlg::Delay"])',ctx);
const dc=dg.nodes.find(n=>n.kind==='do');
assert(dc&&dc.line===1407,'do/while condition uses its own source line');
assert(!dg.edges.some(e=>e.a===dg.entry&&e.b===dc.id),'do body executes before its condition');
assert(dg.edges.some(e=>e.a===dc.id&&e.loop),'do repeats its body only on true condition');
console.log('PASS: do/while body precedes condition; condition source is distinct.');

ctx.branchGraph=auto;
const branchLabels=vm.runInContext('branchGraph.edges.filter(e=>e.a==='+JSON.stringify(branch.id)+').map(e=>edgeLabel(e,edgeRoute(e,branchGraph),branchGraph))',ctx);
assert(branchLabels[0].x!==branchLabels[1].x||branchLabels[0].y!==branchLabels[1].y,'yes/no labels occupy separate positions');
console.log('PASS: yes/no branch labels have distinct positions.');
