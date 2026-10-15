#!/usr/bin/env python3
"""Export small geometry corrections; do not rewrite shared media/index files."""
import argparse,json,importlib.util
from pathlib import Path
from live_chibi_sprite_geometry import sprite_geometry
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('geometry_audit',ROOT/'scripts/audit-live-chibi-stage-objects.py');audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
def main():
 import UnityPy
 parser=argparse.ArgumentParser();audit.add_sources_config_argument(parser);args=parser.parse_args();sources=audit.load_archive_sources(args.sources_config)
 index_path=ROOT/'public/assets/live-chibi/object-layers/index.json';before=audit.file_hash(index_path);index=json.loads(index_path.read_text(encoding='utf8'))
 grouped={}
 for name,entry in index['assets'].items():
  if entry.get('textures'):grouped.setdefault(entry['bundle'],[]).append((name,entry))
 assets={};bundles=[]
 for bundle,entries in sorted(grouped.items()):
  path=sources.raw_root/'asset'/bundle;bh=audit.file_hash(path);env=UnityPy.load(str(path));objects={o.path_id:o for o in env.objects if o.type.name=='Sprite'}
  for name,entry in entries:
   rows=[]
   for texture in entry['textures']:
    obj=objects[int(texture['id'])];sprite=obj.read();geometry=sprite_geometry(sprite,texture['width'],texture['height'])
    file=ROOT/'public/assets/live-chibi'/texture['file'];rows.append({'id':texture['id'],'file':texture['file'],'pngSha256':audit.file_hash(file),'spriteSha256':audit.file_hash_bytes(obj.get_raw_data()) if hasattr(audit,'file_hash_bytes') else __import__('hashlib').sha256(obj.get_raw_data()).hexdigest(),**geometry})
   assets[name]={'bundle':bundle,'textures':rows}
  if audit.file_hash(path)!=bh:raise ValueError('Changed RAW geometry bundle')
  bundles.append({'name':bundle,'sha256':bh})
 if audit.file_hash(index_path)!=before:raise ValueError('Changed object index')
 out=ROOT/'public/data/stage-object-sprite-geometry.json';out.write_text(json.dumps({'schemaVersion':1,'objectIndexSha256':before,'bundles':bundles,'assets':assets},separators=(',',':'),allow_nan=False)+'\n',encoding='utf8')
 print(json.dumps({'assets':len(assets),'sprites':sum(len(a['textures']) for a in assets.values()),'bundles':len(bundles),'bytes':out.stat().st_size}))
if __name__=='__main__':main()
