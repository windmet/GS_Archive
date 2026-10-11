"""Decode native ASTC HDR sprites with Arm's HDR decoder, retaining Sprite UVs.

UnityPy's LDR ASTC path returns magenta error blocks for these HDR endpoints.
The optional external CLI is used only for formats 66..71; all other formats
continue through UnityPy. No color replacement or generated artwork is used.
"""
import subprocess
import tempfile
from pathlib import Path
from PIL import Image

def sprite_image(sprite, astcenc=None):
    from UnityPy.export import Texture2DConverter as converter
    from UnityPy.enums import TextureFormat
    texture=sprite.m_RD.texture.read()
    fmt=int(texture.m_TextureFormat)
    if fmt not in range(66,72):return sprite.image
    if not astcenc or not Path(astcenc).is_file():
        raise ValueError('ASTC HDR sprite requires --astcenc pointing to the official Arm decoder')
    block=(4,5,6,8,10,12)[fmt-66]
    def decode(data,width,height,*unused):
        header=bytes.fromhex('13aba15c')+bytes((block,block,1))+width.to_bytes(3,'little')+height.to_bytes(3,'little')+(1).to_bytes(3,'little')
        # Temporary native streams remain on the E: checkout, never RAW/public.
        scratch=Path(__file__).resolve().parents[1]/'.analysis/texture-decode'
        scratch.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as directory:
            source=Path(directory)/'native.astc';target=Path(directory)/'decoded.exr'
            source.write_bytes(header+data[:((width+block-1)//block)*((height+block-1)//block)*16])
            result=subprocess.run([str(Path(astcenc).resolve()),'-dh',str(source),str(target)],capture_output=True,text=True)
            if result.returncode:raise ValueError(f'Arm HDR decoder failed: {result.stdout} {result.stderr}')
            import OpenEXR
            import numpy as np
            with OpenEXR.File(str(target)) as image:
                channels=image.channels();pixels=channels['RGBA'].pixels if 'RGBA' in channels else channels['RGB'].pixels
                if pixels.shape[2]==3:pixels=np.concatenate((pixels,np.ones((*pixels.shape[:2],1))),axis=2)
                return Image.fromarray(np.rint(np.clip(pixels,0,1)*255).astype('uint8'),'RGBA')
    key=TextureFormat(fmt);previous=converter.CONV_TABLE[key]
    try:
        converter.CONV_TABLE[key]=(decode,())
        return sprite.image
    finally:
        converter.CONV_TABLE[key]=previous
