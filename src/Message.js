"use strict";

const ID = require("./ID.js");

class Message {
	constructor (chord, type, properties) {
		this.chord = chord;
		this.type = type;

		for(let name in properties)
			if(properties.hasOwnProperty(name) && properties[name]!==undefined && !this[name]) this[name] = properties[name];

		//Validate
		if (!(this.src && this.dest && this.data && this.hops))
			throw new Error("Generic message missing components: either src, dest or data");
		switch (type) {
			case 0: //TYPE_MSG
				if (!(this.module && this.handler))
					throw new Error("TYPE_MSG missing components: either module or handler");
				break;
			case 1: //TYPE_PROXY
				break;
		}

		if(!this.version)
			this.version = "00";

		if(this.hops > this.chord.config.messageMaxHops)
			this.hops = this.chord.config.messageMaxHops;
	}

	reply (message) {
		if(this.proxy){
			message = this.chord.messageCore.makeProxyMessage(message, this.proxy);
		}

		this.chord.message(message);
	}

	pass () {
		this.bypass = true;
		this.chord.message(this);
	}

	set src (val) {
		this._src = ID.coerceString(val);
	}

	get src() {
		return this._src;
	}

	set dest (val) {
		this._dest = ID.coerceString(val);
	}

	get dest() {
		return this._dest;
	}

	set proxy (val) {
		this._proxy = ID.coerceString(val);
	}

	get proxy() {
		return this._proxy;
	}
}

module.exports = Message;