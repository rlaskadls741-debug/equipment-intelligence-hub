const fs=require('fs'),assert=require('assert'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'study-checklist.html'),'utf8');
const plan=JSON.parse(html.match(/<script id="study-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const flow=JSON.parse(fs.readFileSync(path.join(root,'execution-map.html'),'utf8').match(/<script id="flow-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.equal(plan.length,11);let total=0,excerpts=0;
for(const d of plan){assert(flow.functions[d.fn]);assert.equal(d.tasks.length,d.lesson.units.length,'existing progress indexes retained');assert(d.lesson.location&&d.lesson.goal);for(const u of d.lesson.units){total++;for(const key of ['title','explain','practice','answer'])assert(u[key].length>10,d.date+' '+key);assert(u.snippets.length);for(const sn of u.snippets){const src=flow.source[sn.file].split(/\r?\n/);const expected=Array.from({length:sn.end-sn.start+1},(_,i)=>`${sn.start+i}: ${src[sn.start+i-1]}`).join('\n');assert.equal(sn.code,expected,'code excerpts match original source');excerpts++;}}}
assert.equal(total,80);assert(html.includes("KEY='pc-control-study-2026-10-v1'"),'same storage key');assert(html.includes("const k=d.date+'-'+i"),'same stable task identifiers');new vm.Script(html.match(/<script>\n([\s\S]*?)<\/script>/)[1]);
const operators=plan.find(d=>d.date==='2026-11-02').lesson.units;assert(operators.some(u=>u.explain.includes('0x01')&&u.answer.includes('0, 1, 0, 1')),'bitwise exercise has worked result');
console.log(`PASS: 11 days, ${total} explained units, ${excerpts} exact source excerpts, existing progress keys, and valid JavaScript.`);
