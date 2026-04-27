import { EventEmitter } from 'node:events';

const bus = new EventEmitter();
bus.setMaxListeners(100);

export default bus;
