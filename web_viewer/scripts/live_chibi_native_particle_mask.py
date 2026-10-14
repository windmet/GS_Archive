"""Source gates for the two per-particle mask materials supported by Web."""
def native_particle_texture_sampling(texture):
    settings=texture.m_TextureSettings
    if settings.m_FilterMode!=1 or settings.m_WrapU!=settings.m_WrapV or settings.m_WrapU not in [0,1]:
        raise ValueError('Unsupported native particle texture sampling')
    return dict(wrap=settings.m_WrapU,filter=settings.m_FilterMode,mipCount=texture.m_MipCount)

def require_native_particle_mask(material):
    name=material['shader']['name']
    additive=name=='Alpha Masked/Particles/Additive'
    if not additive and name!='Alpha Masked/Unlit Alpha Masked - World Coords':
        raise ValueError('Unsupported native particle mask shader')
    expected={'_Enabled':1,'_UseAlphaChannel':1,'_ClampHoriz':0,'_ClampVert':0,'_ScreenSpaceUI':0}
    if any(material['floats'].get(k)!=v for k,v in expected.items()):
        raise ValueError('Unsupported native particle mask flags')
    tint=material['colors'].get('_TintColor' if additive else '_Color')
    if tint!={k:.5 if additive else 1 for k in ['r','g','b','a']}:
        raise ValueError('Unsupported native particle mask tint')
    if any(t['scale']!={'x':1,'y':1} or t['offset']!={'x':0,'y':0} for t in material['textures']):
        raise ValueError('Unsupported native particle mask texture transform')
