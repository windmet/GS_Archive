"""Read ObjectLayerRefKeeper RAW and the stripped APK ObjectLayer bindings."""
import struct

def object_keeper_tree(obj):
    tree=obj.read_typetree(check_read=False)
    if '_particles' in tree:return tree
    value=obj.read(check_read=False)
    script=value.m_Script.read()
    if script.m_ClassName not in ('LiveObjectObjectLayerRefKeeper','LiveObjectObjectLayer') or (script.m_Namespace,script.m_AssemblyName)!=('Growing.Live','Assembly-CSharp.dll'):
        raise ValueError(f'Unknown native Object_layer keeper: {(script.m_ClassName,script.m_Namespace,script.m_AssemblyName)}')
    raw=obj.get_raw_data()
    # Unity MonoBehaviour base fields occupy 32 bytes only for an empty name.
    if len(raw)<48 or tree.get('m_Name') or struct.unpack_from('<i',raw,28)[0]!=0:
        raise ValueError('Unsupported named stripped keeper')
    offset=32
    for field in ['_particles','_sprites','_groups']:
        if offset+4>len(raw):raise ValueError('Truncated stripped keeper list')
        count=struct.unpack_from('<i',raw,offset)[0];offset+=4
        if count<0 or count>10000 or offset+count*12>len(raw):raise ValueError('Malformed stripped keeper list')
        values=[]
        for _ in range(count):
            file,path=struct.unpack_from('<iq',raw,offset);offset+=12
            values.append(dict(m_FileID=file,m_PathID=path))
        tree[field]=values
    if offset+4!=len(raw) or raw[offset] not in (0,1) or any(raw[offset+1:]):
        raise ValueError('Unknown stripped keeper tail')
    tree['_keepOriginalOrder']=bool(raw[offset])
    return tree
