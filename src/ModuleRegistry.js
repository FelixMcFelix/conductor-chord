"use strict";

// Registry for message parsers and handlers for the Chord class.
// Used for extensions to the message handling and for RPC.

class ModuleRegistry {
	constructor(){

	}

	register(module){

	}

	parse(message){

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