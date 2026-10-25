"""Extract source ComboPanel sprites/layout/clip and the native timing unit."""
import argparse,hashlib,json,struct,zipfile,io
from pathlib import Path
import UnityPy
ROOT=Path(__file__).resolve().parents[1]
sha=lambda b:hashlib.sha256(b).hexdigest()
p=argparse.ArgumentParser();p.add_argument('--ipa',type=Path,required=True);p.add_argument('--elf',type=Path,required=True);a=p.parse_args()
b=a.elf.read_bytes();assert sha(b)=='9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
ph=struct.unpack_from('<Q',b,32)[0];s,c=struct.unpack_from('<HH',b,54);segs=[struct.unpack_from('<IIQQQQQQ',b,ph+i*s)for i in range(c)]
def read(addr,n):return next(b[o+addr-v:o+addr-v+n]for k,f,o,v,p,sz,mem,al in segs if k==1 and v<=addr<addr+n<=v+sz)
with zipfile.ZipFile(a.ipa)as z:data=z.read('Payload/BNEI0395.app/Data/data.unity3d')
assert sha(data)=='fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a'
e=UnityPy.load(data);o={x.path_id:x for x in e.objects if x.assets_file.name=='resources.assets'}
r=dict(schemaVersion=1,source=dict(elfSha256=sha(b),dataSha256=sha(data)),timing=dict(min=-30,max=30,stepMilliseconds=struct.unpack('<f',read(0x32cc6e4,4))[0],millisecondsToSeconds=struct.unpack('<d',read(0x32cc6c0,8))[0],clock='media-minus-delay',deviceCorrection='not-applied-in-Web'),layout={},sprites={})
for name,pid in dict(panel=93940,content=103145,base=101559,label=97840,digit=91101,underline=93152).items():
 r['layout'][name]=dict(pathId=pid,sha256=sha(o[pid].get_raw_data()),rect=o[pid].read_typetree())
grid=o[120341].get_raw_data();assert len(grid)==84
digit_image=o[125674].get_raw_data()
assert len(digit_image)==152 and struct.unpack_from('<iq',digit_image,88)==(0,1674)
r['layout']['digitImage']=dict(pathId=125674,sha256=sha(digit_image),imageType=struct.unpack_from('<i',digit_image,100)[0],preserveAspect=bool(digit_image[104]))
r['layout']['grid']=dict(pathId=120341,sha256=sha(grid),childAlignment=struct.unpack_from('<i',grid,48)[0],startCorner=struct.unpack_from('<i',grid,52)[0],cellWidth=struct.unpack_from('<f',grid,60)[0],cellHeight=struct.unpack_from('<f',grid,64)[0])
clip=o[1078].read_typetree();r['animation']=dict(pathId=1078,sha256=sha(o[1078].get_raw_data()),name=clip['m_Name'],sampleRate=clip['m_SampleRate'],scale=clip['m_ScaleCurves'][0],minCount=2,maxCount=9999,gateFrames=3)
for obj in o.values():
 if obj.type.name!='Sprite':continue
 sprite=obj.read();name=sprite.m_Name
 if not(name.startswith('live_number_combo_')or name in ['live_combo_text','element_live_combo_underline']):continue
 image=sprite.image;buf=io.BytesIO();image.save(buf,format='PNG');png=buf.getvalue();url='/assets/song-chart-combo/'+name+'.png';dst=ROOT/'public'/url.lstrip('/');dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(png)
 r['sprites'][name]=dict(pathId=obj.path_id,sourceSha256=sha(obj.get_raw_data()),url=url,width=image.width,height=image.height,sha256=sha(png),bytes=len(png))
assert len(r['sprites'])==12
(ROOT/'config/song-combo-timing.v1.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('12 native sprites, ComboNormal clip, layout and 60Hz timing setting extracted')
