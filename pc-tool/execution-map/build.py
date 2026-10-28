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
# Display wording only; original C++ and source-part files are unchanged.
for annotations in T['annotations'].values():
 for annotation in annotations:
  if annotation.get('text'):
   annotation['text']=annotation['text'].replace('가 참/0이 아닌지 동안 본문을 반복한다.','가 0이 아닌 동안 반복한다.').replace('반복문를','반복문을').replace('자동 START 버튼','AUTO 탭 Run 버튼').replace('화면 START 버튼','AUTO 탭 Run 버튼')
WAIT_NOTES={
 ('CDemoKitDlg::OnDestroy',415):('감시 스레드의 실행 표시가 아직 켜져 있는가?', '414행에서 m_bMonitorExe를 FALSE로 바꿔 감시 종료를 요청했습니다. 이 조건에서는 m_bThreadMonitor가 TRUE인 동안 메시지를 큐에서 꺼내고 10 ms씩 쉬며 실행 표시를 다시 확인합니다. 감시 스레드가 종료 단계에서 이 표시를 FALSE로 바꾸면 반복문을 빠져나가 다음 정리 처리를 진행합니다.'),
 ('CDemoKitDlg::OnDestroy',432):('입력 감시 스레드의 실행 표시가 아직 켜져 있는가?', '431행에서 m_bIOExe를 FALSE로 바꿔 입력 감시 종료를 요청했습니다. m_bThreadIO가 TRUE인 동안 메시지를 큐에서 꺼내고 10 ms씩 쉬며 실행 표시를 다시 확인합니다. 이 표시가 FALSE가 되면 반복문을 빠져나가 다음 정리 처리를 진행합니다.'),
 ('CAutoDlg::StopECatAutoRun',384):('ECAT 자동 작업의 실행 표시가 아직 켜져 있는가?', '중단 요청을 설정한 뒤 m_bThreadRunECat를 확인합니다. TRUE이면 메시지를 큐에서 꺼내고 10 ms씩 쉬며 다시 확인합니다. FALSE가 되어야 반복문을 빠져나가 다음 정리 처리를 진행합니다. 중단 요청 자체가 실행 표시를 즉시 끄는 것은 아닙니다.'),
 ('CAutoDlg::StopPM2QAutoRun',415):('PM2Q 자동 작업의 실행 표시가 아직 켜져 있는가?', '중단 요청을 설정한 뒤 m_bThreadRunPM2Q를 확인합니다. TRUE이면 메시지를 큐에서 꺼내고 10 ms씩 쉬며 다시 확인합니다. FALSE가 되어야 반복문을 빠져나가 다음 정리 처리를 진행합니다. 중단 요청 자체가 실행 표시를 즉시 끄는 것은 아닙니다.')
}
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
   override=WAIT_NOTES.get((key,n['line']))
   if override:n['title'],n['note']=override
   elif n['kind']=='while' and n['text'].replace(' ','')=='while(WaitForDone)':
    n['title']='두 축의 이동 완료를 계속 확인해야 하는가?'
    n['note']='WaitForDone이 TRUE인 동안 두 축의 InMotion 상태를 반복해서 읽습니다. 두 상태가 모두 0이면 본문에서 WaitForDone을 FALSE로 바꾸고 반복을 끝냅니다.'
   if n.get('body') is not None:enrich(n['body']);enrich(n.get('alt',[]))
 enrich(ast)
 F[key]={**f,'ast':ast}
if failures: raise RuntimeError('Unparsed functions: '+str(failures))
D=dict(functions=F,source=T['source'],annotations=T['annotations'],charts=T['model'],evidence=T['evidence'],revision='2026-10-28')
payload=json.dumps(D,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
output=(ROOT/'execution-map'/'template.html').read_text().replace('__DATA__',payload)
(ROOT/'execution-map.html').write_text(output)
print(f'Built execution-map.html: {len(F)} functions, {len(T["source"])} source files')
