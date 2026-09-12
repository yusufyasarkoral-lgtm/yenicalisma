import {env} from 'cloudflare:workers';

const fields=['agency','customer','branch','insurer','amount','notes'] as const;
type Field=typeof fields[number];
type BrokerReply={valid:boolean;normalizedValue:string|null;assistantMessage:string};

const fieldInstructions:Record<Field,string>={
  agency:'Acente adı: şirket veya acente adı. Kişi adı, selamlaşma, belirsiz ifade veya anlamsız metni kabul etme.',
  customer:'Müşteri/firma: teklif sahibi gerçek kişi veya firma adı. Tek başına selamlaşma, anlamsız metin ve sadece telefon numarasını kabul etme.',
  branch:'Sigorta branşı: Kasko, Trafik, Sağlık, Konut, İşyeri veya Diğer. “Araba sigortası” gibi Kasko/Trafik ayrımı belirsizse geçersiz say ve ayrımı sor.',
  insurer:'Sigorta şirketi: teklif veren şirketin adı. Acente adı, kişi adı, selamlaşma veya belirsiz yanıtı kabul etme.',
  amount:'Teklif tutarı: pozitif bir Türk lirası tutarı. Türkçe sayı ifadelerini anlayabilirsin; normalleştirilmiş değeri yalnızca sayı olarak ver (örnek: 24500.50). Para birimi TL değilse TL karşılığını sor.',
  notes:'Ek not: taksit, geçerlilik, teminat vb. “yok” veya “not yok” geçerlidir. Her kısa, anlamlı açıklamayı kabul et.'
};

function cleanReply(value:unknown):BrokerReply|null{
  if(!value||typeof value!=='object')return null;
  const row=value as Record<string,unknown>;
  if(typeof row.valid!=='boolean'||(row.normalizedValue!==null&&typeof row.normalizedValue!=='string')||typeof row.assistantMessage!=='string')return null;
  return {valid:row.valid,normalizedValue:typeof row.normalizedValue==='string'?row.normalizedValue.trim():null,assistantMessage:row.assistantMessage.trim().slice(0,500)};
}

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Geçersiz kaynak'},{status:403});
  let body:{field?:unknown;answer?:unknown};
  try{body=await request.json()}catch{return Response.json({error:'Geçersiz istek'},{status:400})}
  if(!fields.includes(body.field as Field)||typeof body.answer!=='string'||!body.answer.trim()||body.answer.length>500)return Response.json({error:'Cevabınızı kontrol edin'},{status:400});
  const apiKey=(env as Cloudflare.Env).OPENAI_API_KEY;
  if(!apiKey)return Response.json({error:'Yapay zekâ broker asistanı henüz bağlanmadı.'},{status:503});
  const field=body.field as Field;
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({
        model:'gpt-4.1-mini',
        input:[
          {role:'system',content:[{type:'input_text',text:`Sen Türkiye’deki teklif toplama sürecinde çalışan, dikkatli bir sigorta broker asistanısın. Görevin tek bir yanıtı kontrol etmektir; poliçe, fiyat veya teminat uydurma. Yanıtı yalnızca aşağıdaki JSON şemasına uygun üret. Geçerli ise normalizedValue alanını doldur; geçersizse null yap ve Türkçe, net biçimde nedenini ve istenen bilgiyi sor. ${fieldInstructions[field]}`}]},
          {role:'user',content:[{type:'input_text',text:`Alan: ${field}\nAcente yanıtı: ${body.answer.trim()}`}]}
        ],
        text:{format:{type:'json_schema',name:'broker_validation',strict:true,schema:{type:'object',additionalProperties:false,properties:{valid:{type:'boolean'},normalizedValue:{type:['string','null']},assistantMessage:{type:'string'}},required:['valid','normalizedValue','assistantMessage']}}}
      })
    });
    if(!response.ok){console.error('Broker model request failed',response.status);return Response.json({error:'Broker asistanı şu an yanıt veremiyor.'},{status:503})}
    const payload=await response.json() as {output_text?:string};
    const reply=cleanReply(JSON.parse(payload.output_text||''));
    if(!reply||!reply.assistantMessage)return Response.json({error:'Broker asistanından geçerli yanıt alınamadı.'},{status:503});
    return Response.json(reply);
  }catch(error){console.error('Broker assistant failed',error);return Response.json({error:'Broker asistanı şu an yanıt veremiyor.'},{status:503})}
}
