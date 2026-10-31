import { createInterface } from 'node:readline/promises';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

export function editorUrl(value='http://127.0.0.1:8080/') {
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.hash)throw new Error('--editor-url debe apuntar a un editor local (loopback), sin credenciales ni fragmento.');
  for(const [key,val] of Object.entries({embed:'1',proto:'json',spin:'1',saveAndExit:'0',noExitBtn:'1',lang:'es'}))url.searchParams.set(key,val);
  return url;
}
export async function chooseDelivery(options={},io={input:process.stdin,output:process.stderr}) {
  if(options.publish&&options.delivery&&options.delivery!=='mcp')throw new Error('--publish equivale a --delivery mcp; no lo combines con otra entrega.');
  let mode=options.delivery??(options.publish?'mcp':undefined);
  if(mode===undefined&&io.input.isTTY) {
    const rl=createInterface(io);
    try {
      while(!['files','local','mcp'].includes(mode)) {
        const answer=(await rl.question('Entrega: 1. Archivos .drawio y Mermaid (recomendado), 2. Editor local, 3. MCP [1]: ')).trim();
        mode=({'':'files','1':'files','2':'local','3':'mcp'})[answer]??answer;
      }
    }finally{rl.close();}
  }
  mode??='files';
  if(!['files','local','mcp'].includes(mode))throw new Error('--delivery debe ser files, local o mcp.');
  if(options['editor-url']&&mode!=='local')throw new Error('--editor-url requiere --delivery local.');
  if(mode==='local')editorUrl(options['editor-url']);
  return mode;
}

export async function openBrowser(url) {
  const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';
  const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
  await new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:'ignore',windowsHide:true,detached:true});
    child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});
  });
}

// A short-lived loopback bridge: no general filesystem serving, no MCP, no URL payload.
// It closes after the editor acknowledges load; the loaded page still handles Save locally.
export async function openLocal(content,{url='http://127.0.0.1:8080/',open=openBrowser,timeoutMs=60000,log=()=>{}}={}) {
  const editor=editorUrl(url);
  let check;
  try{check=await fetch(editor,{redirect:'error',signal:AbortSignal.timeout(5000)});await check.body?.cancel();}
  catch{throw new Error(`Editor local no disponible en ${editor.origin}. Inicia tu Draw.io local y vuelve a ejecutar; el archivo .drawio sigue disponible.`);}
  if(!check.ok)throw new Error(`Editor local respondió HTTP ${check.status}. El archivo .drawio sigue disponible.`);
  const token=randomBytes(24).toString('hex'),route=`/${token}`,nonce=randomBytes(18).toString('base64');
  const safe=value=>JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
  let resolveDone,rejectDone,timer;
  const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
  // Attach immediately, even when a browser launcher takes longer than the timeout.
  done.catch(()=>{});
  const server=createServer((req,res)=>{
    if(req.headers.host!==address.host){res.writeHead(403).end();return;}
    if(req.method==='POST'&&req.url===route+'/loaded'&&req.headers.origin===address.origin) {
      res.writeHead(204).end();resolveDone({status:'loaded',editor:editor.origin,transport:'local-embed',visualInspection:'not-performed',savedFromEditor:false});return;
    }
    if(req.method!=='GET'||req.url!==route){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; frame-src ${editor.origin}; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'`});
    res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><title>ArchiFlow · Draw.io local</title><style nonce="${nonce}">body{margin:0;font:14px system-ui}header{padding:10px;background:#edf3fa}iframe{width:100%;height:calc(100vh - 40px);border:0}</style><header id="status">Cargando el diagrama en el editor local…</header><iframe id="editor" title="Draw.io local"></iframe><script nonce="${nonce}">
const frame=document.getElementById('editor'),status=document.getElementById('status');
const editor=${safe(editor.href)},origin=${safe(editor.origin)},xml=${safe(content)};
window.addEventListener('message',async event=>{
  if(event.origin!==origin||event.source!==frame.contentWindow)return;
  let data;try{data=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch{return;}
  if(data?.event==='init')frame.contentWindow.postMessage(JSON.stringify({action:'load',xml,title:'ArchiFlow.drawio',saveAndExit:false}),origin);
  if(data?.event==='load'){
    if(data.error){status.textContent='No se pudo cargar: '+data.error;return;}
    status.textContent='Diagrama cargado. Guardar descarga una copia .drawio; conserva el original de la auditoría.';
    await fetch(${safe(route+'/loaded')},{method:'POST'}).catch(()=>{});
  }
  if(data?.event==='save'&&typeof data.xml==='string'){
    const link=document.createElement('a'),blob=URL.createObjectURL(new Blob([data.xml],{type:'application/xml'}));
    link.href=blob;link.download='ArchiFlow-editado.drawio';link.click();setTimeout(()=>URL.revokeObjectURL(blob),10000);
    frame.contentWindow.postMessage(JSON.stringify({action:'status',message:'Copia descargada',modified:false}),origin);
  }
});
frame.src=editor;
</script></html>`);
  });
  let address;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  address=new URL(`http://127.0.0.1:${server.address().port}${route}`);
  timer=setTimeout(()=>rejectDone(new Error('El editor no confirmó la carga en el plazo disponible. Puedes abrir el archivo .drawio manualmente.')),timeoutMs);
  try {log(`Abriendo editor local: ${editor.origin}`);await open(address.href);return await done;}
  finally {clearTimeout(timer);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
