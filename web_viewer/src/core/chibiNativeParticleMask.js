const PLUGIN='chibiNativeParticleMask'
const registered=new WeakSet()

export function configureNativeParticleTexture(texture,sampling){
  const base=texture.baseTexture
  base.alphaMode=0 // NPM: preserve native straight RGBA filtering
  base.wrapMode=sampling.wrap===1?33071:10497 // Clamp / Repeat
  base.scaleMode=1
  base.mipmap=sampling.mipCount>1?1:0
  // Native bilinear selects one mip level; Pixi defaults to trilinear with mips.
  if(base.resource)base.resource.style=(renderer,source,uploaded)=> {
    const gl=renderer.gl,target=source.target
    if(uploaded.mipmap)gl.generateMipmap(target)
    gl.texParameteri(target,gl.TEXTURE_WRAP_S,uploaded.wrapMode)
    gl.texParameteri(target,gl.TEXTURE_WRAP_T,uploaded.wrapMode)
    gl.texParameteri(target,gl.TEXTURE_MAG_FILTER,gl.LINEAR)
    gl.texParameteri(target,gl.TEXTURE_MIN_FILTER,uploaded.mipmap?gl.LINEAR_MIPMAP_NEAREST:gl.LINEAR)
    return true
  }
}

// Supported RAW profiles all use alpha-channel masks, bilinear/clamp textures,
// identity texture ST, no horizontal/vertical clamp and no screen-space mode.
// Additive has 2 * _TintColor(.5); unlit has _Color(1): both preserve vertex RGBA.
export function registerNativeParticleMaskRenderer(PIXI) {
  if(registered.has(PIXI))return
  class MaskGeometry extends PIXI.BatchGeometry {
    constructor(...args){super(...args);this.addAttribute('aMaskCoord',this._buffer,2,false,PIXI.TYPES.FLOAT)}
  }
  class MaskBatch extends PIXI.BatchRenderer {
    constructor(renderer){super(renderer);this.geometryClass=MaskGeometry;this.vertexSize=8;this.maskContext=null}
    setShaderGenerator(){
      this.shaderGenerator=new PIXI.BatchShaderGenerator(`
        attribute vec2 aVertexPosition;
        attribute vec2 aTextureCoord;
        attribute vec4 aColor;
        attribute float aTextureId;
        attribute vec2 aMaskCoord;
        uniform mat3 projectionMatrix;
        uniform mat3 translationMatrix;
        varying vec2 vTextureCoord;
        varying vec2 vMaskCoord;
        varying vec4 vColor;
        varying float vTextureId;
        void main(){
          gl_Position=vec4((projectionMatrix*translationMatrix*vec3(aVertexPosition,1.0)).xy,0.0,1.0);
          vTextureCoord=aTextureCoord;vMaskCoord=aMaskCoord;vColor=aColor;vTextureId=aTextureId;
        }`, `
        varying vec2 vTextureCoord;
        varying vec2 vMaskCoord;
        varying vec4 vColor;
        varying float vTextureId;
        uniform sampler2D uSamplers[%count%];
        uniform sampler2D uMask;
        void main(){
          vec4 color;
          %forloop%
          // Floor owns NPM texture bases, matching native straight RGBA filtering.
          color*=vColor;
          color.a=clamp(color.a,0.0,1.0)*texture2D(uMask,vMaskCoord).a;
          gl_FragColor=color;
        }`)
    }
    contextChange(){
      // Reserve unit 1 for the mask. Keep all same-texture particles batched.
      this.maxTextures=1
      this._shader=this.shaderGenerator.generateShader(1)
      this._shader.uniforms.uMask=1
      for(let i=0;i<this._packedGeometryPoolSize;i++)this._packedGeometries[i]=new this.geometryClass()
      this.initFlushBuffers()
      const modes=this.renderer.state.blendModes,gl=this.renderer.gl
      this.nativeModes ||= {add:modes.length,normal:modes.length+1}
      modes[this.nativeModes.add]=[gl.SRC_ALPHA,gl.ONE]
      modes[this.nativeModes.normal]=[gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA]
    }
    render(element){
      if(this.maskContext!==element.nativeParticleMask){this.flush();this.maskContext=element.nativeParticleMask}
      super.render(element)
    }
    onPrerender(){super.onPrerender();if(!this._vertexCount)this.maskContext=null}
    destroy(){this.maskContext=null;super.destroy()}
    flush(){
      if(this._vertexCount){
        this.renderer.texture.bind(this.maskContext.sprite.texture.baseTexture,1)
        this.renderer.shader.bind(this._shader)
      }
      super.flush()
    }
    drawBatches(){
      const calls=PIXI.BatchRenderer._drawCallPool,{gl}=this.renderer
      let textures=null
      for(let i=0;i<this._dcIndex;i++){
        const call=calls[i]
        if(textures!==call.texArray){textures=call.texArray;this.bindAndClearTexArray(textures)}
        this.state.blendMode=this.nativeModes[this.maskContext.kind]
        this.renderer.state.set(this.state)
        gl.drawElements(call.type,call.size,gl.UNSIGNED_SHORT,call.start*2)
      }
    }
    packInterleavedGeometry(element,buffer,indices,a,i){
      const packed=a/this.vertexSize,{float32View:f,uint32View:u}=buffer
      const vertices=element.vertexData,uv=element.uvs,tex=element._texture.baseTexture
      const color=PIXI.Color.shared.setValue(element._tintRGB).toPremultiplied(Math.min(element.worldAlpha,1),false)
      const mask=element.nativeParticleMask.sprite,m=mask.worldTransform,det=m.a*m.d-m.b*m.c
      const w=mask.texture.orig.width,h=mask.texture.orig.height
      for(let v=0;v<vertices.length;v+=2){
        const x=vertices[v],y=vertices[v+1],dx=x-m.tx,dy=y-m.ty
        f[a++]=x;f[a++]=y;f[a++]=uv[v];f[a++]=uv[v+1];u[a++]=color;f[a++]=tex._batchLocation
        f[a++]=(m.d*dx-m.c*dy)/det/w+mask.anchor.x
        f[a++]=(-m.b*dx+m.a*dy)/det/h+mask.anchor.y
      }
      for(const index of element.indices)indices[i++]=packed+index
    }
  }
  MaskBatch.extension={name:PLUGIN,type:PIXI.ExtensionType.RendererPlugin}
  PIXI.extensions.add(MaskBatch);registered.add(PIXI)
}

export function bindNativeParticleMask(sprite,context){
  sprite.pluginName=PLUGIN
  sprite.nativeParticleMask=context
}
