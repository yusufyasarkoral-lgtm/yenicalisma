export const categories=['Teklif belgesi','Ruhsat','Kimlik belgesi','Başvuru formu','Mevcut poliçe','Diğer'];
export const branches=['Kasko','Trafik','Sağlık','Konut','İşyeri','Diğer'];
export type Finding={field:string;state:'match'|'mismatch'|'unknown';value:string;expected?:string};
const normalize=(s:string)=>s.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]/g,'');
export function checkDocument(doc:{extracted_text:string;read_status:string;category:string},quote:{customer:string;insurer:string;amount:number},now=new Date()):Finding[]{
 if(doc.read_status!=='read')return [{field:'Okuma',state:'unknown',value:doc.read_status==='partial'?'Belgenin yalnızca bir bölümü okundu.':'Belge okunamadı veya henüz okunmadı.'}];
 const text=doc.extracted_text;
 const pick=(r:RegExp)=>text.match(r)?.[1]?.trim()||'';
 const name=pick(/(?:Müşteri(?:\s*\/\s*Firma)?|Sigortalı(?:nın)?(?:\s*(?:Adı Soyadı|Adı|Unvanı))?|Firma(?:\s*Unvanı)?)\s*[:：]\s*([^\r\n]+)/iu);
 const out:Finding[]=[{field:'Müşteri',state:name?(normalize(name)===normalize(quote.customer)?'match':'mismatch'):'unknown',value:name||'Etiketli müşteri bilgisi bulunamadı.',expected:quote.customer}];
 if(doc.category==='Teklif belgesi'){
 const insurer=pick(/Sigorta\s*şirketi\s*[:：]\s*([^\r\n]+)/iu);
 out.push({field:'Sigorta şirketi',state:insurer?(normalize(insurer)===normalize(quote.insurer)?'match':'mismatch'):'unknown',value:insurer||'Etiketli şirket bilgisi bulunamadı.',expected:quote.insurer});
 const raw=pick(/(?:Yıllık\s*)?(?:teklif\s*tutarı|toplam\s*prim|ödenecek\s*prim)\s*[:：]\s*(?:₺\s*)?([\d., ]+)\s*(?:TL|TRY|₺)/iu);
 let amount=NaN;if(raw){const v=raw.replace(/ /g,'');amount=Number(v.includes(',')?v.replace(/\./g,'').replace(',','.'):v.replace(/\.(?=\d{3}(?:\.|$))/g,''))}
 out.push({field:'Tutar',state:Number.isFinite(amount)?(Math.abs(amount-quote.amount)<0.01?'match':'mismatch'):'unknown',value:raw?raw+' TL':'Etiketli TL tutarı bulunamadı.',expected:quote.amount.toLocaleString('tr-TR')+' TL'});
 }
 return out;
}
export function checklist(required:string[],docs:{category:string;review_status:string}[]){return required.map(category=>({category,state:docs.some(d=>d.category===category&&d.review_status==='accepted')?'checked':docs.some(d=>d.category===category)?'review':'missing'}))}
export function detectMime(bytes:Uint8Array){
 if(bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-')return 'application/pdf';
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
