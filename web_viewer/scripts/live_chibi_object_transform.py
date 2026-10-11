"""Native quaternion hierarchy projected to the existing orthographic preview."""
import math

def local_matrix(transform) -> tuple[float, ...]:
    # Retain 3D through the hierarchy. Euler Z alone turns a native Y-axis
    # half-turn (horizontal reflection) into an upside-down 2D sprite.
    q = transform.m_LocalRotation
    x, y, z, w = (float(getattr(q, k)) for k in 'xyzw')
    norm = math.sqrt(x*x + y*y + z*z + w*w)
    if not math.isfinite(norm) or norm == 0:
        raise ValueError('Invalid object-layer quaternion')
    x, y, z, w = (v / norm for v in (x, y, z, w))
    sx, sy, sz = (float(getattr(transform.m_LocalScale, k)) for k in 'xyz')
    p = transform.m_LocalPosition
    return (
        (1-2*(y*y+z*z))*sx, 2*(x*y-z*w)*sy, 2*(x*z+y*w)*sz, float(p.x),
        2*(x*y+z*w)*sx, (1-2*(x*x+z*z))*sy, 2*(y*z-x*w)*sz, float(p.y),
        2*(x*z-y*w)*sx, 2*(y*z+x*w)*sy, (1-2*(x*x+y*y))*sz, float(p.z),
        0, 0, 0, 1,
    )


def relative_matrix(transform, root_path_id: int) -> tuple[float, ...]:
    chain = []
    current = transform
    while current is not None:
        go_path_id = current.m_GameObject.path_id
        if go_path_id == root_path_id:
            break
        chain.append(local_matrix(current))
        father = current.m_Father
        current = father.read() if father.path_id else None
    result = (1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
    for matrix in reversed(chain):
        result = tuple(sum(result[r*4+k]*matrix[k*4+c] for k in range(4))
                       for r in range(4) for c in range(4))
    # Orthographic XY preview; Unity camera perspective remains external.
    return (result[0], result[4], result[1], result[5], result[3], result[7])


def decompose(matrix: tuple[float, ...]) -> dict:
    a, b, c, d, tx, ty = matrix
    scale_x = math.hypot(a, b)
    determinant = a * d - b * c
    scale_y = determinant / scale_x if scale_x else math.hypot(c, d)
    rotation = math.degrees(math.atan2(b, a)) if scale_x else 0
    skew = rotation - math.degrees(math.atan2(-c / scale_y, d / scale_y)) if scale_y else 0
    return {
        "x": round(tx * 100, 4),
        "y": round(-ty * 100, 4),
        "scaleX": round(scale_x, 6),
        "scaleY": round(scale_y, 6),
        "rotation": round(-rotation, 4),
        "skewX": round(-skew, 4),
    }
