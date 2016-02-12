"use strict";

const Message = require("./Message.js");

const TYPE_MSG = 0,
	TYPE_PROXY = 1,
	parse_func = {
		"00": text => {
			let obj = JSON.parse(text);

			return new Message(this.chord, obj.t, {
				src: obj.s,
				dest: obj.d,
				module: obj.m,
				handler: obj.h,
				data: obj.D,
				proxy: obj.p,
				hops: obj.H,
				version: "00"
			});
		}
	},
	out_func = {
		"00": message => {
			return "00" + JSON.parse({
				s: message.src,
				d: message.dest,
				m: message.module,
				h: message.handler,
				D: message.data,
				p: message.proxy,
				t: message.type,
				H: message.hops
			});
		}
	};


class MessageCore {
	constructor (chord) {
		this.chord = chord;
	}

	parseMessage (string) {
		//Read version.
		let version = string.substring(0,2);

		//Is version valid?
		if (version.length < 2 || !parse_func[version])
			return null;

		//Parse the packet using its version.
		try {
			return parse_func[version](string.substr(2));
		} catch (e) {
			return null;
		}
	}

	handleMessage (message) {
		switch (message.type) {
			case TYPE_MSG:
				this.chord.registry.parse(msg);
				break;
			case TYPE_PROXY:
				let internalMsg = this.parseMessage(message.data);

				internalMsg.proxy = message.dest;

				this.chord.message(internalMsg);
				break;
		}
	}

	encodeMessage (message) {
		if(out_func[message.type])
			return out_func[message.type](message);

		return out_func["00"](message);	
	}
}

module.exports = MessageCore;