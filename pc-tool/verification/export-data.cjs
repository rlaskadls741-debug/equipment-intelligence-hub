// Extract the same corrected payload that the browser loads; no browser or C++ execution.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const original=['source-part1.txt','source-part2.txt'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('');
const context={window:{}};
for(const f of ['reader-updates.js','content-verification.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),context);
const corrected=context.window.DemoKitContentVerification.apply(context.window.DemoKitReaderUpdates.apply(original));
const json=corrected.match(/<script[^>]*id="control-trace"[^>]*>([\s\S]*?)<\/script>/)[1];
const out=process.argv[2];if(!out)throw new Error('Usage: node export-data.cjs /path/control-trace.json');
fs.writeFileSync(out,json+'\n');
console.log('Corrected analysis payload extracted. Original C++ is not executed.');
