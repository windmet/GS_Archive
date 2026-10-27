import json,hashlib,zipfile,subprocess,tempfile,argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--ipa',type=Path,required=True);p.add_argument('--ffmpeg',required=True);a=p.parse_args();root=Path(__file__).resolve().parents[1];sha=lambda b:hashlib.sha256(b).hexdigest()
sets={f'se{i}':dict(perfect=f'rhy_tap_t0{i}',good=f'rhy_tap_great_good_t0{i}',flick=f'app_flick_t0{i}',pskill='rhy_pskill')for i in range(1,4)}
sets['president']=dict(perfect='_8wtdoh',good='_om2fby',flick='_sidrgf',pskill='_8bbk33')
assets={};out=root/'public/assets/song-chart-sounds';out.mkdir(parents=True,exist_ok=True)
previous=json.loads((root/'config/song-chart-sounds.v1.json').read_bytes())['assets']
with zipfile.ZipFile(a.ipa)as z:
 for name in sorted({n for s in sets.values()for n in s.values()}|{'air_tap_t01'}):
  entry='Payload/BNEI0395.app/Data/Raw/SE/'+name+'.wav';data=z.read(entry)
  assert sha(data)==previous[name]['sourceSha256'], 'Different source WAV: '+name
  with tempfile.TemporaryDirectory(dir=root/'.analysis')as d:
   src=Path(d)/'source.wav';src.write_bytes(data);target=out/(name+'.ogg')
   subprocess.run([a.ffmpeg,'-v','error','-y','-i',str(src),'-map_metadata','-1','-c:a','libvorbis','-q:a','5',str(target)],check=True)
  assets[name]=dict(url='/assets/song-chart-sounds/'+name+'.ogg',source=entry,sourceSha256=sha(data),sha256=sha(target.read_bytes()),bytes=target.stat().st_size)
(root/'config/song-chart-sounds.v1.json').write_text(json.dumps(dict(schemaVersion=1,sets=sets,assets=assets,policy='All four sets selectable for every song. Explicit Web adaptation; shared skill/hold/Special ACB cues are separate.'),ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(len(assets),'assets',sum(x['bytes']for x in assets.values()),'bytes')
