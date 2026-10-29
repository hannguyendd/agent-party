import {Model} from '../primitives';
import {create as officeChair} from './office-chair';
import {keys} from '../primitives';
export const fPropIds=['workstation-desk','workstation-desk-compact','monitor-compact','keyboard-compact','mouse-compact','spine-left','spine-middle','spine-bench','meeting-table','meeting-chair-mint','meeting-chair-lavender','office-chair-lavender','rug-meeting-corner'];
export const fSmallIds=['monitor-compact','keyboard-compact','mouse-compact'];
export function fProp(id:string){
if(id==='office-chair-lavender'){const m=officeChair();m.id=id;m.root.setName(id);for(const n of m.d.getRoot().listNodes())if(n.getMesh()&&['part','mesh-back'].includes(n.getName()))for(const p of n.getMesh().listPrimitives()){const uv=p.getAttribute('TEXCOORD_0'),chair=keys.indexOf('chair'),target=keys.indexOf('lavender');if(Math.abs(uv.getElement(0,[])[0]-(chair%8+.5)/8)<1e-5&&Math.abs(uv.getElement(0,[])[1]-(Math.floor(chair/8)+.5)/8)<1e-5)for(let i=0;i<uv.getCount();i++)uv.setElement(i,[(target%8+.5)/8,(Math.floor(target/8)+.5)/8]);}return m;}
const m=new Model(id),b=m.box.bind(m),c=m.cyl.bind(m);const legs=(w:number,d:number,h=.62)=>{for(const x of [-w/2+.08,w/2-.08])for(const z of [-d/2+.08,d/2-.08])b(.09,h,.09,'aluminium',x,h/2,z);};
if(id.startsWith('workstation-desk')){const w=id.endsWith('compact')?.92:1.8;b(w,.11,1.4,'desktop',0,.685,0,m.root,'desktop',.055);legs(w,1.4);b(w-.15,.08,.08,'aluminium',0,.52,-.56);}
if(id==='monitor-compact'){b(.7,.43,.075,'dark',0,.43,0);b(.62,.35,.02,'screen',0,.43,.041,m.root,'screen',.01);b(.065,.23,.065,'dark',0,.155,0);b(.27,.05,.2,'dark',0,.025,.015);}
if(id==='keyboard-compact'){b(.4,.05,.16,'dark',0,.025,0);for(let z of [-.045,0,.045])b(.35,.008,.02,'frame',0,.055,z);}
if(id==='mouse-compact')b(.095,.055,.14,'white',0,.0275,0,m.root,'mouse',.025);
if(id.startsWith('spine-')){const w=id==='spine-left'?3:id==='spine-middle'?4:4.9,d=id==='spine-bench'?.96:1.6;b(w,.58,d,'white',0,.29,0,m.root,'cabinet');b(w,.07,d,'desktop',0,.615,0,m.root,'cabinet-top');const sections=Math.ceil(w);for(let i=0;i<sections;i++){const x=(i-(sections-1)/2)*(w/sections);b(w/sections-.035,.4,.035,i%2?'mint':'cream',x,.31,d/2+.009,m.root,'cabinet-door');b(.12,.025,.025,'aluminium',x,.43,d/2+.036);}b(w-.2,.045,.38,'soil',0,.67,0,m.root,'planter-inset');}
if(id==='meeting-table'){b(1.18,.11,2.18,'desktop',0,.685,0,m.root,'desktop',.055);legs(1.18,2.18);}
if(id.startsWith('meeting-chair-')){const color=id.endsWith('lavender')?'lavender':'mint';b(.64,.12,.53,color,0,.44,0);b(.64,.43,.1,color,0,.72,-.23);legs(.58,.48,.38);}
if(id==='rug-meeting-corner')b(2.8,.025,3.8,'lavender',0,.0125,0,m.root,'flat-rug',.01);
return m;}
