import { JSDOM } from 'jsdom';
import { Graph } from 'dagre-d3-es/src/graphlib/index.js';
import { layout } from 'dagre-d3-es/src/dagre/index.js';
import { mermaidDiagram } from './mermaid.js';

const dom=new JSDOM('');
export const xml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll('\n','&#10;').replaceAll('\r','');
function plain(value) {
  const el=dom.window.document.createElement('div');
  // Mermaid's parser encodes entities before parsing. Decode before XML escaping.
  el.innerHTML=String(value??'').replace(/ﬂ°°(\d+)¶ß/g,'&#$1;').replace(/ﬂ°([a-zA-Z]+)¶ß/g,'&$1;').replace(/<br\s*\/?\s*>/gi,'\n');
  return el.textContent;
}
function wrap(value,width=48) {
  return plain(value).split('\n').flatMap(line=>{
    const result=[];let current='';
    for(const word of line.trim().split(/\s+/)){if(current.length+word.length+1>width&&current){result.push(current);current='';}current+=(current?' ':'')+word;}
    result.push(current);return result;
  }).join('\n');
}
const vertex=(id,text,x,y,w,h,style='')=>`<mxCell id="${xml(id)}" value="${xml(text)}" vertex="1" parent="1" style="whiteSpace=wrap;html=0;fontSize=13;spacing=8;${style}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
const point=(x,y,as)=>`<mxPoint x="${x}" y="${y}" as="${as}"/>`;
function line(id,text,x1,y1,x2,y2,style='',points='') {
  return `<mxCell id="${id}" value="${xml(text)}" edge="1" parent="1" style="html=0;fontSize=13;endArrow=none;labelBackgroundColor=#ffffff;${style}"><mxGeometry relative="1" as="geometry">${point(x1,y1,'sourcePoint')}${point(x2,y2,'targetPoint')}${points}</mxGeometry></mxCell>`;
}
const documentXml=(cells,title)=>`<mxfile host="ArchiFlow Agent"><diagram id="view" name="${xml(title)}"><mxGraphModel grid="1" page="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel></diagram></mxfile>\n`;
const unsupported=feature=>{throw new Error(`Exportación Draw.io no admite ${feature}; conserva el Mermaid original. No se ha simplificado el flujo.`);};

