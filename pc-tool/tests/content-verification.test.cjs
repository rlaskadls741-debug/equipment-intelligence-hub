const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const original=['source-part1.txt','source-part2.txt'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('');
const data=s=>JSON.parse(s.match(/<script[^>]*id="control-trace"[^>]*>([\s\S]*?)<\/script>/)[1]);
const before=data(original),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'content-verification.js'),'utf8'),context);
const html=context.window.DemoKitContentVerification.apply(original),after=data(html);
test('content corrections preserve every original C++ file and its provenance',()=>{
 assert.deepEqual(after.source,before.source);assert.deepEqual(after.files,before.files);assert.deepEqual(after.provenance,before.provenance);
});
test('constructor index does not treat class qualification as construction',()=>{
 const e=after.dictionary.entries.find(e=>e.id==='function:CAutoDlg::CAutoDlg');
 assert.ok(!e.uses.some(r=>r.file==='AutoDlg.cpp'&&r.start===61));
 assert.ok(e.guide.examples.some(x=>x.ref.file==='AutoDlg.cpp'&&x.ref.start===18));
});
test('local variable examples and uses stay inside their declared file and bounds',()=>{
 const e=after.dictionary.entries.find(e=>e.id==='local:GridCtrl.cpp:5429:left');
 assert.ok(e.uses.length>0);
 for(const r of [...e.uses,...e.guide.examples.map(x=>x.ref)])assert.ok(r.file==='GridCtrl.cpp'&&r.start>=e.bounds[0]&&r.end<=e.bounds[1]);
});
test('home and vacuum evidence point to the actual messages and sensor conditions',()=>{
 const refs=after.evidence['06C_home_result:observe'].refs;
 assert.ok(refs.some(r=>r.file==='DemoKitDlg.cpp'&&r.start===1296&&r.end===1303));
 assert.ok(!refs.some(r=>r.file==='DemoKitDlg.cpp'&&r.start===1306));
 assert.ok(after.evidence['12B_vacuum_wait:sensor'].refs.some(r=>r.start===1461));
 assert.equal(after.annotation_info.total_source_lines,28520);
 assert.equal(after.constants.VC_EXTRALEAN.value,'');
 assert.equal(after.constants.VC_EXTRALEAN.value_note,'치환 값 없음');
});
test('corrected inline JavaScript parses before the page is deployed',()=>{
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/application\/json/.test(m[1]))new vm.Script(m[2]);
});
test('conditions preserve pointer access, address arguments and full OR continuations',()=>{
 assert.ok(after.annotations['AutoDlg.cpp'][69].text.includes('pMsg->message'));
 assert.ok(after.annotations['AutoDlg.cpp'][69].text.includes('||'));
 assert.ok(!after.annotations['AutoDlg.cpp'][69].text.includes('보다 큼'));
 assert.ok(!after.annotations['AutoDlg.cpp'][70].text.includes('앞줄과 &&'));
 assert.match(after.annotations['AutoDlg.cpp'][387].text,/PeekMessage/);
 assert.match(after.annotations['AutoDlg.cpp'][387].text,/메시지를 큐에서 제거/);
 assert.ok(after.annotations['AutoDlg.cpp'][109].text.includes('명시적 초기화식'));
});
