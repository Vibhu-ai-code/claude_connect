/** Crops a PNG to width x height from the top-left corner (store assets need exact dimensions). */
const fs=require('fs'),zlib=require('zlib');
function decode(file){const buf=fs.readFileSync(file);let p=8,idat=[],w,h,ct;
 while(p<buf.length){const len=buf.readUInt32BE(p),type=buf.toString('ascii',p+4,p+8),d=buf.subarray(p+8,p+8+len);
  if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);ct=d[9];}if(type==='IDAT')idat.push(d);p+=12+len;}
 const raw=zlib.inflateSync(Buffer.concat(idat)),bpp=ct===6?4:3,stride=w*bpp+1,out=Buffer.alloc(w*h*bpp);
 for(let y=0;y<h;y++){const f=raw[y*stride],line=raw.subarray(y*stride+1,y*stride+1+w*bpp);
  for(let x=0;x<w*bpp;x++){const a=x>=bpp?out[y*w*bpp+x-bpp]:0,b=y>0?out[(y-1)*w*bpp+x]:0,c=(x>=bpp&&y>0)?out[(y-1)*w*bpp+x-bpp]:0;let v=line[x];
   if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=Math.floor((a+b)/2);
   else if(f===4){const pa=Math.abs(b-c),pb=Math.abs(a-c),pc=Math.abs(a+b-2*c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);}
   out[y*w*bpp+x]=v&255;}}
 return {w,h,bpp,data:out};}
function crc32(b){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}
 let crc=0xFFFFFFFF;for(const x of b)crc=t[(crc^x)&255]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type,'ascii'),data]);
 const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([len,td,c]);}
function encode(w,h,rgba){const stride=w*4;const raw=Buffer.alloc((stride+1)*h);
 for(let y=0;y<h;y++){raw[y*(stride+1)]=0;rgba.copy(raw,y*(stride+1)+1,y*stride,(y+1)*stride);}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
const [src,dst,cw,ch]=process.argv.slice(2);const w2=+cw,h2=+(ch||cw);const img=decode(src);
const outBuf=Buffer.alloc(w2*h2*4);
for(let y=0;y<h2;y++)for(let x=0;x<w2;x++){const si=(y*img.w+x)*img.bpp,di=(y*w2+x)*4;
 outBuf[di]=img.data[si];outBuf[di+1]=img.data[si+1];outBuf[di+2]=img.data[si+2];outBuf[di+3]=img.bpp===4?img.data[si+3]:255;}
fs.writeFileSync(dst,encode(w2,h2,outBuf));console.log('wrote',dst,w2+'x'+h2);
