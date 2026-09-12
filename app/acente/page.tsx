"use client";

import {useMemo,useRef,useState} from 'react';
import {ArrowLeft,Check,FileUp,MessageCircle,Paperclip,Send,ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

const steps=[
  {key:'agency',question:'Merhaba! Önce acente adınızı yazar mısınız?',placeholder:'Örn. Güven Sigorta Acentesi'},
  {key:'customer',question:'Teşekkürler. Teklif hangi müşteri veya firma için?',placeholder:'Örn. Akdeniz Lojistik Ltd. Şti.'},
  {key:'branch',question:'Hangi sigorta branşı? Kasko, Trafik, Sağlık, Konut veya İşyeri yazabilirsiniz.',placeholder:'Örn. Kasko'},
  {key:'insurer',question:'Teklifi veren sigorta şirketi hangisi?',placeholder:'Örn. Örnek Sigorta A.Ş.'},
  {key:'amount',question:'Toplam teklif tutarını TL olarak yazar mısınız?',placeholder:'Örn. 24.500'},
  {key:'notes',question:'Son olarak; taksit, geçerlilik, teminat veya önemli not var mı? Yoksa “yok” yazabilirsiniz.',placeholder:'Örn. 6 taksit, teklif 20 Eylül’e kadar geçerli'}
] as const;
const branchMap:Record<string,string>={kasko:'Kasko',trafik:'Trafik',sağlık:'Sağlık',saglik:'Sağlık',konut:'Konut',işyeri:'İşyeri',isyeri:'İşyeri'};
type Message={from:'bot'|'user';text:string};

export default function AgencyPortal(){
  const [messages,setMessages]=useState<Message[]>([{from:'bot',text:'Teklif Masası’na hoş geldiniz. Birkaç kısa soruyla teklifinizi ve belgelerinizi brokerınıza ileteceğim.'},{from:'bot',text:steps[0].question}]);
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [value,setValue]=useState('');
  const [files,setFiles]=useState<File[]>([]);
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const step=steps[Object.keys(answers).length];
  const progress=useMemo(()=>Math.round(Object.keys(answers).length/steps.length*100),[answers]);
  function addFiles(list:FileList|null){if(!list)return;const allowed=[...list].filter(f=>['application/pdf','image/png','image/jpeg','image/webp'].includes(f.type)&&f.size<=10*1024*1024);setFiles(current=>[...current,...allowed].slice(0,5));if(allowed.length!==list.length)setError('Yalnızca PDF, PNG, JPG veya WebP ve en fazla 10 MB dosya eklenebilir.');}
  async function send(){
    const text=value.trim();if(!text||!step)return;
    setBusy(true);setError('');setMessages(current=>[...current,{from:'user',text}]);setValue('');
    try{
      const response=await fetch('/api/agency-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({field:step.key,answer:text})});
      const reply=await response.json() as {valid?:boolean;normalizedValue?:string|null;assistantMessage?:string;error?:string};
      if(!response.ok)throw Error(reply.error||'Cevabınızı değerlendiremedik.');
      setMessages(current=>[...current,{from:'bot',text:reply.assistantMessage||'Lütfen yanıtınızı biraz daha açık yazar mısınız?'}]);
      if(!reply.valid){setValue(text);return;}
      setAnswers(current=>({...current,[step.key]:reply.normalizedValue||text}));
      const next=steps[Object.keys(answers).length+1];if(next)setTimeout(()=>setMessages(current=>[...current,{from:'bot',text:next.question}]),200);
    }catch(error){setError(error instanceof Error?error.message:'Cevabınızı değerlendiremedik.');setValue(text)}finally{setBusy(false)}
  }
  async function submit(){
    setBusy(true);setError('');
    try{
      const amount=Number((answers.amount||'').replace(/[^0-9,.-]/g,'').replaceAll('.','').replace(',','.'));
      const normalized=(answers.branch||'').trim().toLocaleLowerCase('tr-TR');
      const quote={agency:answers.agency,customer:answers.customer,insurer:answers.insurer,branch:branchMap[normalized]||'Diğer',amount,status:'Bekliyor',notes:`Acente portalı üzerinden iletildi.\n${answers.notes==='yok'?'Ek not yok.':answers.notes}`};
      const response=await fetch('/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(quote)});if(!response.ok)throw Error('Teklif kaydedilemedi');
      const {id}=await response.json();
      for(const file of files){const form=new FormData();form.append('quoteId',id);form.append('file',file);form.append('category','Teklif belgesi');form.append('source','Acente portalı');const upload=await fetch('/api/documents',{method:'POST',body:form});if(!upload.ok)throw Error('Belge yüklenemedi');}
      setDone(true);setMessages(current=>[...current,{from:'bot',text:'Teşekkürler. Teklifiniz broker değerlendirme ekranına iletildi. Gerekirse sizinle iletişime geçilecek.'}]);
    }catch{setError('Şu an gönderemedik. Bilgileriniz bu ekranda duruyor; lütfen yeniden deneyin.')}finally{setBusy(false)}
  }
  return <main className="agency-page"><header className="agency-top"><a className="brand" href="/"><span className="brand-icon"><ShieldCheck size={22}/></span>teklif<span className="brand-light">masası</span></a><span>ACENTE PORTALI</span></header><section className="agency-shell"><a href="/" className="back-link"><ArrowLeft size={16}/> Broker ekranına dön</a><div className="agency-intro"><span className="portal-icon"><MessageCircle size={24}/></span><div><p className="eyebrow">SOHBETLE TEKLİF İLET</p><h1>Teklifini anlat,<br/>biz kaydedelim.</h1><p>Form doldurmak yerine kısa soruları cevapla. Teklif belgeni de ekleyebilirsin.</p></div></div><div className="agency-layout"><section className="chat-card" aria-label="Teklif toplama sohbeti"><div className="chat-head"><div><strong>Teklif asistanı</strong><span><i/> Çevrimiçi</span></div><b>{progress}%</b></div><div className="chat-progress"><span style={{width:`${progress}%`}}/></div><div className="messages">{messages.map((message,index)=><div className={`chat-message ${message.from}`} key={index}>{message.from==='bot'&&<span className="bot-mark"><MessageCircle size={15}/></span>}<p>{message.text}</p></div>)}</div>{!done&&step?<div className="chat-compose"><Input disabled={busy} value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void send()}}} placeholder={step.placeholder}/><Button size="icon" disabled={busy} onClick={()=>void send()} aria-label="Cevabı gönder"><Send size={17}/></Button></div>:!done?<div className="complete-area"><Button disabled={busy} onClick={submit}>{busy?'Gönderiliyor…':'Teklifi broker’a ilet'}<Check size={17}/></Button></div>:<div className="success-area"><Check size={20}/><span>Teklif başarıyla iletildi</span></div>}{error&&<p className="portal-error" role="alert">{error}</p>}</section><aside className="portal-side"><div className="upload-card"><FileUp size={22}/><h2>Teklif belgesi ekle</h2><p>PDF veya görsel olarak en fazla 5 belge ekleyebilirsin.</p><input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple onChange={e=>addFiles(e.target.files)} hidden/><Button variant="outline" onClick={()=>fileRef.current?.click()} disabled={done}><Paperclip size={16}/> Belge seç</Button>{files.length>0&&<ul>{files.map((file,index)=><li key={`${file.name}-${index}`}><FileUp size={14}/><span>{file.name}</span><button onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))} aria-label={`${file.name} belgesini çıkar`}>×</button></li>)}</ul>}</div><div className="portal-note"><strong>Ne olur?</strong><p>Teklif ve belgeleriniz brokerın değerlendirme ekranına “Bekliyor” durumuyla düşer.</p></div></aside></div></section></main>
}
