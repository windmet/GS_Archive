"""Portable contracts for native Penlight named fields and color provenance."""
import copy
import importlib.util
from pathlib import Path

from live_chibi_penlight_commands import penlight_events

header=['type','time']+[f'value{i}' for i in range(1,18)]+['value101','value102']
def row(command,time,values):
    return [command,str(time)]+[str(values.get(i,'')) for i in range(1,18)]+[str(values.get(101,'')),str(values.get(102,''))]
normal=row('Penlight',200,{1:4,2:2,3:2,4:0,5:350,6:'#123456',7:-400,8:185,9:400,10:1500})
unit=row('Penlight_unit',-2000,{1:1,2:1,3:1,4:2,5:300,6:0,7:360,8:1000,9:2200,10:2,11:'#IdolColor1',12:'#00ff00'})
palette=row('Penlight_unit_color',200,{1:2,2:2,3:3,4:1,5:500,6:400,7:170,8:400,9:1500,10:1,11:'#ff0000&#00ff00&#0000ff'})
erase=row('Penlight',300,{1:4,2:2,3:'not parsed on erase',101:1,102:999})
rows=[header,normal,unit,palette,erase,row('#Penlight',0,{}),row('Penlight_future',0,{})]
before=copy.deepcopy(rows);events=penlight_events(rows)
assert rows==before
assert [e['sourceRow'] for e in events]==[3,2,4,5]
assert events[0]['x']==0 and events[0]['y']==360 and events[0]['scale']==1 and events[0]['depth']==2200
assert events[0]['speed']==.3 and events[0]['colors'][:2]==['#IdolColor1','#00ff00']
assert events[1]['x']==-400 and events[1]['scale']==.4 and events[1]['color']=='#123456'
assert events[1]['animationId']==0
assert events[2]['colors']==['#ff0000','#00ff00','#0000ff']
assert events[3]['erase'] and 'speed' not in events[3]  # Erase is ResetColor only.
short=[header[:17]+header[-2:],unit[:17]+unit[-2:]]
assert penlight_events(short)[0]['colors'][-2:]==['','']
reordered=[list(reversed(r)) for r in rows[:3]]
assert penlight_events(reordered)==penlight_events(rows[:3])
for replacement in ['NaN','inf','bad']:
    bad=copy.deepcopy(rows[:2]);bad[1][header.index('value5')]=replacement
    try:penlight_events(bad)
    except ValueError:pass
    else:raise AssertionError('Invalid Penlight speed accepted')
bad=copy.deepcopy(rows[:2]);bad[1][header.index('value101')]='2'
try:penlight_events(bad)
except ValueError:pass
else:raise AssertionError('Unknown erase switch accepted')
spec=importlib.util.spec_from_file_location('penlight_exporter',Path(__file__).with_name('prepare-live-chibi-penlight-commands.py'))
exporter=importlib.util.module_from_spec(spec);spec.loader.exec_module(exporter)
def varint(n):
    out=bytearray()
    while n>127:out.append((n&127)|128);n>>=7
    out.append(n);return bytes(out)
def text(n,s):
    b=s.encode();return varint(n*8+2)+varint(len(b))+b
def message(n,b):return varint(n*8+2)+varint(len(b))+b
idol=text(10,'001tom')+text(26,'#ff0000')+text(39,'#123456')+varint(16*8)+varint(42)
song=text(4,'test')+varint(13*8)+varint(4)
colors,types=exporter.penlight_masterdata(message(2,idol)+message(46,song))
assert colors=={'001tom':'#123456'} and types=={'test':4}
assert '42' not in str(colors)  # Only resource code / native color, no other idol data.
try:exporter.penlight_masterdata(message(2,idol+text(39,'#ffffff')))
except ValueError:pass
else:raise AssertionError('Ambiguous native color field accepted')
print('PASS Penlight RAW: normal/unit/color field layouts, short/reordered headers, erase, exact order, typed field39 color and field13 IdolType')
