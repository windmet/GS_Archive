/** Decode the same Unity TextAsset wrapper used by the original ADV renderer. */
export function decodeUnitySpineSkeleton(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength<4) throw new TypeError('Truncated Spine skeleton');
  const view=new DataView(buffer),length=view.getUint32(0,true);
  if (!(length>0 && length<100)) return buffer;
  if (4+length>buffer.byteLength) throw new TypeError('Truncated Unity skeleton name');
  for(let i=0;i<length;i++)if(view.getUint8(4+i)<0x20 || view.getUint8(4+i)>0x7e)return buffer;
  const header=4+length+((4-(4+length)%4)%4)+4;
  if(header>=buffer.byteLength)throw new TypeError('Truncated Unity skeleton payload');
  return buffer.slice(header);
}
