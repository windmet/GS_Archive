"""Observed native Skeleton-Gradient contract, not a Web runtime color mapping."""
import hashlib
import math
import re


def program_digest(program):
    return hashlib.sha256(re.sub(r'\s+', '', program).encode()).hexdigest()


def resolve_pointer(owner, pointer, target):
    file_id = pointer['m_FileID']
    if type(file_id) is not int or file_id < 0:
        raise ValueError('Invalid material PPtr file id')
    if file_id == 0:
        file_name = owner['serializedFile']
    elif file_id <= len(owner['externals']):
        file_name = owner['externals'][file_id - 1].rsplit('/', 1)[-1]
    else:
        raise ValueError('Material PPtr external outside native list')
    if (file_name, str(pointer['m_PathID'])) != (target['serializedFile'], target['pathId']):
        raise ValueError('Material PPtr does not resolve to supplied object')


def validate_evidence(evidence):
    shader = evidence['shader']
    if shader['name'] != 'Growing/Skeleton-Gradient' or shader['pass'] != 'Normal':
        raise ValueError('Unsupported costume shader/pass')
    if shader['variant'] != 'gles3 hw_tier00 _BLEND_ALPHA':
        raise ValueError('Unsupported native shader variant')
    if shader['blend'] != dict(src=1, dst=10, srcAlpha=1, dstAlpha=10, op=0, opAlpha=0, mask=15):
        raise ValueError('Native premultiplied blend changed')
    # Exact compiled-source witnesses are pinned, not inferred from shader names.
    if (program_digest(shader['vertex']) != VERTEX_DIGEST
            or program_digest(shader['fragment']) != FRAGMENT_DIGEST):
        raise ValueError('Native shader formula changed; requires a new source audit')
    identities = set()
    for material in evidence['materials']:
        key = material['serializedFile'], material['pathId']
        if key in identities:
            raise ValueError('Duplicate material identity')
        identities.add(key)
        if material['name'] != 'cos_Material' or material['keywords'].split() != ['_BLEND_ALPHA', '_USE8NEIGHBOURHOOD_ON']:
            raise ValueError('Unsupported costume material')
        resolve_pointer(material, material['shaderPointer'], shader)
        resolve_pointer(material, material['texturePointer'], material['texture'])
        if material['texture']['name'] != 'cos':
            raise ValueError('Material is not bound to the live costume atlas')
        if material['textureScale'] != dict(x=1, y=1) or material['textureOffset'] != dict(x=0, y=0):
            raise ValueError('Unresolved costume UV transform')
        if material['blendMode'] != 0 or material['straightAlphaInput'] != 0:
            raise ValueError('Unresolved costume alpha mode')
        colors = material['serializedColors']
        if not {'_SrcColor', '_DstColor'} <= set(colors) <= {'_BodyColor', '_SrcColor', '_DstColor'}:
            raise ValueError('Missing native color defaults')
        for color in colors.values():
            rgba(color)
        for name in ('_BodyColor', '_SrcColor', '_DstColor'):
            rgba(shader['defaultColors'][name])
        if not math.isfinite(material['rcpHeightCutOff']):
            raise ValueError('Nonfinite native height multiplier')
    if not identities:
        raise ValueError('No bound live costume materials')
    return {'status': 'native_shader_binding_formula_not_runtime_uniforms_or_video_acceptance',
            'shader': {k: shader[k] for k in ('serializedFile', 'pathId', 'sha256', 'name')},
            'materials': len(identities), 'positionBasis': 'native_local_mesh_y',
            'mixing': 'premultiplied_color_replacement', 'textureAlphaPreserved': True}


def serialized_color_defaults(material, shader):
    """Return explicit material overrides and inherited shader defaults separately."""
    return {name: {'value': material['serializedColors'].get(name, value),
                   'origin': 'material' if name in material['serializedColors'] else 'shader_default'}
            for name, value in shader['defaultColors'].items()}


def rgba(value):
    if len(value) != 4 or any(not math.isfinite(x) or not 0 <= x <= 1 for x in value):
        raise ValueError('Expected finite normalized RGBA')
    return value


def shade_pixel(texture, vertex, local_y, rcp_height, body, src, dst):
    """CPU reference for the actual GLES3 Normal/ALPHA source, with explicit inputs.

    Requires premultiplied texture input. Serialized defaults must not be used as
    runtime uniforms: the native client changes their alpha/color values.
    """
    for value in (texture, vertex, body, src, dst):
        rgba(value)
    if any(c > texture[3] for c in texture[:3]):
        raise ValueError('Texture must be premultiplied')
    if not math.isfinite(local_y) or not math.isfinite(rcp_height):
        raise ValueError('Nonfinite native local height')
    t = min(1, max(0, local_y * rcp_height))
    gradient = [a + (b - a) * t for a, b in zip(src, dst)]
    alpha = texture[3]
    base = [texture[i] + (body[i] * alpha - texture[i]) * body[3] for i in range(3)]
    rgb = [base[i] + (gradient[i] * alpha - base[i]) * gradient[3] for i in range(3)]
    return [rgb[i] * vertex[i] for i in range(3)] + [alpha * vertex[3]]


# Set from the actual first GLES3 ALPHA subprogram, whitespace independent.
VERTEX_DIGEST = 'dccb46f1dd86692a5060880a3b45d45924cb7a96a78309e145629eacb68cd6a2'
FRAGMENT_DIGEST = 'e12ca1ff8be5ff5b546fe00b76373b74e6a4249c85aedc1df902be7d52654c9f'
