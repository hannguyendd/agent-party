import {hairCap,eyeSpark,smile} from './features';
import * as T from 'three';
import {Model} from '../primitives';
export const clips=['idle','walk','sit','type','sit-idle','talk','wave','away'];
export function lead(){const m=new Model('lead');const body=m.node('body',[0,.34,0]);
 const legs=[-1,1].map((s,i)=>{const n=m.node(i?'leg-r':'leg-l',[s*.115,0,0],body);m.box(.18,.26,.19,'pants',0,-.13,0,n,'trouser');m.box(.2,.1,.28,'dark',0,-.29,.035,n,'shoe');return n;});
 const torso=m.node('torso',[0,.22,0],body);m.box(.43,.43,.29,'shirt',0,0,0,torso,'shirt',.07);for(const side of [-1,1])m.box(.075,.085,.035,'white',side*.04,.166,.155,torso,'collar',.018).setRotation(new T.Quaternion().setFromEuler(new T.Euler(0,0,side*.4)).toArray());
 const arms=[-1,1].map((s,i)=>{const n=m.node(i?'arm-r':'arm-l',[s*.29,.42,0],body);m.box(.18,.17,.22,'shirt',0,-.075,0,n,'sleeve');m.box(.19,.07,.23,'white',0,-.17,0,n,'rolled-cuff');m.sphere(.15,.19,.17,'skin',0,-.27,0,n,'hand');return n;});
 const socket=m.node('hand-r-socket',[0,-.31,.09],arms[1]);const held=m.node('held-items',[0,0,0],socket).setScale([0,0,0]).setExtras({hiddenByDefault:true,shownScale:[1,1,1]});m.cyl(.075,.13,'white',0,-.005,.025,held,'held-mug');m.mesh(new T.TorusGeometry(.044,.015,4,8),'white',[.085,0,.025],held,'mug-handle');m.cyl(.059,.006,'soil',0,.062,.025,held,'coffee');
 const head=m.node('head',[0,.52,0],body);m.sphere(.65,.61,.56,'skin',0,.285,0,head,'face');hairCap(m,head);for(const side of [-1,1]){const eye=m.sphere(.062,.095,.038,'dark',side*.12,.29,.269,head,'eye');eyeSpark(m,eye);m.sphere(.085,.038,.018,'coral',side*.2,.215,.255,head,'cheek');m.sphere(.085,.125,.095,'skin',side*.315,.27,-.005,head,'ear');}smile(m,head);m.node('head-top',[0,.703,0],head);
 const acc=(a:number[],type:any)=>m.d.createAccessor().setType(type).setArray(new Float32Array(a)).setBuffer(m.b);
 for(const clip of clips){const duration=clip==='walk'?.6:2;const times=Array.from({length:17},(_,i)=>i*duration/16);const anim=m.d.createAnimation(clip);const track=(n:any,path:any,fn:any)=>{const values=times.flatMap((t,i)=>fn(i===16?0:t/duration));const sampler=m.d.createAnimationSampler().setInput(acc(times,'SCALAR')).setOutput(acc(values,path==='rotation'?'VEC4':'VEC3')).setInterpolation('LINEAR');anim.addSampler(sampler).addChannel(m.d.createAnimationChannel().setTargetNode(n).setTargetPath(path).setSampler(sampler));};const rot=(n:any,fn:any)=>track(n,'rotation',(t:number)=>new T.Quaternion().setFromEuler(new T.Euler(...fn(t))).toArray());const seated=['sit','type','sit-idle','away'].includes(clip);
 track(body,'translation',(t:number)=>[0,seated?.5:.34+(clip==='walk'?.025*(1-Math.cos(t*Math.PI*4)):0),seated?-.12:0]);
 legs.forEach((n,i)=>rot(n,(t:number)=>[seated?-Math.PI/2:clip==='walk'?Math.sin(t*Math.PI*2+i*Math.PI)*35*Math.PI/180:0,0,0]));
 arms.forEach((n,i)=>rot(n,(t:number)=>[clip==='type'?-1.15+Math.sin(t*Math.PI*8+i*Math.PI)*.07:clip==='walk'?-Math.sin(t*Math.PI*2+i*Math.PI)*.5:seated?-.4:clip==='wave'&&i===1?-2.6:clip==='talk'&&i===1?-.7+Math.sin(t*Math.PI*2)*.2:0,0,clip==='wave'&&i===1?Math.sin(t*Math.PI*4)*.25:0]));
 rot(head,(t:number)=>[clip==='away'?.35:clip==='type'?.12:0,0,clip==='idle'?Math.sin(t*Math.PI*2)*.035:0]);track(torso,'scale',(t:number)=>[1,1+(clip==='idle'?Math.sin(t*Math.PI*2)*.012:0),1]);}
 return m;}
