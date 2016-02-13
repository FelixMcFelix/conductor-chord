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
		if(message.module && this.registry[message.module]){
			//unwrap the message's data...
			try{
				message.data = ModuleRegistry.unwrap(message.data);
			} catch (e) {}

			this.registry[message.module].delegate(message);
		}
	}

	static wrap(data){
		return JSON.stringify(data);
	}

	static unwrap(data){
		return JSON.parse(msg);
	}
}

module.exports = ModuleRegistry;