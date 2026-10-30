import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import Ajv from 'ajv';
import path from 'node:path';
import { readJson, projectRoot, hash } from './io.js';

export async function mcpConfiguration(file) {
  if(!file) return {transport:'stdio',command:process.execPath,args:[path.join(projectRoot,'node_modules/@drawio/mcp/src/index.js')],cwd:projectRoot,timeoutMs:30_000};
  const config=await readJson(path.resolve(file));
  if(!['stdio','http'].includes(config.transport)) throw new Error('MCP transport debe ser stdio o http.');
  if(config.transport==='stdio'&&(!config.command||!Array.isArray(config.args))) throw new Error('MCP STDIO necesita command y args.');
  if(config.transport==='http') {
    const url=new URL(config.url);
    if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('MCP HTTP requiere HTTPS, excepto localhost.');
  }
  return {...config,timeoutMs:config.timeoutMs??30_000};
}
export async function withMcp(config,callback) {
  const client=new Client({name:'archiflow-agent',version:'0.1.0'},{capabilities:{}});
  let transport;
  if(config.transport==='http') {
    const headers={};
    if(config.bearerTokenEnv) {
      const token=process.env[config.bearerTokenEnv];
      if(!token) throw new Error(`Falta variable de autenticación MCP: ${config.bearerTokenEnv}`);
      headers.Authorization=`Bearer ${token}`;
    }
    transport=new StreamableHTTPClientTransport(new URL(config.url),{requestInit:{headers}});
  } else {
    transport=new StdioClientTransport({command:config.command,args:config.args,cwd:config.cwd??projectRoot,env:config.env,stderr:'pipe'});
    // Drain diagnostics without writing server payloads or environment to application logs.
    transport.stderr?.on('data',()=>{});
  }
  try {
    await client.connect(transport,{timeout:config.timeoutMs});
    let cursor,tools=[];
    do {
      const page=await client.listTools(cursor?{cursor}:{},{timeout:config.timeoutMs});
      tools.push(...page.tools); cursor=page.nextCursor;
      if(tools.length>500) throw new Error('Catálogo MCP excede 500 herramientas.');
    } while(cursor);
    async function call(name,args) {
      const tool=tools.find(t=>t.name===name);
      if(!tool) throw new Error(`Herramienta MCP no disponible: ${name}`);
      const validate=new Ajv({strict:false,allErrors:true}).compile(tool.inputSchema);
      if(!validate(args)) throw new Error(`Argumentos MCP incompatibles (${name}): ${JSON.stringify(validate.errors)}`);
      const result=await client.callTool({name,arguments:args},undefined,{timeout:config.timeoutMs});
      if(result.isError) throw new Error(`MCP ${name} devolvió error: ${result.content?.filter(x=>x.type==='text').map(x=>x.text).join('\n').slice(0,1000)}`);
      return result;
    }
    return await callback({client,tools,call});
  } finally { await client.close().catch(()=>{}); await transport.close().catch(()=>{}); }
}
export async function checkMcp(config) {
  return withMcp(config,async({client,tools,call})=>{
    const reference=tools.find(t=>t.name==='get_drawio_reference');
    if(reference) await call(reference.name,{format:'mermaid'});
    const names=tools.map(t=>t.name);
    if(!names.some(name=>['open_drawio_mermaid','create_diagram',config.mermaidTool].includes(name))) throw new Error('El servidor no expone una herramienta Mermaid compatible.');
    return {checkedAt:new Date().toISOString(),status:'connected',transport:config.transport,server:client.getServerVersion(),tools:names,referenceFetched:Boolean(reference)};
  });
}
export async function publishDiagrams(config,diagrams,onPublished=async()=>{}) {
  return withMcp(config,async({client,tools,call})=>{
    const names=tools.map(t=>t.name);
    const mermaidTool=config.mermaidTool??(names.includes('open_drawio_mermaid')?'open_drawio_mermaid':names.includes('create_diagram')?'create_diagram':null);
    // Resolve every format before publishing any item, so unsupported XML does not cause partial publication.
    for(const diagram of diagrams)if(diagram.format==='xml'?!names.includes('open_drawio_xml'):!mermaidTool)throw new Error('El MCP no admite el formato seleccionado. Integración requiere open_drawio_xml (STDIO oficial).');
    const publications=[];
    for(const diagram of diagrams) {
      const tool=diagram.format==='xml'?'open_drawio_xml':mermaidTool;
      if(names.includes('get_drawio_reference'))await call('get_drawio_reference',{format:diagram.format==='xml'?'xml':'mermaid'});
      const args=tool==='create_diagram'?{...(config.arguments??{}),...(config.contentField?{[config.contentField]:diagram.content}:{mermaid:diagram.content})}:{...(config.arguments??{}),content:diagram.content};
      const result=await call(tool,args);
      const text=result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n')??'';
      const urls=[...text.matchAll(/https?:\/\/[^\s<>"\])]+/g)].map(m=>m[0]);
      const item={id:diagram.id,source:diagram.file,sha256:hash(diagram.content),publishedAt:new Date().toISOString(),server:client.getServerVersion(),tool,status:'submitted',urls:[...new Set(urls)],result,visualInspection:'not-performed',drawioFileSaved:false};
      publications.push(item); await onPublished(item);
    }
    return publications;
  });
}
