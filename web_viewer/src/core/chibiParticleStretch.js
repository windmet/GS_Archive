const f=Math.fround
const bits=new DataView(new ArrayBuffer(4))
// Positive normal float32 FRSQRTE, verified against the native solver opcode.
export function reciprocalSqrtEstimate(value) {
  bits.setFloat32(0,value,true)
  const n=bits.getUint32(0,true),exponent=(n>>>23&255)-127
  if(n>>>31 || exponent===-127 || exponent===128)throw Error('Unsupported FRSQRTE input')
  const bucket=(n&0x7fffff)>>>16
  const midpoint=(1+(bucket+.5)/128)*(exponent&1?2:1)
  return f(Math.round(512/Math.sqrt(midpoint))/512*2**(-Math.floor(exponent/2)))
}

export function transformStretchVelocity(matrix,velocity,cameraRotation=0) {
  const a=f(matrix.a),b=f(matrix.b),c=f(matrix.c),d=f(matrix.d),vx=f(velocity.x),vy=f(velocity.y)
  const cos=f(Math.cos(cameraRotation)),sin=f(Math.sin(cameraRotation))
  // Native builds Camera * emitter before multiplying velocity. Reassociating
  // these products can cross an FRSQRTE bucket even when the exact norm agrees.
  const A=f(f(cos*a)-f(sin*b)),C=f(f(cos*c)-f(sin*d))
  const B=f(f(sin*a)+f(cos*b)),D=f(f(sin*c)+f(cos*d))
  const x=f(f(A*vx)+f(C*vy)),y=f(f(B*vx)+f(D*vy))
  return {x:f(f(a*vx)+f(c*vy)),y:f(f(b*vx)+f(d*vy)),speedSquared:f(f(x*x)+f(y*y))}
}

// Classic, scalar-size planar stretch: native 0x817658 / 0x80b8a4.
// Matrices/velocities are already in the shared world plane. Camera speed,
// perspective, nonplanar velocities and moving-parent history are not admitted.
export function samplePlanarStretch({position,velocity,size,scaleX,scaleY,lengthScale,velocityScale,minSize=0,maxSize=1,viewHeight=10,cameraRotation=0}) {
  const vx=f(velocity.x),vy=f(velocity.y),speed2=velocity.speedSquared??f(f(vx*vx)+f(vy*vy))
  if(speed2<=1e-30)return Array.from({length:4},()=>({x:position.x,y:position.y}))
  const inverse=f(reciprocalSqrtEstimate(speed2)*f(1.0019569))
  const factor=f(f(velocityScale)+f(f(f(lengthScale*scaleX)*size)*inverse))
  const tx=f(position.x-f(vx*factor)),ty=f(position.y-f(vy*factor))
  const norm=Math.hypot(vx,vy)
  const diameter=Math.max(size,1e-6)
  const half=.5*Math.max(minSize*viewHeight/scaleX,Math.min(diameter,maxSize*viewHeight/scaleX))/diameter*size
  // Camera and inverse-camera bases cancel in the admitted XY plane. Particle
  // scale acts on the resulting world-axis side vector, independently of tail.
  const x=vy/norm*half*scaleX,y=-vx/norm*half*scaleY
  return [{x:position.x+x,y:position.y+y},{x:tx+x,y:ty+y},{x:tx-x,y:ty-y},{x:position.x-x,y:position.y-y}]
}

// Source-bound spatial path. Callers supply a native world-to-camera matrix;
// this is not a projection matrix or an inferred camera depth constant.
export function transformSpatialStretchVelocity(matrix,velocity,cameraMatrix,depthScale=1) {
  const a=f(matrix.a),b=f(matrix.b),c=f(matrix.c),d=f(matrix.d)
  const vx=f(velocity.x),vy=f(velocity.y),vz=f(velocity.z),m=cameraMatrix
  const A=f(f(m[0]*a)+f(m[4]*b)),C=f(f(m[0]*c)+f(m[4]*d))
  const B=f(f(m[1]*a)+f(m[5]*b)),D=f(f(m[1]*c)+f(m[5]*d))
  const x=f(f(A*vx)+f(C*vy)),y=f(f(B*vx)+f(D*vy)),z=f(f(m[10]*f(depthScale))*vz)
  return {x:f(f(a*vx)+f(c*vy)),y:f(f(b*vx)+f(d*vy)),z:f(f(depthScale)*vz),speedSquared:f(f(f(x*x)+f(y*y))+f(z*z))}
}

export function sampleSpatialStretch({position,velocity,size,scaleX,scaleY,lengthScale,velocityScale,
  cameraMatrix,minSize=0,maxSize=1,viewHeight=10}) {
  const m=cameraMatrix,det=m?.[0]*m?.[5]-m?.[4]*m?.[1]
  if(!m || m.length!==16 || m.some(x=>!Number.isFinite(x)) ||
    [2,3,6,7,8,9,11].some(i=>Math.abs(m[i])>1e-6) || Math.abs(m[15]-1)>1e-6 ||
    Math.abs(Math.abs(m[10])-1)>1e-5 || Math.abs(Math.abs(det)-1)>1e-5 ||
    Math.abs(m[0]*m[4]+m[1]*m[5])>1e-5 || Math.abs(m[0]*m[0]+m[1]*m[1]-1)>1e-5)
    throw Error('Spatial stretch needs a bound orthonormal XY camera view')
  if(!(size>0&&scaleX>0&&scaleY>0) || minSize!==0 || size*scaleX>maxSize*viewHeight)
    throw Error('Spatial stretch screen-size clamp is outside the proven profile')
  const vx=f(velocity.x),vy=f(velocity.y),vz=f(velocity.z),speed2=velocity.speedSquared??f(f(f(vx*vx)+f(vy*vy))+f(vz*vz))
  if(speed2<=1e-30)return Array.from({length:4},()=>({...position}))
  const camera={x:(-m[5]*m[12]+m[4]*m[13])/det,y:(m[1]*m[12]-m[0]*m[13])/det,z:-m[14]/m[10]}
  const rx=position.x-camera.x,ry=position.y-camera.y,rz=position.z-camera.z
  const crossX=ry*vz-rz*vy,crossY=rz*vx-rx*vz,norm=Math.hypot(crossX,crossY)
  if(norm<=1e-30)throw Error('Spatial stretch degenerate side is outside the proven profile')
  // Reflection in Unity's camera Z axis reverses the projected cross product.
  const hand=Math.sign(det*m[10]),x=hand*crossX/norm*size*.5*scaleX,y=hand*crossY/norm*size*.5*scaleY
  const inverse=f(reciprocalSqrtEstimate(speed2)*f(1.0019569))
  const factor=f(f(velocityScale)+f(f(f(lengthScale*scaleX)*size)*inverse))
  const tail={x:f(position.x-f(vx*factor)),y:f(position.y-f(vy*factor)),z:f(position.z-f(vz*factor))}
  return [{x:position.x+x,y:position.y+y,z:position.z},{x:tail.x+x,y:tail.y+y,z:tail.z},
    {x:tail.x-x,y:tail.y-y,z:tail.z},{x:position.x-x,y:position.y-y,z:position.z}]
}
