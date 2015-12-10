"use strict";

// Registry for message parsers and handlers for the Chord class.
// Used for extensions to the message handling and for RPC.

class ModuleRegistry {
	constructor(){
		this.registry = {};
	}

	register(module){
		this.registry[module.id] = module;
	}

	parse(message){
		let obj = ModuleRegistry.unwrap(message);

		console.log(`Received message at the registry: ${message}`);

		if(obj.m != null)
			this.registry[obj.m].delegate(obj.h, obj.o);		
	}

	static wrap(module, handler, msg){
		//TODO: Find a better way to do this.
		return JSON.stringify({
			m: module,
			h: handler,
			o: msg
		});
	}

	static unwrap(msg){
		return JSON.parse(msg);
	}
}

module.exports = ModuleRegistry;