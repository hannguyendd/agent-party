import * as T from 'three';import {Model} from '../primitives';
export function create(){const m=new Model('floor-manager');m.mesh(new T.BoxGeometry(1,.06,1),'manager-floor',[0,-.03,0],m.root,'carpet-slab');return m;}
