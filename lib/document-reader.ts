// OCR runs in the user's browser. The original file stays in the private document store.
import type {Worker} from 'tesseract.js';
export type Reading={text:string;status:'read'|'partial'|'unreadable';note:string};
export async function readDocument(file:File,progress:(message:string)=>void):Promise<Reading>{
 let cancelled=false;let stopPdf:(()=>Promise<void>)|undefined;let worker:Worker|undefined;let timeout:ReturnType<typeof setTimeout>|undefined;
 const parts:string[]=[];let partial=false;
 async function recognize(image:File|HTMLCanvasElement){
  if(cancelled)throw Error('Okuma durduruldu');
  if(!worker){progress('Türkçe belge okuyucu hazırlanıyor…');const {createWorker}=await import('tesseract.js');worker=await createWorker('tur+eng',1,{workerPath:'/document-assets/worker.min.js',corePath:'/document-assets/core',langPath:'/document-assets/lang',workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')progress(`Yazılar okunuyor: %${Math.round(m.progress*100)}`)}})}
  if(cancelled){await worker.terminate();throw Error('Okuma durduruldu')}const result=await worker.recognize(image);if(result.data.confidence<65)partial=true;return result.data.text;
 }
 async function process(){
 if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
  const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/document-assets/pdf.worker.min.mjs';
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:'/document-assets/cmaps/',cMapPacked:true,standardFontDataUrl:'/document-assets/standard_fonts/',wasmUrl:'/document-assets/wasm/'});stopPdf=()=>task.destroy();const pdf=await task.promise;
  try{if(pdf.numPages>10)partial=true;for(let pageNo=1;pageNo<=Math.min(pdf.numPages,10);pageNo++){
   if(cancelled)throw Error('Okuma durduruldu');progress(`PDF okunuyor: ${pageNo} / ${pdf.numPages}`);const page=await pdf.getPage(pageNo);const content=await page.getTextContent();let text=content.items.map((item:any)=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('');
   if(text.replace(/\s/g,'').length<40){const base=page.getViewport({scale:1});const scale=Math.min(2,2200/Math.max(base.width,base.height));const viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);try{await page.render({canvas,viewport}).promise;text=await recognize(canvas)}finally{canvas.width=canvas.height=0}}
   parts.push(text);page.cleanup();if(parts.join('\n').length>50000){partial=true;break}
  }}finally{await task.destroy()}
 }else{
  const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>25000000)throw Error('Görsel çok büyük; küçülterek tekrar deneyin.')}finally{bitmap.close()}
  parts.push(await recognize(file));
 }
 const full=parts.join('\n');if(full.length>50000)partial=true;const text=full.slice(0,50000);
 return {text,status:text.trim().length<20?'unreadable':partial?'partial':'read',note:partial?'Okuma kısmi veya düşük güvenli. En fazla 10 sayfa ve 50.000 karakter okunur; belgeyi gözle kontrol edin.':text.trim().length<20?'Yeterli okunabilir yazı bulunamadı.':'Yazılar çıkarıldı; alan karşılaştırması broker kontrolü gerektirir.'} as Reading;
 }
 try{return await Promise.race([process(),new Promise<Reading>((_,reject)=>{timeout=setTimeout(()=>{cancelled=true;void stopPdf?.().catch(()=>{});void worker?.terminate().catch(()=>{});reject(Error('Okuma süresi doldu'))},180000)})])}catch(e){return {text:parts.join('\n').slice(0,50000),status:parts.length?'partial':'unreadable',note:e instanceof Error?e.message.slice(0,400):'Belge okunamadı. Dosya saklandı; gözle kontrol edebilirsiniz.'}}finally{cancelled=true;clearTimeout(timeout);if(worker)await worker.terminate().catch(()=>{})}
}
