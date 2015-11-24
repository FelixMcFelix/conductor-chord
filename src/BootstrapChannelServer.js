"use strict";

const msg_types = require("webrtc-conductor").enums,
	  WebSocketServer = require("ws").Server,
	  u = require("./UtilFunctions.js");

// This initial version uses the chord spec - i.e. we use a wrtc connection with the node
// of the server itself, rather than a level above being used to route information across.
// This way is simpler, but may be more taxing on the server.

class BootstrapChannelServer{
	constructor(chord){
		this._manager = null;
		this.wss = null;
		this.chord = chord;
		this.id = chord.id;

		this.connMap = {};
	}

	get internalID(){
		return "Boot-Server";
	}

	onbind(){
		let t = this;
		this.wss = new WebSocketServer(t.chord.config.serverConfig);
		u.log(t.chord, "Bound, opening WSS.");

		return new Promise((resolve, reject) => {
			this.wss.on("open", () => {
				u.log(t.chord, "Server finally ready!");
				resolve(false);
			});

			this.wss.on("error", e => {reject(e);});

			this.wss.on("connection", conn => {
				u.log(t.chord, "Connection from client, setting up.");

				conn.onmessage = function(evt) {
					u.log(t.chord, "Initial message from client, checking...");
					u.log(t.chord, evt)
					let obj = JSON.parse(evt.data);
					switch(obj.type){
						case "bstrap-reg":
							t.connMap[obj.id] = this;
							this.id = obj.id;
							this.registered = true;
							this.pubKey = obj.data;
							this.onmessage = evt => {t._manager.response(evt, t);};

							u.log(t.chord, "Valid. Connection from "+this.id+". Message handler bound.");

							safeSend(this, {
								type: "bstrap-wel",
								id: t.id.idString,
								data: t.chord.pubKeyPem
							});
							break;
						default:
							throw new Error("Illegal class "+type+" of message sent to "+this.internalID+" channel!");
					}
				};

				conn.onclose = () => {
					if(conn.registered)
						delete this.connMap[conn.id]
				};
			});
		});
	}

	send(id,type,data){
		u.log(this.chord, "Send instruction given to server bootstrap");

		let obj = {
			type: null,
			data,
			id: this.id.idString
		};

		let target = this.connMap[id];

		switch(type){
			case msg_types.MSG_SDP_OFFER:
				obj.type = "bstrap-offer";
				safeSend(target, obj);
				break;
			case msg_types.MSG_SDP_ANSWER:
				obj.type = "bstrap-reply";
				safeSend(target, obj);
				break;
			case msg_types.MSG_ICE:
				obj.type = "bstrap-ice";
				safeSend(target, obj);
				break;
			default:
				throw new Error("Illegal class "+type+" of message sent to "+this.internalID+" channel!");
		}
	}

	onmessage(evt){
		let obj = JSON.parse(evt.data);

		u.log(this.chord, "Server bootstrap received message:");
		u.log(this.chord, obj);

		

		let out = {
			type: null,
			data: obj.data,
			id: null
		}

		switch(obj.type){
			case "bstrap-sdpOffer":
				out.type = msg_types.RESPONSE_SDP_OFFER;
				break;
			case "bstrap-ice":
				out.type = msg_types.RESPONSE_ICE;
				break;
			default:
				out.type = msg_types.RESPONSE_NONE;
				break;
		}

		out.id = obj.id;

		return out;
	}

	close(){
		u.log(this.chord, "Closing server bootstrap - this shouldn't happen.");
		this.wss.close();
	}
}

function safeSend(ws, obj){
	try{
		ws.send(JSON.stringify(obj));
	} catch (e) {
		console.log(e);
	}
}

module.exports = BootstrapChannelServer;