"use strict";

const msg_types = require("webrtc-conductor").enums,
	  WebSocket = require("ws");

class BootstrapChannelClient {
	constructor(wsAddr, chord){
		this._manager = null;
		this.ws = null;
		this.addr = wsAddr;
		this.chord = chord;
	}

	get internalID(){
		return "Boot-Client";
	}

	onbind(){
		let t = this;
		this.ws = new WebSocket(this.addr);

		return new Promise((resolve, reject) => {
			this.ws.onmessage = msg => {t._manager.response(msg, t);};

			this.ws.onopen = () => {resolve(true);};
			this.ws.onerror = (e) => {reject(e);};
		});
	}

	send(id,type,data){
		switch(type){
			case msg_types.MSG_SDP_OFFER:
				//In this case, id refers to the CLIENT'S ID.
				safeSend(this.ws, {
					type: "bstrap",
					id: id,
					data: data
				});
				break;
			case msg_types.MSG_ICE:
				/* TODO */
				break;
			default:
				throw new Error("Illegal class "+type+" of message sent to "+this.internalID+" channel!");
		}
	}

	onmessage(msg){
		var obj = JSON.parse(msg.data);
		var out = {type: null, data: obj.data, id: obj.id};

		switch(obj.type){
			/* TODO */
			default:
				out.type = resManEnum.RESPONSE_NONE;
				break;
		}

		return out;
	}

	close(){
		this.ws.close();
	}
}

function safeSend(ws, obj){
	try{
		ws.send(JSON.stringify(obj));
	} catch (e) {
		console.log(e);
	}
}

module.exports = BootstrapChannelClient;