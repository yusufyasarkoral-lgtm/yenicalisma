import {database} from '@/lib/quotes-db';
import {sameOrigin,readLimited} from '@/lib/document-storage';
import {branches,categories} from '@/lib/document-checks';
import {isResponse,requireApiUser} from '@/lib/api-auth';
export async function PUT(request:Request){
 const user=await requireApiUser();if(isResponse(user))return user;
 if(!sameOrigin(request))return Response.json({error:'Geçersiz kaynak'},{status:403});
 let q:any;try{q=JSON.parse(new TextDecoder().decode(await readLimited(request,4000)))}catch{return Response.json({error:'Geçersiz liste'},{status:400})}
 if(!branches.includes(q?.branch)||!Array.isArray(q.categories)||q.categories.length>categories.length||q.categories.some((c:unknown)=>!categories.includes(c as string)))return Response.json({error:'Geçersiz liste'},{status:400});
 try{await database().prepare('INSERT INTO document_rules(owner_id,branch,categories,updated_at) VALUES (?,?,?,?) ON CONFLICT(owner_id,branch) DO UPDATE SET categories=excluded.categories,updated_at=excluded.updated_at').bind(user.userId,q.branch,JSON.stringify([...new Set(q.categories)]),new Date().toISOString()).run();return Response.json({ok:true})}catch{return Response.json({error:'Liste kaydedilemedi'},{status:503})}
}
