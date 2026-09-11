import {database} from '@/lib/quotes-db';
import {bucket,validId,sameOrigin,readLimited} from '@/lib/document-storage';
import {categories,checkDocument,checklist,detectMime} from '@/lib/document-checks';
const error=(message:string,status=400)=>Response.json({error:message},{status});
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('quoteId');if(!validId(id))return error('Geçersiz iş');
 try{const db=database();const quote=await db.prepare('SELECT * FROM quotes WHERE id=?').bind(id).first<any>();if(!quote)return error('İş bulunamadı',404);
 const {results}=await db.prepare('SELECT id,quote_id,filename,mime,size,category,source,source_message_id,extracted_text,read_status,read_note,review_status,created_at FROM documents WHERE quote_id=? ORDER BY created_at DESC').bind(id).all<any>();
 const rule=await db.prepare('SELECT categories FROM document_rules WHERE branch=?').bind(quote.branch).first<{categories:string}>();const required=rule?JSON.parse(rule.categories):[];
 return Response.json({documents:results.map(d=>({...d,findings:checkDocument(d,quote)})),required,checklist:checklist(required,results),rulesConfigured:!!rule,branch:quote.branch},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Documents load',e);return error('Evraklar yüklenemedi. Yeniden deneyin.',503)}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak',403);
 let form:FormData;try{const bytes=await readLimited(request,11*1024*1024);form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')||''},body:bytes}).formData()}catch{return error('Dosya alınamadı. En fazla 10 MB yükleyebilirsiniz.',413)}
 const quoteId=form.get('quoteId'),file=form.get('file'),category=String(form.get('category')||'Diğer');
 const source=String(form.get('source')||'Yükleme'),sourceMessageId=String(form.get('sourceMessageId')||'');
 if(!validId(quoteId)||!(file instanceof File)||!categories.includes(category)||source.length>500||sourceMessageId.length>300)return error('Geçersiz belge bilgileri');
 if(!file.size||file.size>10*1024*1024)return error('Dosya boş veya 10 MB sınırını aşıyor',413);
 const bytes=new Uint8Array(await file.arrayBuffer());const mime=detectMime(bytes);if(!mime)return error('Yalnızca PDF, PNG, JPG ve WebP dosyaları destekleniyor.',415);
 try{const db=database();if(!await db.prepare('SELECT id FROM quotes WHERE id=?').bind(quoteId).first())return error('Önce teklif kaydını oluşturun.',404);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const existing=await db.prepare('SELECT id FROM documents WHERE quote_id=? AND content_hash=?').bind(quoteId,hash).first<{id:string}>();if(existing)return Response.json({id:existing.id,duplicate:true});
 const id=crypto.randomUUID(),key=quoteId+'/'+id;const filename=file.name.replace(/[\x00-\x1f/\\]/g,'_').slice(0,180)||'belge';
 await bucket().put(key,bytes,{httpMetadata:{contentType:mime}});
 try{const r=await db.prepare('INSERT INTO documents (id,quote_id,filename,mime,size,object_key,content_hash,category,source,source_message_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(quote_id,content_hash) DO NOTHING').bind(id,quoteId,filename,mime,file.size,key,hash,category,source,sourceMessageId,new Date().toISOString()).run();
 if(!r.meta.changes){await bucket().delete(key);const old=await db.prepare('SELECT id FROM documents WHERE quote_id=? AND content_hash=?').bind(quoteId,hash).first<{id:string}>();return Response.json({id:old?.id,duplicate:true})}
 }catch(e){await bucket().delete(key).catch(()=>{});throw e}
 return Response.json({id,duplicate:false},{status:201});
 }catch(e){console.error('Document upload',e);return error('Belge kaydedilemedi. Dosyanızı yeniden yükleyebilirsiniz.',503)}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak',403);
 let q:any;try{q=JSON.parse(new TextDecoder().decode(await readLimited(request,220000)))}catch{return error('Geçersiz kontrol bilgisi')}
 if(!validId(q?.id))return error('Geçersiz belge');
 try{const db=database();let result;
 if(q.action==='reading'){
 if(typeof q.text!=='string'||q.text.length>50000||!['read','partial','unreadable'].includes(q.status)||typeof q.note!=='string'||q.note.length>500)return error('Geçersiz okuma sonucu');
 const status=q.text.trim().length<20?'unreadable':q.status;
 result=await db.prepare("UPDATE documents SET extracted_text=?,read_status=?,read_note=?,review_status='pending' WHERE id=?").bind(q.text,status,q.note,q.id).run();
 }else if(q.action==='category'){
 if(!categories.includes(q.category))return error('Geçersiz evrak türü');result=await db.prepare("UPDATE documents SET category=?,review_status='pending' WHERE id=?").bind(q.category,q.id).run();
 }else if(q.action==='review'){
 if(!['pending','accepted','needs_attention'].includes(q.status))return error('Geçersiz kontrol durumu');result=await db.prepare('UPDATE documents SET review_status=? WHERE id=?').bind(q.status,q.id).run();
 }else return error('Geçersiz işlem');
 if(!result.meta.changes)return error('Belge bulunamadı',404);return Response.json({ok:true});
 }catch(e){console.error('Document update',e);return error('Kontrol kaydedilemedi',503)}
}