function sequence(db,title) {
  if(db.getCreatedActors().size||db.getDestroyedActors().size)unsupported('creación/destrucción dinámica de participantes');
  const actors=[...db.getActors()],positions=new Map(actors.map(([id],i)=>[id,260+i*400]));
  const right=460+Math.max(0,actors.length-1)*400,frames=[],cells=[],activations=[],stack=[],active=new Map();
  let y=180,serial=0,number=1,step=1,numbered=false;
  const id=()=>`s${serial++}`;
  const x=actor=>{if(!positions.has(actor))throw new Error(`Participante desconocido: ${actor}`);return positions.get(actor);};
  const starts={10:['loop',11],12:['alt',14],15:['opt',16],19:['par',21],22:['rect',23],27:['critical',29],30:['break',31],32:['par over',21]};
  const ends=new Set([11,14,16,21,23,29,31]),dividers={13:'else',20:'and',28:'option'};
  for(const message of db.getMessages()) {
    const type=message.type;
    if(type===26){number=message.message.start??number;step=message.message.step??step;numbered=message.message.visible;continue;}
    if(starts[type]) {
      const [kind,end]=starts[type],left=60+stack.length*20,width=right-left+100-stack.length*20;
      const text=wrap(`${kind} [${plain(message.message)}]`,Math.floor((width-30)/7));
      const frame={id:id(),kind,end,left,width,y};frames.push(frame);stack.push(frame);
      cells.push(vertex(id(),text,left+5,y+3,width-10,24+text.split('\n').length*18,'fillColor=none;strokeColor=none;align=left;verticalAlign=top;fontStyle=1;'));
      y+=40+text.split('\n').length*18;continue;
    }
    if(ends.has(type)) {
      const frame=stack.pop();if(!frame||frame.end!==type)throw new Error('Bloque de secuencia desbalanceado.');
      y+=20;frame.height=y-frame.y;y+=25;continue;
    }
    if(dividers[type]) {
      const frame=stack.at(-1);if(!frame)throw new Error('Separador fuera de bloque.');
      cells.push(line(id(),'',frame.left,y,frame.left+frame.width,y,'dashed=1;'));
      const text=wrap(`${dividers[type]} [${plain(message.message)}]`,Math.floor((frame.width-30)/7));
      cells.push(vertex(id(),text,frame.left+5,y+5,frame.width-10,24+text.split('\n').length*18,'fillColor=none;strokeColor=none;align=left;verticalAlign=top;fontStyle=1;'));
      y+=45+text.split('\n').length*18;continue;
    }
    if(type===17){const a=active.get(message.from)??[];a.push({y:y-30,x:x(message.from)+a.length*6});active.set(message.from,a);continue;}
    if(type===18){const a=active.get(message.from)?.pop();if(!a)throw new Error('Activación sin inicio.');activations.push(vertex(id(),'',a.x-7,a.y,14,Math.max(25,y-30-a.y),'fillColor=#dae8fc;'));continue;}
    if(type===2) {
      const from=x(message.from),to=x(message.to??message.from),placement=Number(message.placement);
      const width=placement===2?Math.max(320,Math.abs(to-from)+300):320;
      const left=placement===0?from-width-25:placement===1?from+25:Math.min(from,to)-150;
      const text=wrap(message.message,Math.floor((width-24)/7)),height=28+text.split('\n').length*19;
      cells.push(vertex(id(),text,left,y,width,height,'shape=note;fillColor=#fff2cc;strokeColor=#d6b656;align=left;'));
      y+=height+35;continue;
    }
    if(![0,1,3,4,5,6,24,25,33,34].includes(type)||message.centralConnection)unsupported(`tipo de mensaje ${type}`);
    const from=x(message.from),to=x(message.to),self=from===to;
    const text=wrap((numbered?`${number}. `:'')+plain(message.message),Math.max(28,Math.floor((self?280:Math.abs(to-from)-35)/7)));
    number+=step;
    const height=text.split('\n').length*18;y+=height+12;
    const dashed=[1,4,6,25,34].includes(type),arrow=[3,4].includes(type)?'cross':[5,6,24,25].includes(type)?'open':'block';
    const style=`endArrow=${arrow};endFill=${arrow==='block'?1:0};${dashed?'dashed=1;':''}${[33,34].includes(type)?'startArrow=block;startFill=1;':''}`;
    // Labels are separate editable cells so long text cannot overlap the next message.
    cells.push(vertex(id(),text,self?from+20:Math.min(from,to)+10,y-height-10,self?280:Math.abs(to-from)-20,height+5,'fillColor=none;strokeColor=none;spacing=0;verticalAlign=bottom;'));
    const points=self?`<Array as="points"><mxPoint x="${from+320}" y="${y}"/><mxPoint x="${from+320}" y="${y+35}"/></Array>`:'';
    cells.push(line(id(),'',from,y,to,y+(self?35:0),style,points));y+=self?80:45;
  }
  if(stack.length)throw new Error('Bloques de secuencia abiertos.');
  for(const items of active.values())for(const a of items)activations.push(vertex(id(),'',a.x-7,a.y,14,y-a.y,'fillColor=#dae8fc;'));
  const backgrounds=[];
  for(const box of db.getBoxes()) {
    const xs=box.actorKeys.map(x);if(!xs.length)continue;
    backgrounds.push(vertex(id(),plain(box.name),Math.min(...xs)-180,40,Math.max(...xs)-Math.min(...xs)+360,y,'fillColor=#dae8fc;fillOpacity=15;verticalAlign=top;'));
  }
  const lifelines=actors.flatMap(([key,actor])=>[
    vertex(id(),wrap(actor.description||key,36),x(key)-150,85,300,65,`rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;${actor.type==='actor'?'shape=umlActor;':''}`),
    line(id(),'',x(key),150,x(key),y+20,'dashed=1;strokeColor=#999999;'),
  ]);
  return documentXml([...backgrounds,...frames.map(f=>vertex(f.id,'',f.left,f.y,f.width,f.height,'fillColor=none;strokeWidth=2;')), ...lifelines,...activations,...cells],title);
}

