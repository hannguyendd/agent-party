import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('wall-blind');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
b(1,3.3,.18,'blindSide',0,1.65,0);b(1,3.16,.06,'blind',0,1.65,.11);b(1,.08,.1,'wall',0,3.26,.13);b(1,.06,.09,'blindSide',0,.08,.13);/* gap is a separately named repeat marker: reveal only on every third tile */const n=b(.03,3.16,.035,'gap',.485,1.65,.15,m.root,'panel-gap');n.setExtras({repeatEvery:3,phase:2});
return m;}
