#!/usr/bin/env python3
"""Reproducible, exhaustive static checks. This is not a C++ compiler or a plant test.

Usage: python audit.py --data control-trace.json --original DemoKit_FULL_EXPORT.txt --out results.json
The data must be extracted AFTER the loader's content corrections have been applied.
No original Windows directory names are emitted.
"""
import argparse
import collections
import hashlib
import json
import re
from pathlib import Path


def digest(data):
    return hashlib.sha256(data).hexdigest()


def lexical(text):
    # Preserve columns/lines while excluding comments and literals. Does not expand macros.
    pattern = re.compile(r'//[^\n]*|/\*[\s\S]*?\*/|(?:u8|[LuU])?"(?:\\[\s\S]|[^"\\])*"|(?:[LuU])?\'(?:\\[\s\S]|[^\'\\])*\'')
    return pattern.sub(lambda m: re.sub(r'[^\n]', ' ', m.group()), text)


def run(data, original, partsdir=None, mot=None):
    T = data
    rows = {f: s.splitlines() for f, s in T['source'].items()}
    clean = {f: lexical(s).splitlines() for f, s in T['source'].items()}
    report = {'schema': 1, 'run_date': '2026-10-21', 'method': '정적 전수 검사 · 주석/문자열 제외 색인 · 원본 독립 대조',
              'limits': ['C++ 컴파일·AST·실행 검증 아님', '참조 일치가 자연어 해설의 사실성을 보장하지 않음',
                         '외부 SDK의 계약·장치 설정·실제 배선·운전 결과는 별도 확인 대상'],
              'checks': [], 'files': [], 'dictionary': [], 'flows': [], 'issues': []}
    checks = report['checks']

    def record(group, ident, passed, detail=''):
        checks.append({'group': group, 'id': ident, 'pass': bool(passed), 'detail': detail})

    def refok(r):
        f, a, b = r.get('file'), r.get('start', r.get('line')), r.get('end', r.get('start', r.get('line')))
        return f in rows and isinstance(a, int) and isinstance(b, int) and 1 <= a <= b <= len(rows[f])

    def snippet(r, stripped=False):
        if not refok(r):
            return ''
        a, b = r.get('start', r.get('line')), r.get('end', r.get('start', r.get('line')))
        return '\n'.join((clean if stripped else rows)[r['file']][a-1:b])

    def hasname(name, text):
        if re.fullmatch(r'~?[A-Za-z_]\w*', name):
            return re.search(r'(?<!\w)'+re.escape(name)+r'(?!\w)', text) is not None
        return name in text

    original_blocks = {}
    if original:
        blob = Path(original).read_bytes()
        report['original'] = {'name': Path(original).name, 'sha256': digest(blob)}
        record('original', 'export-sha256', digest(blob) == T['provenance']['sha256'], '업로드 원본 바이트와 출처 기록의 일치')
        lines = blob.decode('utf-8-sig').splitlines()
        markers = [i for i, s in enumerate(lines) if s.startswith('FILE: ')]
        for n, i in enumerate(markers):
            f = re.split(r'[\\/]', lines[i][6:])[-1]
            end = markers[n+1]-1 if n+1 < len(markers) else len(lines)
            block = lines[i+2:end]
            if n+1 < len(markers) and block and block[-1] == '':
                block.pop()  # export separator, not a C++ line
            original_blocks[f] = (i+3, block)
        report['original']['blocks'] = len(original_blocks)
        report['original']['not_embedded'] = sorted(set(original_blocks)-set(rows))
    else:
        record('original', 'uploaded-original-required', False, '--original 입력 없으므로 원본 독립 대조를 수행하지 못함')

    for f, s in T['source'].items():
        m = T['files'][f]
        normalized = digest(s.encode('utf-8')) == m['sha256_normalized']
        record('file', f+':hash', normalized)
        record('file', f+':lines', len(rows[f]) == m['lines'])
        record('annotation', f+':coverage', len(T['annotations'].get(f, [])) == len(rows[f]))
        block = original_blocks.get(f)
        independent = bool(block and '\n'.join(block[1]).rstrip('\n') == s.rstrip('\n') and block[0] == m['export_start'])
        record('original', f, independent, 'LF 변환·파일 끝 빈 행 정리 기준 코드와 export 시작 행 일치')
        report['files'].append({'file': f, 'lines': len(rows[f]), 'sha256': m['sha256_normalized'], 'original_equal': independent, 'embedded_hash_equal': normalized,
                                'trailing_blank_lines_removed':max(0,len(block[1])-len(rows[f])) if block else None})
        meaningful=0
        for i,a in enumerate(T['annotations'][f]):
            if a['kind'] in ['code','declaration']:
                meaningful+=1
                record('annotation-row',f+':'+str(i+1),bool(clean[f][i].strip()),'해설이 주석·빈 줄만을 실행 코드로 제시하는지 검사')
        report['files'][-1]['meaningful_annotations']=meaningful
        report['files'][-1]['annotation_meaning_status']='행 연결 확인 · 자연어 전 문장의 독립 의미 검증 미완료'

    # Every nested file/start/end object, including guides, returns and project grammar examples.
    def walk(obj, path='data'):
        if isinstance(obj, dict):
            if 'file' in obj and ('start' in obj or 'line' in obj):
                record('reference', path, refok(obj), (str(obj.get('file'))+':'+str(obj.get('start',obj.get('line')))))
            for k, v in obj.items():
                if k != 'source':
                    walk(v, path+'.'+str(k))
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                walk(v, path+'['+str(i)+']')
    walk(T)

    for q, f in T['functions'].items():
        head = '\n'.join(rows[f['file']][f['start']-1:min(f['end'],f['start']+3)])
        record('function', q, hasname(f['name'], head), f['file']+':'+str(f['start']))
    for i, c in enumerate(T['calls']):
        name = c['target'].split('::')[-1]
        text = snippet({'file': c['file'], 'line': c['line']}, True)
        if c['kind']=='스레드 시작':
            good = 'AfxBeginThread' in text and hasname(name,text)
        elif c['kind']=='메시지 전달':
            b=c.get('binding',{});binding_text=snippet({'file':b.get('file'),'line':b.get('line')},True)
            good='SendMessage' in text and hasname(b.get('event','!missing'),text) and hasname(name,binding_text) and hasname(b.get('event','!missing'),binding_text)
        else:
            good=bool(re.search(r'(?<!\w)'+re.escape(name)+r'\s*\(',text))
        record('call', str(i)+':target', good, c['target']+' / '+c['kind'])
        caller = T['functions'].get(c['caller'])
        record('call', str(i)+':scope', bool(caller and caller['file']==c['file'] and caller['start']<=c['line']<=caller['end']), c['caller'])

    ids = [e['id'] for e in T['dictionary']['entries']]
    record('dictionary', 'unique-ids', len(ids)==len(set(ids)))
    for e in T['dictionary']['entries']:
        ident, name, kind = e['id'], e['name'], e['kind']
        bad = []
        if kind not in ['grammar','declaration']:
            for j, r in enumerate(e.get('declarations', [])):
                good = hasname(name, snippet(r, True))
                if kind=='function' and not good:
                    good=indirect_location(T,e,r,clean)
                record('declaration-token', ident+':'+str(j), good)
                if not good: bad.append('declaration:'+str(j))
            for j, r in enumerate(e.get('uses', [])):
                good = hasname(name, snippet(r, True))
                if kind=='function':
                    if e['type']=='생성자':good=bool(re.search(r'(?<![\w~])'+re.escape(name)+r'\s*\(',snippet(r,True)))
                    elif not good:good=indirect_location(T,e,r,clean)
                record('usage-token', ident+':'+str(j), good)
                if not good: bad.append('use:'+str(j))
                if kind in ['local','parameter'] and e.get('bounds'):
                    lo,hi=e['bounds'];good=r['file']==e['declarations'][0]['file'] and lo<=r['start']<=r['end']<=hi
                    record('variable-scope',ident+':'+str(j),good,e.get('function_scope',''))
                    if not good:bad.append('scope:'+str(j))
        for j, x in enumerate(e.get('guide',{}).get('examples',[])):
            actual = snippet(x['ref']).strip()
            code = x['code'].strip()
            # Only whitespace differs in displayed samples; comments remain visible.
            good = re.sub(r'\s+','',actual)==re.sub(r'\s+','',code)
            record('example-code', ident+':'+str(j), good)
            if not good: bad.append('example:'+str(j))
            if kind=='function':
                good=function_location(T,e,x['ref'],clean)
                record('function-example', ident+':'+str(j), good)
                if not good: bad.append('function-example:'+str(j))
        for group in e.get('occurrences', []):
            for line in group['lines']:
                record('grammar-location', ident+':'+group['file']+':'+str(line), refok({'file':group['file'],'line':line}))
        report['dictionary'].append({'id':ident,'name':name,'kind':kind,'references':len(e.get('declarations',[]))+len(e.get('uses',[])),
                                     'examples':len(e.get('guide',{}).get('examples',[])), 'problems':bad,
                                     'meaning_status':'external_contract_unverified' if kind=='sdk' else 'language_review' if kind=='grammar' else 'source_index_with_interpretation'})

    ev=T['evidence']
    for m in T['model']:
        node_ids={n['id'] for n in m['nodes']}
        for n in m['nodes']:
            key=n['evidence_key']
            record('flow', key+':evidence',key in ev)
            if n.get('link'):
                record('flow',key+':link',n['link'] in {c['id'] for c in T['model']})
            e=ev.get(key,{})
            for field, collection in [('functions',T['functions']),('variables',T['variables']),('constants',T['constants']),('manuals',T['manuals'])]:
                for value in e.get(field,[]):record('flow',key+':'+field+':'+value,value in collection)
            report['flows'].append({'id':key,'chart':m['id'],'text':n['text'],'kind':e.get('kind'),'references':e.get('refs',[]),'note':e.get('note','')})
        for i, edge in enumerate(m['edges']):
            record('flow-edge',m['id']+':'+str(i),edge['a'] in node_ids and edge['b'] in node_ids)
    sysids={n['id'] for n in T['system']['nodes']}
    for n in T['system']['nodes']:
        for src in n.get('sources',[]):record('system-source',n['id']+':'+src,src in ev)
    for i,e in enumerate(T['system']['edges']):record('system-edge',str(i),e['a'] in sysids and e['b'] in sysids)
    for q in T['system']['normal']:record('system-normal',q,q in sysids)
    for q, nodes in T['system']['stage_to_nodes'].items():
        for n in nodes:record('system-map',q+':'+n,q in ev and n in sysids)
    record('system','atlas-node-copy', T['atlas']['graph_nodes']==T['system']['nodes'])
    record('metadata','annotation-total',T['annotation_info']['total_source_lines']==sum(map(len,rows.values())))
    count=collections.Counter(a['kind'] for aa in T['annotations'].values() for a in aa)
    record('metadata','annotation-kinds',dict(count)==T['annotation_info']['kinds'])
    controls=json.loads((Path(__file__).parent/'control-checks.json').read_text())
    report['control_review']=[]
    compact=lambda s:re.sub(r'\s+','',s)
    for spec in controls:
        text=compact(snippet(spec,True));good=True;offset=0
        for term in spec.get('present',[]):good &= compact(term) in text
        for term in spec.get('absent',[]):good &= compact(term) not in text
        for term in spec.get('ordered',[]):
            pos=text.find(compact(term),offset)
            good &= pos>=0
            if pos>=0:offset=pos+len(compact(term))
        record('control-claim',spec['id'],good,spec['finding'])
        report['control_review'].append({**spec,'pass':bool(good)})
    macro_text=lexical(T['source']['StdAfx.h'])
    macro_values={m[1]:int(m[2],0) for m in re.finditer(r'^\s*#define\s+(\w+)\s+(0x[0-9a-fA-F]+|\d+)\s*$',macro_text,re.M)}
    expected={'_ECAT_00':0,'_ECAT_01':1,'_PM2Q_00':2,'_PM2Q_01':3,'_NX_ID':0,'_NX_OD':1,'_3G3MX_INV1':2,'_3G3MX_INV2':3,
        '_PM2Q_SUCTION_SOL':0,'_ECAT_SUCTION_SOL':1,'_PM2Q_CYLINDER_DOWN_SOL':2,'_PM2Q_CYLINDER_UP_SOL':3,'_ECAT_CYLINDER_DOWN_SOL':4,'_ECAT_CYLINDER_UP_SOL':5,
        '_START_SWITCH':0,'_STOP_SWITCH':1,'_RESET_SWITCH':2,'_ECAT_CYLINDER_UP':4,'_ECAT_CYLINDER_DOWN':5,'_PM2Q_CYLINDER_UP':6,'_PM2Q_CYLINDER_DOWN':7,
        '_ECAT_PRESSURE_SENSOR':8,'_PM2Q_PRESSURE_SENSOR':9,'_ECAT_OBJECT_00_DETECT':10,'_PM2Q_OBJECT_00_DETECT':11,'_ECAT_OBJECT_01_DETECT':12,'_PM2Q_OBJECT_01_DETECT':13}
    report['io_axis_macros']=[]
    for name,value in expected.items():
        good=macro_values.get(name)==value;record('io-axis',name,good,str(value));report['io_axis_macros'].append({'name':name,'value':value,'pass':good})
    report['inverter_words']=[]
    for name,upper,word in [('auto1',-511,0xFE01000F),('auto2',511,0x01FF000F),('manual_cw',1023,0x03FF000F),('manual_ccw',-1023,0xFC01000F)]:
        actual=(((upper&0xFFFFFFFF)<<16)|15)&0xFFFFFFFF;record('inverter-pack',name,actual==word,hex(actual))
        report['inverter_words'].append({'mode':name,'upper_int16':upper,'lower':15,'dword':f'0x{actual:08X}'})
    report['additional_inputs']=[]
    if partsdir and original_blocks:
        parts=sorted(Path(partsdir).glob('DemoKit_PART_*(1).txt'))
        all_lines=[]
        for p in parts:
            blob=p.read_bytes();all_lines.extend(blob.decode('utf-8-sig').splitlines())
            report['additional_inputs'].append({'name':p.name,'bytes':len(blob),'sha256':digest(blob)})
        markers=[i for i,s in enumerate(all_lines) if s.startswith('FILE: ')]
        records={}
        for n,i in enumerate(markers):
            f=re.split(r'[\\/]',all_lines[i][6:])[-1];end=markers[n+1]-1 if n+1<len(markers) else len(all_lines)
            records[f]='\n'.join(all_lines[i+2:end]).rstrip('\n')
        record('parts','9-parts-count',len(parts)==9)
        record('parts','82-file-set',set(records)==set(original_blocks))
        for f,(_,block) in original_blocks.items():record('parts',f,records.get(f)=='\n'.join(block).rstrip('\n'))
    if mot:
        blob=Path(mot).read_bytes();report['additional_inputs'].append({'name':Path(mot).name,'bytes':len(blob),'sha256':digest(blob)})
        axes=[];axis=None
        for line in blob.decode('utf-8-sig').splitlines():
            match=re.match(r'\d+:([A-Z_]+)\.\s*=\s*(.+)',line)
            if not match:continue
            k,value=match.groups()
            if k=='AXIS_NO':axis={'AXIS_NO':int(value)};axes.append(axis)
            elif axis is not None:axis[k]=float(value) if '.' in value else int(value)
        record('mot','four-axes',len(axes)==4 and [x['AXIS_NO'] for x in axes]==[0,1,2,3])
        for i,axis in enumerate(axes):
            expected={'NEG_END_LIMIT':1 if i<2 else 0,'POS_END_LIMIT':1 if i<2 else 0,'ALARM':1 if i<2 else 0,
                      'SVON_LEVEL':0 if i<2 else 1,'ENCODER_TYPE':1 if i<2 else 0,'PULSE_OUT_METHOD':6 if i==3 else 4}
            for k,v in expected.items():record('mot',str(i)+':'+k,axis.get(k)==v,str(v))
        report['mot_axes']=axes
    stats=collections.defaultdict(lambda:{'total':0,'pass':0,'fail':0})
    for c in checks:
        s=stats[c['group']];s['total']+=1;s['pass' if c['pass'] else 'fail']+=1
    report['summary']=dict(stats)
    report['counts']={'source_files':len(rows),'source_lines':sum(map(len,rows.values())),
        'annotations':sum(len(a) for a in T['annotations'].values()),'meaningful_annotations':count['code']+count['declaration'],
        'charts':len(T['model']),'flow_nodes':len(report['flows']),'system_nodes':len(sysids),'system_edges':len(T['system']['edges']),
        'functions':len(T['functions']),'calls':len(T['calls']),'dictionary':len(ids)}
    # Full successful record list is retained for reproduction; no sampled-only results.
    return report


