"use strict";

const msg_types = require("webrtc-conductor").enums,
	pki = require("node-forge").pki,
	WS = require("ws"),
	random = require("node-forge").random,
	cipher = require("node-forge").cipher,
	forgeUtil = require("node-forge").util,
	u = require("./UtilFunctions.js");

// let WS;
// try {
// 	WS = WebSocket;
// } catch (e) {
// 	WS = require("ws");
// }

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
		this.ws = new WS(this.addr);
		u.log(t.chord, "Opening WebSocket connection.");

		return new Promise((resolve, reject) => {
			this.ws.onopen = () => {
				u.log(t.chord, "WebSocket opened.");
				//Take over the message handler until registration is done.
				this.ws.onmessage = evt => {
					u.log(t.chord, "Received welcome message from server.")
					let obj = JSON.parse(evt.data);
					u.log(t.chord, obj);
					switch(obj.type){
						case "bstrap-wel":
							u.log(t.chord, "Server has replied, perform the exchange of IDs.");
							this.finalID = obj.id;
							this.serverPem = obj.data;
							this.serverKeyObj = pki.publicKeyFromPem(this.serverPem);

							this.aesKey = this.chord.key.privateKey.decrypt(obj.encKey, "RSA-OAEP")

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

	send(id, type, data){
		u.log(this.chord, "BSTRAP: SENDING");

		let iv = random.getBytesSync(12),
			cipherObj = cipher.createCipher('AES-GCM', this.aesKey);

		cipherObj.start({
			iv,
			additionalData: 'binary-encoded string',
			tagLength: 128
		});

		cipherObj.update(forgeUtil.createBuffer(JSON.stringify(data)));
		cipherObj.finish();

		let obj = {
			id: this.initialID,
			// encIv: this.serverKeyObj.encrypt(iv),
			iv: iv,
			data: cipherObj.output.data,
			tag: cipherObj.mode.tag.data
		};

		switch(type){
			case msg_types.MSG_SDP_OFFER:
				//In this case, id refers to the CLIENT'S ID.
				this.renamed = true;
				this._manager.renameConnection(this.initialID, this.finalID);
				obj.type = "bstrap-offer";
				break;
			case msg_types.MSG_ICE:
				obj.type = "bstrap-ice";
				break;
			default:
				throw new Error("Illegal class "+type+" of message sent to "+this.internalID+" channel!");
		}

		safeSend(this.ws, obj);
	}

	onmessage(evt){
		u.log(this.chord, "Client bootstrap received message:");

		let obj = JSON.parse(evt.data),
			iv = obj.iv,//this.chord.key.privateKey.decrypt(obj.encIv, "RSA-OAEP"),
			decipher = cipher.createDecipher('AES-GCM', this.aesKey);

		decipher.start({
			iv,
			additionalData: 'binary-encoded string',
			tagLength: 128,
			tag: obj.tag
		});

		decipher.update(forgeUtil.createBuffer(obj.data));
		let success = decipher.finish();
		
		let out = {
			type: null,
			data: (success) ? JSON.parse(decipher.output.data) : "",
			id: null
		};

		u.log(this.chord, obj)

		switch(obj.type){
			case "bstrap-ice":
				out.type = msg_types.RESPONSE_ICE;
				break;
			case "bstrap-reply":
				out.type = msg_types.RESPONSE_SDP_ANSWER;
				break;
			default:
				out.type = msg_types.RESPONSE_NONE;
				break;
		}

		// out.id = this.renamed ? this.finalID : this.initialID;
		out.id = this.finalID;

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
