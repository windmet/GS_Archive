"""Source gates for the two per-particle mask materials supported by Web."""

def native_mask_tree(obj):
    """Read typed RAW or the same ToJ.Mask layout stripped in APK resources."""
    import struct
    tree=obj.read_typetree(check_read=False)
    if '_isMaskingEnabled' in tree:return tree
    script=obj.read(check_read=False).m_Script.read()
    if (script.m_Namespace,script.m_ClassName)!=('ToJ','Mask'):
        raise ValueError('Unknown stripped native mask class')
    raw=obj.get_raw_data()
    if len(raw)!=84 or tree.get('m_Name') or struct.unpack_from('<i',raw,28)[0]!=0:
        raise ValueError('Unsupported stripped native mask layout')
    enabled,horiz,vert,border,alpha,file,path,tx,ty,ox,oy,count=struct.unpack_from('<IIIfIiqffffi',raw,32)
    if any(v not in (0,1) for v in [enabled,horiz,vert,alpha]) or count!=0:
        raise ValueError('Unsupported stripped native mask flags/storage')
    return {**tree,'_isMaskingEnabled':enabled,'_clampAlphaHorizontally':horiz,
        '_clampAlphaVertically':vert,'_clampingBorder':border,'_useMaskAlphaChannel':alpha,
        'mainTex':{'m_FileID':file,'m_PathID':path},'mainTexTiling':{'x':tx,'y':ty},
        'mainTexOffset':{'x':ox,'y':oy},'createdMatsStorage':[]}
def native_particle_texture_sampling(texture):
    settings=texture.m_TextureSettings
    if settings.m_FilterMode!=1 or settings.m_WrapU!=settings.m_WrapV or settings.m_WrapU not in [0,1]:
        raise ValueError('Unsupported native particle texture sampling')
    return dict(wrap=settings.m_WrapU,filter=settings.m_FilterMode,mipCount=texture.m_MipCount)

def require_native_particle_mask(material, allow_tint=False):
    name=material['shader']['name']
    additive=name=='Alpha Masked/Particles/Additive'
    if not additive and name!='Alpha Masked/Unlit Alpha Masked - World Coords':
        raise ValueError('Unsupported native particle mask shader')
    expected={'_Enabled':1,'_UseAlphaChannel':1,'_ClampHoriz':0,'_ClampVert':0,'_ScreenSpaceUI':0}
    if any(material['floats'].get(k)!=v for k,v in expected.items()):
        raise ValueError('Unsupported native particle mask flags')
    tint=material['colors'].get('_TintColor' if additive else '_Color')
    import math
    if not tint or set(tint)!={'r','g','b','a'} or any(not math.isfinite(v) or v<0 for v in tint.values()):
        raise ValueError('Unsupported native particle mask tint')
    # Older floor consumers do not carry material uniforms. Keep their gate strict.
    if not allow_tint and tint!={k:.5 if additive else 1 for k in ['r','g','b','a']}:
        raise ValueError('Unsupported native particle mask tint')
    if any(t['scale']!={'x':1,'y':1} or t['offset']!={'x':0,'y':0} for t in material['textures']):
        raise ValueError('Unsupported native particle mask texture transform')
    return [tint[k]*(2 if additive else 1) for k in ['r','g','b','a']]
