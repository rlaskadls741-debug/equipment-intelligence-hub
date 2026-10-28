import json,re,html
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
combined="".join((ROOT / name).read_text() for name in ["source-part1.txt","source-part2.txt"])
match=re.search(r'<script[^>]*id="control-trace"[^>]*>(.*?)</script>',combined,re.S)
from pathlib import Path
T=json.loads(match[1])
# Preserve line positions while excluding comments and preprocessor directives.
def clean(s):
 pat=r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|//[^\n]*|/\*[\s\S]*?\*/|^[ \t]*\#[^\n]*'
 def sub(m):
  a=m[0]
  return ''.join('\n' if x=='\n' else ' ' for x in a) if a.startswith(('//','/*')) or a.lstrip().startswith('#') else a
 return re.sub(pat,sub,s,flags=re.M)
class Parser:
 def __init__(self,s,base): self.s=s;self.i=0;self.base=base
 def ws(self):
  while self.i<len(self.s) and self.s[self.i].isspace(): self.i+=1
 def line(self): return self.base+self.s[:self.i].count('\n')
 def balanced(self,op='(',cl=')'):
  self.ws(); start=self.i
  if self.i>=len(self.s) or self.s[self.i]!=op: raise ValueError('expected '+op)
  depth=0; quote=None
  while self.i<len(self.s):
   c=self.s[self.i]; self.i+=1
   if quote:
    if c=='\\': self.i+=1
    elif c==quote: quote=None
   elif c in '\"\'': quote=c
   elif c==op: depth+=1
   elif c==cl:
    depth-=1
    if not depth:return self.s[start:self.i]
  raise ValueError('unclosed')
 def body(self):
  self.ws()
  if self.i<len(self.s) and self.s[self.i]=='{':
   self.i+=1;out=[]
   while True:
    self.ws()
    if self.i>=len(self.s):raise ValueError('missing brace')
    if self.s[self.i]=='}':self.i+=1;return out
    out+=self.statement()
  return self.statement()
 def statement(self):
  self.ws(); start=self.i;line=self.line();m=re.match(r'(if|while|for|switch|do)\b',self.s[self.i:])
  if m:
   k=m[1];self.i+=len(k)
   if k=='do':
    body=self.body();self.ws()
    if not self.s.startswith('while',self.i):raise ValueError('do while')
    condition_line=self.line();self.i+=5;cond=self.balanced();self.ws()
    if self.s[self.i:self.i+1]==';':self.i+=1
    return [dict(kind='do',text='do … while '+cond,line=condition_line,end=self.line(),body=body)]
   cond=self.balanced();headerend=self.line()
   if k=='switch':
    # Switch branches are shown as one source block; never invent a sequential path.
    self.ws();self.balanced('{','}')
    return [dict(kind='opaque',text='switch '+cond,line=line,end=self.line(),note='switch의 case 분기는 원문에서 확인합니다. 이 상자는 분기 내부를 펼치지 않습니다.')]
   body=self.body();alt=[]
   if k=='if':
    self.ws()
    if re.match(r'else\b',self.s[self.i:]):self.i+=4;alt=self.body()
   return [dict(kind=k,text=k+' '+cond,line=line,end=headerend,body=body,alt=alt)]
  if self.s[self.i:self.i+1]=='{':return self.body()
  depth=0;quote=None
  while self.i<len(self.s):
   c=self.s[self.i]
   if quote:
    if c=='\\':self.i+=2;continue
    if c==quote:quote=None
   elif c in '\"\'':quote=c
   elif c in '([{':depth+=1
   elif c in ')]':depth-=1
   elif c=='}' and depth>0:depth-=1
   elif c==';' and depth==0:
    self.i+=1;break
   elif c=='}' and depth==0:raise ValueError('statement without semicolon')
   self.i+=1
  text=self.s[start:self.i].strip();kind='return' if re.match(r'(return|throw)\b',text) else 'break' if re.match(r'break\b',text) else 'continue' if re.match(r'continue\b',text) else 'process'
  return [dict(kind=kind,text=text,line=line,end=self.line())] if text else []
F={}; failures=[]
for key,f in T['functions'].items():
 rows=T['source'][f['file']].splitlines();raw='\n'.join(rows[f['start']-1:f['end']]);s=clean(raw);p=Parser(s,f['start']);p.i=s.index('{')
 try:ast=p.body()
 except Exception as e:ast=[dict(kind='opaque',text='구조를 자동 분해하지 않은 함수',line=f['start'],end=f['end'],note='이 함수는 원문과 기존 흐름도로 확인합니다.')];failures.append((key,str(e)))
 def enrich(items):
  for n in items:
   n['calls']=[c for c in f['calls'] if n['line']<=c['line']<=n['end']]
   # Message dispatch and framework hooks are explicit, separately labelled connections.
   if key=='CDemoKitDlg::OnAutoRun' and n['line'] in (1504,1509): n['calls']+=[dict(target='CAutoDlg::OnAutoRunUpdate',line=n['line'],kind='동기 메시지 전달')]
   if key=='CDemoKitApp::InitInstance' and n['line']==85:n['calls']+=[dict(target='CDemoKitDlg::OnInitDialog',line=85,kind='MFC 초기화 콜백')]
   ann=T['annotations'][f['file']][n['line']-1:n['end']]
   n['note']=n.get('note') or next((a['text'] for a in ann if a.get('kind') in ('code','declaration') and a.get('text')),'')
   if n.get('body') is not None:enrich(n['body']);enrich(n.get('alt',[]))
 enrich(ast)
 F[key]={**f,'ast':ast}
if failures: raise RuntimeError('Unparsed functions: '+str(failures))
D=dict(functions=F,source=T['source'],annotations=T['annotations'],charts=T['model'],evidence=T['evidence'],revision='2026-10-28')
payload=json.dumps(D,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
output=(ROOT/'execution-map'/'template.html').read_text().replace('__DATA__',payload)
(ROOT/'execution-map.html').write_text(output)
print(f'Built execution-map.html: {len(F)} functions, {len(T["source"])} source files')
