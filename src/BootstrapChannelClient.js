"use strict";

const msg_types = require("webrtc-conductor").enums,
	  WebSocket = require("ws"),
	  u = require("./UtilFunctions.js");

class BootstrapChannelClient {
	// Single use bootstrap connection class.

	constructor(wsAddr, chord){
		this._manager = null;
		this.ws = null;
		this.addr = wsAddr;
		this.chord = chord;

		this.finalID = null;
		this.initialID = chord.id.idString;
		this.renamed = false;

		this.serverPem = null;
	}

	get internalID(){
		return "Boot-Client";
	}

	onbind(){
		let t = this;
		this.ws = new WebSocket(this.addr);
		u.log(t.chord, "Opening WebSocket connection.");

		return new Promise((resolve, reject) => {
			this.ws.onopen = () => {
				u.log(t.chord, "WebSocket opened.");
				//Take over the message handler until registration is done.
				this.ws.onmessage = evt => {
					let obj = JSON.parse(evt.data);
					switch(obj.type){
						case "bstrap-wel":
							u.log(t.chord, "Server has replied, perform the exchange of IDs.");
							this.finalID = obj.id;
							this.serverPem = obj.data;
							this.ws.onmessage = evt => {t._manager.response(evt, t);};
							resolve(true);
							break;
						default:
							throw new Error("Illegal class "+type+" of message sent to "+this.internalID+" channel!");
					}
				};

				u.log(t.chord, "Asking server for its ID on the network.");
				safeSend(this.ws, {
					type: "bstrap-reg",
					id: this.initialID,
					data: this.chord.pubKeyPem
				});
			};

			this.ws.onerror = (e) => {reject(e);};
		});
	}

	send(id,type,data){
		u.log(t.chord, "BSTRAP: SENDING "+type);

		switch(type){
			case msg_types.MSG_SDP_OFFER:
				//In this case, id refers to the CLIENT'S ID.
				this.renamed = true;
				this._manager.renameConnection(this.initialID, this.finalID);
				
				safeSend(this.ws, {
					type: "bstrap-offer",
					id: id,
					data: data
				});
				break;
			case msg_types.MSG_ICE:
				safeSend(this.ws, {
					type: "bstrap-ice",
					id: id,
					data: data
				});
				break;
			default:
				throw new Error("Illegal class "+type+" of message sent to "+this.internalID+" channel!");
		}
	}

	onmessage(evt){
		let obj = JSON.parse(evt.data),
			out = {
			type: null,
			data: obj.data,
			id: null
		};

		switch(obj.type){
			case "bstrap-ice":
				out.type = msg_types.RESPONSE_ICE;
				break;
			case "bstrap-sdpReply":
				out.type = msg_types.RESPONSE_SDP_ANSWER;
				break;
			default:
				out.type = msg_types.RESPONSE_NONE;
				break;
		}

		out.id = this.renamed ? this.finalID : this.initialID;

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
