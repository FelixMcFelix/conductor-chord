"use strict";

const Message = require("./Message.js");

const TYPE_MSG = 0,
	TYPE_PROXY = 1,
	parse_func = {
		"00": (text, chord) => {
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
			return "00" + JSON.stringify({
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
			return parse_func[version](string.substr(2), this.chord);
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

	makeProxyMessage (message, proxyId) {
		let encMsg = this.encodeMessage(message),
			proxyData = {
				data: encMsg,
				src: message.src,
				dest: proxyId,
				hops: this.chord.config.messageMaxHops,
				version: message.version
			};
			
			return new Message(this.chord, 1, proxyData);
	}

	sendProxyMessage (message, proxyID) {
		let m = this.makeProxyMessage(message, proxyID);

		if(m)
			this.chord.message(m);
	}

	encodeMessage (message) {
		if(out_func[message.type])
			return out_func[message.type](message);

		return out_func["00"](message);	
	}
}

module.exports = MessageCore;