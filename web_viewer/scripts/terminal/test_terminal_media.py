import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image

spec = importlib.util.spec_from_file_location('builder',Path(__file__).with_name('build_terminal_media.py'))
m = importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class MediaTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.pub=self.root/'public';self.art=self.root/'cards'
        self.cards=[{'resource_id':'040ren_ssr03','rarity':'SSR','character_id':'040ren','title':'Test SSR','card_id':1},
                    {'resource_id':'040ren_sr01','rarity':'SR','character_id':'040ren','title':'Test SR','card_id':2}]
        flags={r:{'normal_portrait':True,'normal_landscape':True,'awakened_portrait':True,'awakened_landscape':True} for r in ['040ren_ssr03','040ren_sr01']}
        for r in flags:
            for suffix in ['', 'p']:
                self.img(self.art/f'image_card_portrait/image_card_portrait_hide_{r}{suffix}.png',(160,240))
                self.img(self.art/f'image_card_landscape/image_card_landscape_{r}{suffix}.png',(320,180))
        self.img(self.pub/'assets/bg/bg001_office.png',(320,180))
        self.img(self.pub/'assets/bg/bg002_alpha.png',(320,180),(20,40,60,128))
        self.write('data/masterdata/card_index.json',{'cards':self.cards})
        self.write('data/archive_manifest.json',{'card_assets_by_id':flags})
        self.write('data/masterdata/background_catalog.json',{'backgrounds':{'bg001_office':{'asset_exists':True,'names':['事務所'],'picture_studio_scenes':[{'variant':'通常'}]},'bg002_alpha':{'asset_exists':True,'names':['透明候補']}}})
        self.write('data/masterdata/idol_unit_dictionary.json',{'by_idol_code':{'040ren':{'display_name':'牙崎 漣'}}})
    def tearDown(self):self.tmp.cleanup()
    def write(self,path,data):
        f=self.pub/path;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(json.dumps(data),encoding='utf8')
    def img(self,path,size,color=(20,40,60,255)):
        path.parent.mkdir(parents=True,exist_ok=True);Image.new('RGBA',size,color).save(path)
    def test_only_ssr_same_variant_pairs_and_opaque_scenes(self):
        w,b,r,a=m.build(self.pub,self.art)
        self.assertEqual([e['id'] for e in w['entries']],['040ren_ssr03:base','040ren_ssr03:p'])
        self.assertEqual([e['id'] for e in b['entries']],['bg001_office'])
        self.assertTrue(any(x['reason']=='non-opaque-image' for x in r['rejected']))
        self.assertTrue(w['entries'][0]['portrait']['url'].endswith('040ren_ssr03.png'))
        self.assertTrue(w['entries'][0]['landscape']['url'].endswith('040ren_ssr03.png'))
        self.assertTrue(all(k.startswith('assets/terminal/') for k in a))
    def test_missing_wide_does_not_borrow_other_variant(self):
        (self.art/'image_card_landscape/image_card_landscape_040ren_ssr03.png').unlink()
        w,_,r,_=m.build(self.pub,self.art)
        self.assertEqual([e['id'] for e in w['entries']],['040ren_ssr03:p'])
    def test_derivatives_and_repeat_determinism(self):
        one=m.build(self.pub,self.art,derivatives=True);two=m.build(self.pub,self.art,derivatives=True)
        self.assertEqual(one,two)
        self.assertTrue(one[0]['entries'][0]['landscape']['url'].endswith('.webp'))
    def test_source_hash_changes(self):
        a=m.build(self.pub,self.art)[0]
        self.cards[0]['title']='changed';self.write('data/masterdata/card_index.json',{'cards':self.cards})
        b=m.build(self.pub,self.art)[0];self.assertNotEqual(a['sourceSignature'],b['sourceSignature'])
    def test_derivative_pixels_are_lossless(self):
        file=self.art/'image_card_landscape/image_card_landscape_040ren_ssr03.png'
        source=Image.new('RGBA',(320,180))
        pixels=[(x*7%256,y*11%256,x*y%256,0 if x%7==0 else 128 if y%3==0 else 255) for y in range(180) for x in range(320)]
        source.putdata(pixels)
        source.save(file)
        wallpapers,_,_,assets=m.build(self.pub,self.art,derivatives=True)
        key=wallpapers['entries'][0]['landscape']['url'].lstrip('/')
        with Image.open(io.BytesIO(assets[key])) as decoded:
            self.assertEqual(decoded.size,source.size)
            expected=Image.new('RGBA',source.size)
            expected.putdata([(0,0,0,0) if pixel[3]==0 else pixel for pixel in pixels])
            self.assertEqual(decoded.convert('RGBA').tobytes(),expected.tobytes())
    def test_budget_limit_explicit(self):
        w,_,r,_=m.build(self.pub,self.art,wallpaper_limit=1)
        self.assertEqual(len(w['entries']),1);self.assertTrue(any(x['reason']=='explicit-batch-limit' for x in r['rejected']))
    def test_wrong_orientation_rejected(self):
        self.img(self.art/'image_card_portrait/image_card_portrait_hide_040ren_ssr03.png',(240,160))
        w,_,r,_=m.build(self.pub,self.art);self.assertEqual(len(w['entries']),1)
    def test_no_input_rewrite(self):
        before={str(p):p.read_bytes() for p in self.root.rglob('*.png')}
        m.build(self.pub,self.art,derivatives=True)
        self.assertEqual(before,{str(p):p.read_bytes() for p in self.root.rglob('*.png')})
    def test_unsafe_path_rejected(self):
        with self.assertRaises(ValueError):m.inside(self.pub,'../escape.png')
    def test_thumbnail_content_addressed(self):
        _,_,_,assets=m.build(self.pub,self.art)
        for path,raw in assets.items():self.assertIn(m.digest(raw)[:16],path)
if __name__=='__main__':unittest.main(verbosity=2)
