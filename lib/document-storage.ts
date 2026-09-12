import {env} from 'cloudflare:workers';
export function bucket(){const b=(env as unknown as {BUCKET?:R2Bucket}).BUCKET;if(!b)throw Error('Belge deposu kullanılamıyor');return b;}
export const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
export function sameOrigin(r:Request){const o=r.headers.get('origin');return o===new URL(r.url).origin;}
export async function readLimited(request:Request,max:number){
 if(Number(request.headers.get('content-length'))>max)throw Error('Dosya boyutu sınırı aşıldı');
 const reader=request.body?.getReader();if(!reader)throw Error('Boş istek');const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Dosya boyutu sınırı aşıldı')}chunks.push(value)}}finally{reader.releaseLock()}
 const result=new Uint8Array(size);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length}return result;
}
