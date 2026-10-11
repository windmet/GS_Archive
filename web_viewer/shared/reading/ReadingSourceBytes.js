// Legacy Reader snapshots can bind a Windows CRLF compiled source while the
// publication contract ships LF. Keep exact bytes first, with only EOL variants;
// never canonicalize JSON values, key order, other spaces or published receipts.
export function readingSourceByteVariants(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const text = new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  const lf = text.replace(/\r\n/g,'\n')
  const crlf = lf.replace(/\n/g,'\r\n')
  return [bytes,...[lf,crlf].filter((value,index,array)=>value!==text&&array.indexOf(value)===index).map(value=>new TextEncoder().encode(value))]
}
