import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('mug');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
c(.085,.16,'white',0,.08,0);c(.066,.012,'soil',0,.162,0);m.mesh(new T.TorusGeometry(.057,.02,4,8),'white',[.095,.085,0],m.root,'handle');
return m;}
