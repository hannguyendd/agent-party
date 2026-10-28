import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('wall-blind');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
b(1,2.7,.18,'blindSide',0,1.35,0);b(1,2.56,.06,'blind',0,1.35,.11);b(1,.08,.1,'wall',0,2.66,.13);b(1,.06,.09,'blindSide',0,.08,.13);/* gap is a separately named repeat marker: reveal only on every third tile */const n=b(.03,2.56,.035,'gap',.485,1.35,.15,m.root,'panel-gap');n.setExtras({repeatEvery:3,phase:2});
return m;}
