"""Read-only MasterData-first SSR audit; source linkage is not runtime acceptance."""
import argparse
import gc
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def payload(tree):
    data = tree['m_Script']
    return data.encode('utf-8', errors='surrogateescape') if isinstance(data, str) else bytes(data)


def atlas_pages(text):
    pages = []
    for block in text.strip().split('\n\n'):
        lines = block.strip().splitlines()
        if lines:
            pages.append(lines[0].strip())
    return pages


def inspect_bundle(path, load=None):
    if load is None:
        import UnityPy
        load = UnityPy.load
    env = load(str(path))
    objects = {obj.path_id: obj for obj in env.objects}
    trees = {}

    def tree(oid):
        if oid not in trees:
            trees[oid] = objects[oid].read_typetree()
        return trees[oid]

    def resolve(pointer, kind):
        if pointer.get('m_FileID', 0) != 0:
            raise ValueError('external reference requires separate resolution')
        oid = pointer.get('m_PathID', 0)
        if oid not in objects or objects[oid].type.name != kind:
            raise ValueError(f'unresolved {kind} reference: {oid}')
        return oid

    def classname(oid):
        return tree(resolve(tree(oid)['m_Script'], 'MonoScript')).get('m_ClassName')

    counts = Counter(obj.type.name for obj in objects.values())
    mono = [oid for oid, obj in objects.items() if obj.type.name == 'MonoBehaviour']
    chains, errors = [], []
    for oid in mono:
        try:
            if classname(oid) != 'SkeletonAnimation':
                continue
            owner = tree(oid)
            data_id = resolve(owner['skeletonDataAsset'], 'MonoBehaviour')
            if classname(data_id) != 'SkeletonDataAsset':
                raise ValueError('renderer does not point to SkeletonDataAsset')
            data = tree(data_id)
            skel_id = resolve(data['skeletonJSON'], 'TextAsset')
            skel = tree(skel_id)
            binary = payload(skel)
            if not binary:
                raise ValueError('empty skeleton')
            atlases = []
            for pointer in data['atlasAssets']:
                atlas_id = resolve(pointer, 'MonoBehaviour')
                if classname(atlas_id) != 'SpineAtlasAsset':
                    raise ValueError('unexpected atlas asset class')
                atlas = tree(atlas_id)
                text_id = resolve(atlas['atlasFile'], 'TextAsset')
                text = tree(text_id)
                atlas_bytes = payload(text)
                pages = atlas_pages(atlas_bytes.decode('utf-8').replace('\r\n', '\n'))
                textures = []
                for material in atlas['materials']:
                    mat_id = resolve(material, 'Material')
                    mat = tree(mat_id)
                    envs = dict(mat['m_SavedProperties']['m_TexEnvs'])
                    texture_id = resolve(envs['_MainTex']['m_Texture'], 'Texture2D')
                    texture = objects[texture_id].read()
                    encoded = texture.get_image_data()  # includes streamed .resS payloads
                    if texture.m_Width <= 0 or texture.m_Height <= 0 or not encoded:
                        raise ValueError('missing texture dimensions or bytes')
                    textures.append({'path_id': str(texture_id), 'material_path_id': str(mat_id),
                                     'name': texture.m_Name, 'width': texture.m_Width, 'height': texture.m_Height,
                                     'encoded_bytes': len(encoded), 'encoded_sha256': hashlib.sha256(encoded).hexdigest()})
                if not pages or len(pages) != len(textures) or [Path(p).stem for p in pages] != [t['name'] for t in textures]:
                    raise ValueError('atlas pages do not resolve in material order')
                atlases.append({'path_id': str(atlas_id), 'text_path_id': str(text_id), 'name': text['m_Name'],
                                'sha256': hashlib.sha256(atlas_bytes).hexdigest(), 'pages': pages, 'textures': textures})
            if not atlases:
                raise ValueError('no atlases')
            chains.append({'renderer_path_id': str(oid), 'data_path_id': str(data_id),
                           'skeleton': {'path_id': str(skel_id), 'name': skel['m_Name'], 'bytes': len(binary),
                                        'sha256': hashlib.sha256(binary).hexdigest()}, 'atlases': atlases})
        except Exception as error:
            errors.append({'path_id': str(oid), 'error': str(error)})
    names = [objects[oid].read().m_Name for oid in objects if objects[oid].type.name == 'Texture2D']
    return {'status': 'source-chain-verified' if chains and not errors else 'unresolved',
            'object_counts': dict(counts), 'chains': chains, 'errors': errors, 'texture_names': names}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--card-index', type=Path, required=True)
    parser.add_argument('--raw-root', type=Path, required=True)
    parser.add_argument('--dynamic-resources', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    cards = json.loads(args.card_index.read_text(encoding='utf-8'))['cards']
    groups = defaultdict(list)
    for card in cards:
        if card.get('rarity') == 'SSR':
            groups[card['resource_id']].append(card)
    inventory = json.loads(args.dynamic_resources.read_text(encoding='utf-8'))['cards']
    rows = {}
    for index, (rid, aliases) in enumerate(sorted(groups.items()), 1):
        bundle = args.raw_root / 'asset' / f'card_{rid}.unity3d'
        movie = args.raw_root / 'movie' / f'skill_movie_{rid}.usm'
        row = {'card_ids': sorted(card['card_id'] for card in aliases), 'dynamic_inventory': rid in inventory,
               'bundle': {'path': f'asset/{bundle.name}', 'exists': bundle.is_file()},
               'skill_movie': {'path': f'movie/{movie.name}', 'exists': movie.is_file()}}
        if movie.is_file():
            row['skill_movie'].update(bytes=movie.stat().st_size, sha256=digest(movie))
        if bundle.is_file():
            row['bundle'].update(bytes=bundle.stat().st_size, sha256=digest(bundle))
            try:
                row['dynamic'] = inspect_bundle(bundle)
                names = row['dynamic'].pop('texture_names')
                row['static_icon'] = {state: f'image_card_icon_{rid}{suffix}' in names
                                      for state, suffix in [('normal', ''), ('awakened', 'p')]}
            except Exception as error:
                row['dynamic'] = {'status': 'unresolved', 'error': str(error)}
        else:
            # No absence claim without a reverse scan of the supplied corpus.
            row['dynamic'] = {'status': 'unresolved', 'error': 'exact bundle missing; reverse scan required'}
        rows[rid] = row
        gc.collect()
        if index % 10 == 0:
            print(f'inspected {index}/{len(groups)}', flush=True)
    summary = {'masterdata_ssr_rows': sum(map(len, groups.values())), 'unique_ssr_resources': len(groups),
               'dynamic_inventory': len(inventory), 'authority_minus_inventory': sorted(set(groups) - set(inventory)),
               'inventory_minus_authority': sorted(set(inventory) - set(groups)),
               'dynamic_statuses': dict(Counter(row['dynamic']['status'] for row in rows.values())),
               'static_icons': {state: sum(row.get('static_icon', {}).get(state, False) for row in rows.values())
                                for state in ['normal', 'awakened']},
               'skill_movies': sum(row['skill_movie']['exists'] for row in rows.values())}
    report = {'schema_version': 1, 'scope': 'supplied-corpus-source-linkage-not-runtime-or-official-completeness',
              'inputs': {'card_index_sha256': digest(args.card_index), 'dynamic_resources_sha256': digest(args.dynamic_resources)},
              'summary': summary, 'cards': rows}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=True), flush=True)
    if any(row['dynamic']['status'] != 'source-chain-verified' for row in rows.values()):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
