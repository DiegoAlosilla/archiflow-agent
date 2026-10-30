import { JSDOM } from 'jsdom';
let parser;
export function escapeSequenceLabels(source) {
  if(typeof source!=='string'||!source.trim().startsWith('sequenceDiagram'))return source;
  return source.split(/\r?\n/).map(line=>{
    if(!/^\s*(?:Note\s|[A-Za-z_][\w]*\s*[-<>().x]+\s*[A-Za-z_][\w]*\s*:)/.test(line))return line;
    const separator=line.indexOf(':');if(separator<0)return line;
    return line.slice(0,separator+1)+line.slice(separator+1).replace(/#[A-Za-z0-9]+;|;/g,token=>token===';'?'#59;':token);
  }).join('\n');
}
export async function validateMermaid(source) {
  if(typeof source!=='string'||source.length>250_000) throw new Error('Mermaid vacío o mayor que 250 KB.');
  // Limit public input to notations supported by the renderer catalog.
  const header=source.replace(/^\s*%%[^\n]*\n/gm,'').trim().split(/\r?\n/)[0];
  if(!/^(?:flowchart\s+(?:LR|RL|TD|TB|BT)|sequenceDiagram|C4Container)\s*$/.test(header)) throw new Error('Solo se admiten flowchart, sequenceDiagram y C4Container estándar, sin directivas de configuración.');
  if(/%%\{|^\s*click\s|<\s*script|javascript\s*:|^\s*---/im.test(source)) throw new Error('Mermaid contiene configuración o enlaces ejecutables no admitidos.');
  if(!parser) {
    const dom=new JSDOM('<!doctype html><html><body></body></html>');
    globalThis.window=dom.window; globalThis.document=dom.window.document;
    parser=(await import('mermaid')).default;
    parser.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true});
  }
  try { await parser.parse(source); } catch(error) { throw new Error(`Mermaid inválido: ${error.message}`); }
}
