import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { projectRoot } from '../src/io.js';
import { checkMcp,publishDiagrams,withMcp } from '../src/mcp.js';

const config={transport:'stdio',command:process.execPath,args:[path.join(projectRoot,'test/fixtures/mcp-server.js')],timeoutMs:5000};
test('XML elige herramienta nativa y falla antes del lote si el MCP no lo soporta',async()=>{
  const xml={id:'integration',file:'views/integration.drawio',format:'xml',content:'<mxfile/>'};
  const result=await publishDiagrams({...config,args:[...config.args,'--xml']},[xml]);assert.equal(result[0].tool,'open_drawio_xml');
  let published=0;
  await assert.rejects(publishDiagrams(config,[{id:'m',content:'flowchart LR\nA-->B'},xml],async()=>published++),/no admite/);
  assert.equal(published,0);
});
test('MCP real de prueba negocia herramientas y publica',async()=>{
  const checked=await checkMcp(config);assert.equal(checked.status,'connected');assert.equal(checked.server.name,'archiflow-test-server');
  const publications=await publishDiagrams(config,[{id:'test',file:'test.mmd',content:'flowchart LR\nA-->B'}]);assert.equal(publications.length,1);assert.equal(publications[0].visualInspection,'not-performed');assert.equal(publications[0].urls[0],'https://example.com/diagram#test');
});
test('MCP valida argumentos contra el esquema descubierto',async()=>{
  await assert.rejects(withMcp(config,async({call})=>call('open_drawio_mermaid',{bad:'x'})),/incompatibles/);
});
test('MCP isError se propaga y no registra éxito ficticio',async()=>{
  await assert.rejects(publishDiagrams({...config,args:[...config.args,'--fail']},[{id:'test',file:'x',content:'flowchart LR\nA-->B'}]),/devolvió error/);
});