function graphXml(nodes,edges,direction,title) {
  const g=new Graph({multigraph:true}).setGraph({rankdir:direction,ranksep:180,nodesep:90,marginx:60,marginy:80}).setDefaultEdgeLabel(()=>({}));
  nodes.forEach(n=>{n.text=wrap(n.text,38);n.height=Math.max(110,n.text.split('\n').length*20+30);g.setNode(n.id,{width:300,height:n.height});});
  edges.forEach((e,i)=>{if(!g.hasNode(e.from)||!g.hasNode(e.to))throw new Error('Relación sin destino definido.');e.text=wrap(e.text,34);g.setEdge(e.from,e.to,{width:240,height:20*e.text.split('\n').length+16},String(i));});
  layout(g);
  const cells=nodes.map(n=>{const p=g.node(n.id);return vertex(n.id,n.text,p.x-150,p.y-n.height/2,300,n.height,n.style);});
  edges.forEach((e,i)=>{
    const p=g.edge(e.from,e.to,String(i));
    const points=`<Array as="points">${p.points.slice(1,-1).map(p=>`<mxPoint x="${p.x}" y="${p.y}"/>`).join('')}</Array>`;
    cells.push(`<mxCell id="e${i}" edge="1" parent="1" source="${e.from}" target="${e.to}" style="html=0;endArrow=block;endFill=1;${e.style??''}"><mxGeometry relative="1" as="geometry">${points}</mxGeometry></mxCell>`);
    cells.push(vertex(`label${i}`,e.text,p.x-120,p.y-10*e.text.split('\n').length,240,20*e.text.split('\n').length,'fillColor=#ffffff;strokeColor=none;spacing=0;'));
  });
  return documentXml(cells,title);
}
function flowchart(db,title) {
  if(db.getSubGraphs().length)unsupported('subgraphs en la conversión de Mermaid externo');
  const shapes={square:'',rect:'',round:'rounded=1;',stadium:'rounded=1;arcSize=50;',cylinder:'shape=cylinder3;',diamond:'rhombus;',hexagon:'shape=hexagon;',circle:'ellipse;aspect=fixed;',doublecircle:'shape=doubleEllipse;',subroutine:'shape=process;'};
  const ids=new Map([...db.getVertices().keys()].map((k,i)=>[k,`n${i}`]));
  const nodes=[...db.getVertices().values()].map(v=>{
    if(!Object.hasOwn(shapes,v.type??'square'))unsupported(`figura ${v.type}`);
    if(v.link||v.haveCallback||v.img||v.icon)unsupported('enlaces o recursos externos');
    return {id:ids.get(v.id),text:v.text??v.id,style:`${shapes[v.type??'square']}fillColor=#dae8fc;strokeColor=#6c8ebf;`};
  });
  const edges=db.getEdges().filter(e=>e.stroke!=='invisible').map(e=>{
    const arrows={arrow_point:'endArrow=block;',arrow_open:'endArrow=none;',arrow_cross:'endArrow=cross;',arrow_circle:'endArrow=oval;',double_arrow_point:'startArrow=block;endArrow=block;'};
    if(!arrows[e.type])unsupported(`flecha ${e.type}`);
    return {from:ids.get(e.start),to:ids.get(e.end),text:e.text,style:arrows[e.type]+(e.stroke==='dotted'?'dashed=1;':'')+(e.stroke==='thick'?'strokeWidth=3;':'')};
  });
  return graphXml(nodes,edges,db.getDirection()==='TD'?'TB':db.getDirection(),title);
}
function c4(db,title,direction) {
  if(db.getBoundaries().some(b=>b.alias!=='global'))unsupported('fronteras C4 en Mermaid externo');
  const shapes=db.getC4ShapeArray(),ids=new Map(shapes.map((s,i)=>[s.alias,`n${i}`]));
  const nodes=shapes.map(s=>{
    const kind=s.typeC4Shape.text;
    if(!/^container(_db|_queue)?(_ext)?$/.test(kind))unsupported(`elemento C4 ${kind}`);
    const external=kind.endsWith('_ext');
    return {id:ids.get(s.alias),text:`${plain(s.label.text)}\n[${kind.includes('_db')?'Container: Database':kind.includes('_queue')?'Container: Queue':'Container'}${s.techn?.text?', '+plain(s.techn.text):''}]\n${plain(s.descr?.text)}`,style:`${kind.includes('_db')?'shape=cylinder3;':'rounded=1;'}fillColor=${external?'#999999':'#438dd5'};fontColor=#ffffff;strokeColor=#1b5b99;`};
  });
  const edges=db.getRels().map(e=>{
    if(!/^rel(_[udlr]|_up|_down|_left|_right)?$/.test(e.type)&&e.type!=='birel')unsupported(`relación C4 ${e.type}`);
    return {from:ids.get(e.from),to:ids.get(e.to),text:[e.label?.text,e.techn?.text,e.descr?.text].filter(Boolean).join('\n'),style:'dashed=1;'+(e.type==='birel'?'startArrow=block;':'')};
  });
  return graphXml(nodes,edges,direction??(db.getRels().some(e=>e.type==='rel_r')?'LR':'TB'),title);
}
export async function mermaidToDrawio(source,{title='Diagrama',direction}={}) {
  const {type,db}=await mermaidDiagram(source);
  if(type==='sequence')return sequence(db,title);
  if(type==='c4')return c4(db,title,direction);
  if(type.startsWith('flowchart'))return flowchart(db,title);
  unsupported(type);
}

export function bundleDrawio(documents) {
  const pages=[];
  for(const [index,{content}] of documents.entries()) {
    const doc=new dom.window.DOMParser().parseFromString(content,'text/xml');
    if(doc.querySelector('parsererror')||doc.documentElement.tagName!=='mxfile')throw new Error('XML Draw.io inválido.');
    for(const [pageIndex,page] of [...doc.querySelectorAll('mxfile > diagram')].entries()) {
      page.setAttribute('id',`view_${index}_${pageIndex}`);
      pages.push(new dom.window.XMLSerializer().serializeToString(page));
    }
  }
  return `<mxfile host="ArchiFlow Agent">${pages.join('')}</mxfile>\n`;
}
