import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('desk-plant');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
c(.13,.22,'lavender',0,.11,0);c(.108,.02,'soil',0,.225,0);c(.03,.28,'leaf',0,.35,0);for(let i=0;i<5;i++){const a=i*2.4;const g=new T.SphereGeometry(1,6,3);g.scale(.08,.14,.05);const n=m.mesh(g,'leaf',[Math.sin(a)*.1,.39+(i%2)*.07,Math.cos(a)*.1]);n.setRotation(new T.Quaternion().setFromEuler(new T.Euler(Math.cos(a)*.7,0,-Math.sin(a)*.7)).toArray());}
return m;}
