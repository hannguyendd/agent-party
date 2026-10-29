import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('wall-corner');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
b(1,3.3,.6,'wall',0,1.65,-.2);b(.6,3.3,.4,'wall',-.2,1.65,.3);
return m;}
