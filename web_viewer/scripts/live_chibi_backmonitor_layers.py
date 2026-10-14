"""Export bound native Back/Noise/Grow sprites and global renderer orders."""
import hashlib

def extract_backmonitor_layers(environment, output_root):
    objects = {o.path_id:o for o in environment.objects if o.assets_file.name=='resources.assets'}
    stage_orders = {suffix:objects[pid].read().m_SortingOrder
                    for suffix,pid in [('01',55171),('02',54555),('03',54946)]}
    if stage_orders != {'01':1100,'02':1300,'03':1500}:
        raise ValueError('Changed native stage sorting template')
    assets, layers = {}, []
    for role,pid,sprite_id,shader_name,offset,blend in [
        ('back',56739,1734,'Sprites/Default',-5,'normal'),
        ('noise',55366,2121,'Mobile/Particles/Multiply',5,'multiply'),
        ('glow',55251,2648,'Mobile/Particles/Additive',110,'add'),
    ]:
        renderer = objects[pid].read()
        if renderer.m_Sprite.path_id != sprite_id:
            raise ValueError('Changed backmonitor sprite binding: '+role)
        sprite_object = renderer.m_Sprite.deref()
        sprite = sprite_object.read()
        material = renderer.m_Materials[0].deref()
        shader_object = material.read().m_Shader.deref()
        form=shader_object.read_typetree()['m_ParsedForm']
        shader = form['m_Name']
        state=form['m_SubShaders'][0]['m_Passes'][0]['m_State']['rtBlend0']
        factors=[state[k]['val'] for k in ['srcBlend','destBlend','srcBlendAlpha','destBlendAlpha']]
        if factors != {'back':[1,10,1,10],'noise':[0,3,0,3],'glow':[5,1,5,1]}[role]:
            raise ValueError('Changed backmonitor blend factors: '+role)
        if shader != shader_name or sprite.m_PixelsToUnits != 100:
            raise ValueError('Changed backmonitor material/units: '+role)
        go = renderer.m_GameObject.deref().read()
        transform = next(c.component.deref().read() for c in go.m_Component
                         if c.component.deref().type.name in ['Transform','RectTransform'])
        asset = 'native_backmonitor_'+role
        target = output_root / (asset+'.png')
        image = sprite.image.convert('RGBA')
        image.save(target,format='PNG',optimize=True)
        assets[asset] = dict(file='stage-effects/'+target.name,width=image.width,height=image.height,
                            pngSha256=hashlib.sha256(target.read_bytes()).hexdigest(),source=dict(
                            serializedFile='resources.assets',pathId=str(sprite.m_RD.texture.path_id),
                            spritePathId=str(sprite_id),rendererPathId=str(pid),shader=shader,
                            shaderSha256=hashlib.sha256(shader_object.get_raw_data()).hexdigest(),blendFactors=factors))
        offset_px = sprite.m_RD.textureRectOffset
        anchor_x = (sprite.m_Rect.width*sprite.m_Pivot.x-offset_px.x)/image.width
        anchor_y = 1-(sprite.m_Rect.height*sprite.m_Pivot.y-offset_px.y)/image.height
        layers.append(dict(role=role,asset=asset,x=transform.m_LocalPosition.x,y=transform.m_LocalPosition.y,
                           scaleX=transform.m_LocalScale.x,scaleY=transform.m_LocalScale.y,
                           anchorX=anchor_x,anchorY=anchor_y,
                           alpha=renderer.m_Color.a,sortingOffset=offset,blend=blend))
    return dict(status='native_backmonitor_renderer_layers',stageOrders=stage_orders,layers=layers),assets
