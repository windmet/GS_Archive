"""A2 provenance and isolation contracts. Does not assert product layout quality."""
from pathlib import Path
import json,hashlib,subprocess
base=Path(__file__).resolve().parents[1];folder=base/'scripts/fixtures/responsive';manifest=json.loads((folder/'extremes.json').read_text(encoding='utf-8'));release=json.loads((base/'readmodels/bootstrap.inline.json').read_text(encoding='utf-8'))['release'];assert manifest['release']==release
cache={};count=0
def pointer(v,p):
 for k in p.split('/')[1:]:
  k=k.replace('~1','/').replace('~0','~');v=v[int(k)] if isinstance(v,list) else v[k]
 return v
def check(ref):
 global count
 p=Path(ref['source']);p=p if p.is_absolute() else Path(manifest['candidate'])/'pages'/p
 key=str(p)
 if key not in cache:
  raw=p.read_bytes();cache[key]=(json.loads(raw.decode('utf-8')),hashlib.sha256(raw).hexdigest())
 doc,digest=cache[key];assert digest==ref['sourceSha256'],key;assert pointer(doc,ref['jsonPointer'])==ref['originalValue'],key+ref['jsonPointer'];assert ref['release']==release;count+=1
for p in folder.glob('*.json'):
 d=json.loads(p.read_text(encoding='utf-8'))
 def walk(v):
  if isinstance(v,dict):
   if all(k in v for k in ['source','jsonPointer','sourceSha256','originalValue','release']):check(v)
   for x in v.values():walk(x)
  elif isinstance(v,list):
   for x in v:walk(x)
 walk(d)
for rel,digest in manifest['inputHashes'].items():assert hashlib.sha256((Path(manifest['candidate'])/'pages'/rel).read_bytes()).hexdigest()==digest
# QA modules may import real components. Production source must never import QA or fixture modules.
for root in [base/'src',base/'readmodels/runtime']:
 for p in root.rglob('*'):
  if p.suffix in ['.vue','.js','.mjs','.ts','.css']:
   s=p.read_text(encoding='utf-8');assert 'scripts/fixtures/responsive/' not in s and 'scripts/qa/responsive-' not in s,p
for p in (base/'scripts/qa').glob('responsive-*.mjs'):assert 'import.meta.env.DEV' in p.read_text(encoding='utf-8'),p
# Schema safety of SYNTHETIC compositions uses the real validator separately through Node.
subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import {validateStudioDocument} from './src/core/StudioDocument.mjs';const x=JSON.parse(fs.readFileSync('scripts/fixtures/responsive/tools.json'));for(const k of ['normal','one','empty','worst','dense'])validateStudioDocument(x.studio[k]);console.log('5 schema compositions valid');"],cwd=base,check=True)
print(f'A2 contracts OK: {count} exact JSON-pointer references; {len(cache)} referenced files; {len(manifest["inputHashes"])} candidate hashes; production import isolation. NOT a product PASS.')
