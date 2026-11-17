import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

const samples = JSON.parse(await readFile('diagnostics/voice-samples.json', 'utf8'))
const reports = []
for (const filename of process.argv.slice(2)) {
  const report = JSON.parse(await readFile(filename, 'utf8'))
  if (!['system', 'chatterbox'].includes(report.backend) || !Array.isArray(report.rows)) throw new Error('Invalid voice report')
  const rows = []
  for (const row of report.rows) {
    const sample = samples.find(sample => row.id === sample.id || row.id === `${sample.id}-warm`)
    if (!sample || row.text !== sample.text || row.status !== 'generated') continue
    if (typeof row.file !== 'string' || basename(row.file) !== row.file || !row.file.endsWith('.wav')) throw new Error('Invalid audio filename')
    const audio = await readFile(resolve(dirname(filename), row.file))
    if (audio.length < 44 || audio.length > 10_000_000 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Invalid or oversized WAV')
    rows.push({ ...row, audio: `data:audio/wav;base64,${audio.toString('base64')}` })
  }
  reports.push({ ...report, rows })
}
const data = JSON.stringify({ samples, reports }).replace(/</g, '\\u003c')
const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kare Kare — ses karşılaştırması</title>
<style>body{font:16px/1.6 system-ui;background:#eef3ed;color:#183629;max-width:1000px;margin:32px auto;padding:0 20px}h1{line-height:1.2}section{background:white;border:1px solid #cad8c8;padding:20px;border-radius:14px;margin:20px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.voice{background:#f3f6f0;padding:15px;border-radius:8px}audio{width:100%}label{display:block;margin:9px 0}input,select,button{font:inherit;padding:6px}input{width:90%;max-width:300px}button{background:#244c37;color:white;border:0;border-radius:8px;padding:10px 16px;cursor:pointer}small{display:block;color:#45644e}.notice{padding:12px;background:#fff1cc;border-radius:9px}@media(max-width:650px){.pair{grid-template-columns:1fr}}</style>
<h1>Kare Kare: aynı cümle, farklı ses</h1><p>Kayıtları dinle, doğallığı ve telaffuzu ayrı puanla. Bu dosya internete bağlanmaz ve maç bilgilerini okumaz. Konuşmayı üretme süresi ile gerçek zamanlı koç gecikmesi farklı ölçümlerdir.</p><p class="notice" id="notice"></p><button id="download">Dinleme değerlendirmesini indir</button><main id="samples"></main><p id="status" role="status"></p>
<script>const DATA=${data};const evaluations=new Map();const root=document.querySelector('#samples');
const notice=document.querySelector('#notice');notice.textContent=DATA.reports.some(report=>report.backend==='chatterbox'&&report.rows.length)?'Alternatif model örnekleri eklendi. Cümleye eklenen veya atlanan kelimeleri de not et.':'Chatterbox kaydı henüz eklenmedi. Alternatif sesin kalitesi veya hızı henüz ölçülmedi.';
const node=(tag,text,parent)=>{const element=document.createElement(tag);if(text!==null)element.textContent=text;if(parent)parent.append(element);return element};
function select(label,options,container,record,key){const row=node('label',label+' ',container);const select=node('select',null,row);for(const [value,text] of options){const option=node('option',text,select);option.value=value}select.addEventListener('change',()=>{record[key]=select.value})}
for(const sample of DATA.samples){const section=node('section',null,root);node('h2',sample.id,section);node('p',sample.text,section);const pair=node('div',null,section);pair.className='pair';for(const backend of ['system','chatterbox']){const card=node('div',null,pair);card.className='voice';node('h3',backend==='system'?'Yelda / sistem sesi':'Chatterbox Multilingual',card);const report=DATA.reports.find(report=>report.backend===backend);const row=report?.rows.find(row=>row.id===sample.id);if(!row){node('p','Bu ses için henüz kayıt eklenmedi.',card);continue}const audio=node('audio',null,card);audio.controls=true;audio.preload='none';audio.src=row.audio;audio.addEventListener('play',()=>{for(const other of document.querySelectorAll('audio'))if(other!==audio)other.pause()});node('small','Üretim: '+Number(row.generation_seconds).toFixed(2)+' sn · Kayıt: '+Number(row.audio_seconds).toFixed(2)+' sn',card);const record={sample:sample.id,backend,voice:report.voice,heard:'',naturalness:'',pronunciation:'',note:''};evaluations.set(backend+':'+sample.id,record);select('Ses duyuldu mu?', [['','Seç'],['yes','Evet'],['no','Hayır']],card,record,'heard');const ratings=[['','Seç'],['1','1 — Zayıf'],['2','2'],['3','3'],['4','4'],['5','5 — Çok iyi']];select('Doğallık',ratings,card,record,'naturalness');select('Telaffuz',ratings,card,record,'pronunciation');const label=node('label','Eksik/fazla kelime veya yorum ',card);const input=node('input',null,label);input.addEventListener('input',()=>{record.note=input.value})}}
document.querySelector('#download').addEventListener('click',()=>{const metrics=DATA.reports.map(({rows,...report})=>({...report,rows:rows.map(({audio,...row})=>row)}));const result={schema:1,at:new Date().toISOString(),userAgent:navigator.userAgent,metrics,evaluations:[...evaluations.values()]};const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));link.download='kare-kare-ses-karsilastirma.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);document.querySelector('#status').textContent='Değerlendirme indirildi. Hiçbir sunucuya gönderilmedi.'});</script></html>`
const output = resolve('release/kare-kare-ses-karsilastirma.html')
await writeFile(output, html)
console.log(output)
