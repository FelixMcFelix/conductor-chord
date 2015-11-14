"use strict";

const StringView = require("../lib/StringView.js");

class ID {
	constructor(input){
		if (input instanceof ArrayBuffer){
			this.buffer = input;
			this.dataView = new Uint8Array(input);
			this.stringView = new StringView(this.buffer);
		} else if (ArrayBuffer.isView(input)){
			this.buffer = input.buffer;
			if(input instanceof Uint8Array)
				this.dataView = input;
			else
				this.dataView = new Uint8Array(this.buffer);
			this.stringView = new StringView(this.buffer);
		} else if (typeof input === "string"){
			this.stringView = StringView.makeFromBase64(input);
			this.buffer = this.stringView.buffer;
			this.dataView = new Uint8Array(this.buffer);
		} else {
			throw new TypeError("Illegal type for ID constructor: "+ typeof input);
		}
	}

	get idLength(){
		return this.buffer.byteLength * 8;
	}

	get idArray(){
		return this.dataView;
	}

	get idString(){
		if(this.base64 === undefined)
			this.base64 = this.stringView.toBase64(true);
		return this.base64;
	}

	static powerOfTwoBuffer(power){
		let bytes = power/8;
		bytes = (bytes | 0) === bytes ? bytes : (bytes | 0) + 1;

		let out = new Uint8Array(bytes);
		out[0] = 0x01 << power%8;

		return out;
	}
}

module.exports = ID;