def indirect_location(T,e,r,clean):
    """Explicit message/thread mapping, not a same-name guessed call."""
    file,a,b=r['file'],r['start'],r['end']
    for c in T['calls']:
        if c['target']==e.get('qualified') and c['file']==file and a<=c['line']<=b and c['kind'] in ['메시지 전달','스레드 시작']:
            return True
    f=T['functions'].get(e.get('function') or e.get('qualified'),{})
    for binding in f.get('bindings',[]):
        if binding['file']==file and a<=binding['line']<=b:return True
    # MFC shorthand's name is conventionally encoded rather than written as a C++ token.
    macro={'OnDestroy':'ON_WM_DESTROY','OnTimer':'ON_WM_TIMER'}.get(e['name'])
    return bool(macro and any(macro in l for l in clean[file][a-1:b]))


def function_location(T,e,r,clean):
    text='\n'.join(clean[r['file']][r['start']-1:r['end']])
    name=e['name']
    if re.search(r'(?<![\w~])'+re.escape(name)+r'\s*\(',text):return True
    # Function pointers may be passed/selected without a call expression.
    if e['type']!='생성자' and re.search(r'(?<![\w~])'+re.escape(name)+r'(?!\w)',text):return True
    if indirect_location(T,e,r,clean):return True
    qualified=e.get('qualified','').split(' @ ')[0]
    return any(f['id'].split(' @ ')[0]==qualified and f['file']==r['file'] and f['start']<=r['start']<=r['end']<=f['end'] for f in T['dictionary']['function_ranges'])


if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--data',required=True);p.add_argument('--original');p.add_argument('--parts-dir');p.add_argument('--mot');p.add_argument('--out',required=True)
    a=p.parse_args();r=run(json.loads(Path(a.data).read_text()),a.original,a.parts_dir,a.mot)
    Path(a.out).write_text(json.dumps(r,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({'counts':r['counts'],'summary':r['summary'],'failed':[c for c in r['checks'] if not c['pass']][:35]},ensure_ascii=False,indent=1))
