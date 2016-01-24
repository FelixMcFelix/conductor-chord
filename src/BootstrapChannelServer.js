"use strict";

const msg_types = require("webrtc-conductor").enums,
	WebSocketServer = require("ws").Server,
	pki = require("node-forge").pki,
	forgeUtil = require("node-forge").util,
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
					let obj = JSON.parse(evt.data);
					u.log(t.chord, obj)
					switch(obj.type){
						case "bstrap-reg":
							t.connMap[obj.id] = this;
							this.id = obj.id;
							this.registered = true;
							this.pubKey = obj.data;
							this.pubKeyObj = pki.publicKeyFromPem(this.pubKey);
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
		u.log(this.chord, "Send instruction given to server bootstrap.");

		let obj = {
			data: forgeUtil.encode64(this.connMap[id].pubKeyObj.encrypt(data)),
			id: this.id.idString
		};

		let target = this.connMap[id];

		switch(type){
			case msg_types.MSG_SDP_OFFER:
				u.log(this.chord, "Sending offer to client (?)")
				obj.type = "bstrap-offer";
				break;
			case msg_types.MSG_SDP_ANSWER:
				u.log(this.chord, "Sending SDP reply to client.")
				obj.type = "bstrap-reply";
				break;
			case msg_types.MSG_ICE:
				u.log(this.chord, "Sending ICE candidate to client.")
				obj.type = "bstrap-ice";
				break;
			default:
				throw new Error("Illegal class "+type+" of message sent to "+this.internalID+" channel!");
		}

		safeSend(target, obj);
	}

	onmessage(evt){
		let obj = JSON.parse(evt.data);

		u.log(this.chord, "Server bootstrap received message:");
		u.log(this.chord, obj);

		let out = {
			type: null,
			data: this.chord.key.privateKey.decrypt(forgeUtil.decode64(obj.data)),
			id: null
		}

		switch(obj.type){
			case "bstrap-offer":
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