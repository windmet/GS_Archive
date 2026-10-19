"""Bind all supported laser billboards to their native renderer/parent planes."""
from live_chibi_laser import require
import hashlib


def laser_geometry(fixtures):
    systems = {}
    for kind, fixture in fixtures.items():
        for prefab in fixture['prefabs']:
            for system in prefab['systems']:
                main, renderer = system['main'], system['renderer']
                require(main['moveWithTransform'] == main['scalingMode'] == 0
                        and renderer['renderMode'] == 0 and renderer['alignment'] == 2,
                        'Unbound laser simulation/scaling/alignment mode')
                gradient = system['modules']['ColorModule']['gradient']['maxGradient']
                require(all(gradient[f'key{i}'][k] == 1 for i in range(gradient['m_NumColorKeys'])
                            for k in ('r','g','b')), 'Colored laser lifetime gradient unsupported')
                chain = [{k:t[k] for k in ('position','rotation','scale')}
                         for t in reversed(system['transformChain'])]
                # Instantiate(prefab,parent) preserves rotation/scale; PlayEffect
                # explicitly overwrites only the instantiated root's position.
                chain[0] = {**chain[0], 'position': dict(x=0,y=0,z=0)}
                key = f"{system['serializedFile']}:{system['pathId']}"
                require(key not in systems, 'Duplicated native laser system')
                systems[key] = dict(parameterTreeSha256=system['parameterTreeSha256'],
                    style=prefab['style'],chain=chain,alignment=2,simulationSpace=0,scalingMode=0,
                    animationIndex=len(chain)-1 if kind=='turnlaser' else None)
    require(len(systems) == 60, 'Incomplete native laser billboard set')
    return dict(status='native_billboard_parent_planes_not_unity_solver_equivalence',systems=systems)


def laser_shader_receipt(environment):
    shader = next(o for o in environment.objects if o.assets_file.name=='resources.assets' and o.path_id==950)
    value = shader.read()
    source = value.export()
    state = shader.read_typetree()['m_ParsedForm']['m_SubShaders'][0]['m_Passes'][0]['m_State']
    blend = state['rtBlend0']
    require(value.m_ParsedForm.m_Name=='Mobile/Particles/Additive'
            and source.count('vs_COLOR0 = clamp(vs_COLOR0, 0.0, 1.0);')==3
            and source.count('SV_Target0 = u_xlat16_0 * vs_COLOR0;')==3,
            'Changed native mobile particle shader')
    require(blend['srcBlend']['val']==blend['srcBlendAlpha']['val']==5
            and blend['destBlend']['val']==blend['destBlendAlpha']['val']==1,
            'Changed native SrcAlpha/One blend')
    start = source.index('    vs_COLOR0 = in_COLOR0;')
    end = source.index('    vs_TEXCOORD0.xy',start)
    return dict(shaderPathId=950,shaderSha256=hashlib.sha256(shader.get_raw_data()).hexdigest(),
        exportedSourceSha256=hashlib.sha256(source.encode('utf8')).hexdigest(),
        vertexClamp=source[start:end],fragmentOutput='SV_Target0 = u_xlat16_0 * vs_COLOR0;',
        blend={k:blend[k]['val'] for k in ('srcBlend','destBlend','srcBlendAlpha','destBlendAlpha','blendOp','blendOpAlpha','colMask')})
