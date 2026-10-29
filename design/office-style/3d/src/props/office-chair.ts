import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('office-chair');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
b(.64,.12,.6,'chair',0,.44,0);b(.62,.57,.13,'chair',0,.8,-.25,m.root,'mesh-back',.06);b(.1,.43,.09,'aluminium',0,.48,-.28);c(.065,.31,'aluminium',0,.23,0);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const n=b(.08,.07,.43,'aluminium',Math.sin(a)*.18,.09,Math.cos(a)*.18);n.setRotation([0,Math.sin(a/2),0,Math.cos(a/2)]);s(.12,.12,.12,'aluminium',Math.sin(a)*.36,.06,Math.cos(a)*.36);}for(const x of [-.32,.32]){b(.07,.23,.07,'aluminium',x,.58,0);b(.1,.06,.32,'chair',x,.7,.01);}
return m;}
