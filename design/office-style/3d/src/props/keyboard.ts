import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('keyboard');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
b(.58,.065,.22,'dark',0,.033,0);for(let row=0;row<3;row++)b(.51,.012,.035,'frame',0,.07,-.065+row*.06);
return m;}
