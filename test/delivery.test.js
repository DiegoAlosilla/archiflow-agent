import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chooseDelivery,editorUrl,openLocal } from '../src/delivery.js';
import { fixture,validFlow } from './helpers.js';
import { runAudit,loadValidatedRun } from '../src/runner.js';
import { main } from '../src/cli.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

test('entrega por archivos predeterminada; MCP solo por elección expresa',async()=>{
  const io={input:{isTTY:false}};
  assert.equal(await chooseDelivery({},io),'files');
  assert.equal(await chooseDelivery({publish:true},io),'mcp');
  await assert.rejects(chooseDelivery({publish:true,delivery:'files'},io),/equivale/);
  await assert.rejects(chooseDelivery({delivery:'otro'},io),/files, local o mcp/);
  await assert.rejects(chooseDelivery({delivery:'files','editor-url':'http://localhost'},io),/requiere/);
  for(const url of ['https://app.diagrams.net','file:///a','http://user:pass@localhost/','http://localhost.example.com/'])assert.throws(()=>editorUrl(url),/loopback/);
});
async function editor(t) {
  const server=createServer((req,res)=>res.end('test editor'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  return `http://127.0.0.1:${server.address().port}/`;
}
test('puente loopback entrega XML solo en ruta aleatoria, exige origen y se cierra tras confirmación',async t=>{
  const url=await editor(t);let address;
  const record=await openLocal('<mxfile><!-- </script><script>alert(1)</script> --></mxfile>',{url,open:async target=>{
    address=new URL(target);
    assert.equal((await fetch(address.origin+'/otro')).status,404);
    const page=await fetch(target),html=await page.text();
    assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    assert.doesNotMatch(html,/<script>alert/);
    assert.match(html,/event.origin!==origin\|\|event.source!==frame.contentWindow/);
    assert.equal((await fetch(target+'/loaded',{method:'POST',headers:{Origin:'http://external.invalid'}})).status,404);
    assert.equal((await fetch(target+'/loaded',{method:'POST',headers:{Origin:address.origin}})).status,204);
  }});
  assert.equal(record.status,'loaded');assert.equal(record.visualInspection,'not-performed');
  await assert.rejects(fetch(address));
});
test('editor incompatible vence el plazo y no declara éxito',async t=>{
  const url=await editor(t);
  await assert.rejects(openLocal('<mxfile/>',{url,timeoutMs:40,open:async()=>{}}),/no confirmó/);
});
test('página embed rechaza mensajes de otra ventana y Guardar descarga sin sobrescribir el origen',async t=>{
  const url=await editor(t);let downloaded=false,objectUrl,revoked=false;
  const record=await openLocal('<mxfile/>',{url,open:async target=>{
    const html=await (await fetch(target)).text(),sent=[];
    const dom=new JSDOM(html,{url:target,runScripts:'dangerously',beforeParse(window){
      window.fetch=(relative,options)=>fetch(new URL(relative,target),{...options,headers:{Origin:new URL(target).origin}});
      window.URL.createObjectURL=blob=>{objectUrl=blob;return 'blob:test';};
      window.URL.revokeObjectURL=()=>{revoked=true;};
      window.HTMLAnchorElement.prototype.click=function(){downloaded=this.download==='ArchiFlow-editado.drawio'&&this.href==='blob:test';};
      window.setTimeout=fn=>fn();
    }});
    t.after(()=>dom.window.close());
    const frame=dom.window.document.getElementById('editor');frame.contentWindow.postMessage=(data,origin)=>sent.push({data:JSON.parse(data),origin});
    const event=(data,source=frame.contentWindow)=>new dom.window.MessageEvent('message',{data:JSON.stringify(data),origin:new URL(url).origin,source});
    dom.window.dispatchEvent(event({event:'init'},dom.window));assert.equal(sent.length,0);
    dom.window.dispatchEvent(event({event:'init'}));assert.equal(sent[0].data.xml,'<mxfile/>');assert.equal(sent[0].origin,new URL(url).origin);
    dom.window.dispatchEvent(event({event:'save',xml:'<mxfile><diagram/></mxfile>'}));
    assert.ok(downloaded);assert.ok(objectUrl.size>0);assert.ok(revoked);assert.equal(sent.at(-1).data.modified,false);
    dom.window.dispatchEvent(event({event:'load'}));
  }});
  assert.equal(record.status,'loaded');
});
test('CLI genera archivos sin consultar MCP y rechaza paquete alterado',async t=>{
  const {inventory,out,repo}=await fixture(t);
  await runAudit({repo,out},async()=>({result:{flows:[validFlow(inventory)]}}));
  await main(['render','--run',out,'--diagram-type','c4-container,sequence','--delivery','files','--mcp','config/does-not-exist.json']);
  const file=path.join(out,'diagrams.drawio');
  assert.match(await fs.readFile(file,'utf8'),/Container/);
  await assert.rejects(fs.access(path.join(out,'publication.json')),/ENOENT/);
  await fs.appendFile(file,'<!--edited-->');
  await assert.rejects(loadValidatedRun(out),/modificado/);
});
test('Mermaid de entrada produce XML sin MCP y un editor ausente deja archivo y fallo registrado',async t=>{
  const {out}=await fixture(t),source=path.join(out,'source.mmd'),target=path.join(out,'external');
  await fs.mkdir(out,{recursive:true});await fs.writeFile(source,'sequenceDiagram\nA->>B: Consulta');
  await main(['diagram','--mermaid',source,'--out',target,'--delivery','files','--mcp','missing.json']);
  assert.match(await fs.readFile(path.join(target,'diagram.drawio'),'utf8'),/Consulta/);
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/`;await new Promise(resolve=>server.close(resolve));
  const failed=path.join(out,'failed');
  await assert.rejects(main(['diagram','--mermaid',source,'--out',failed,'--delivery','local','--editor-url',url]),/no disponible/);
  assert.equal(JSON.parse(await fs.readFile(path.join(failed,'delivery.json'),'utf8')).status,'failed');
  await fs.access(path.join(failed,'diagram.drawio'));
});
