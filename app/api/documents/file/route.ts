import {database} from '@/lib/quotes-db';
import {bucket,validId} from '@/lib/document-storage';
import {isResponse,requireApiUser} from '@/lib/api-auth';
export async function GET(request:Request){
 const user=await requireApiUser();if(isResponse(user))return user;
 const id=new URL(request.url).searchParams.get('id');if(!validId(id))return new Response('Geçersiz belge',{status:400});
 try{const d=await database().prepare('SELECT d.object_key,d.filename,d.mime FROM documents d JOIN quotes q ON q.id=d.quote_id WHERE d.id=? AND q.owner_id=?').bind(id,user.userId).first<{object_key:string;filename:string;mime:string}>();if(!d)return new Response('Belge bulunamadı',{status:404});const obj=await bucket().get(d.object_key);if(!obj)return new Response('Dosya bulunamadı',{status:404});
 return new Response(obj.body,{headers:{'Content-Type':d.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(d.filename),'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
 }catch{return new Response('Belge indirilemedi',{status:503})}
}
