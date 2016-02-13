"use strict";

const ModuleRegistry = require("./ModuleRegistry.js"),
	ID = require("./ID.js"),
	msg_types = require("webrtc-conductor").enums,
	pki = require("node-forge").pki,
	random = require("node-forge").random,
	cipher = require("node-forge").cipher,
	forgeUtil = require("node-forge").util,
	u = require("./UtilFunctions.js");

//handshake status codes.
const HSHAKE_UNKNOWN = 0,
	HSHAKE_SENT = 1,
	HSHAKE_OBTAINED = 2;

class ChordSignalChannel{
	constructor(chord){
		this.id =  "chord-signal";
		this.internalID = "Conductor-Chord";
		this.chord = chord;

		this.handshakes = {};

		chord.registerModule(this);
	}

	//Must implement:
	// 1) ConnectionVector
	// 2) ChordMessageHandler

	//
	// ConnectionVector
	//

	// Description of algorithm:
	// 1) Send a request to the ID you think you want - include your public key and id.
	// 2) On receipt, connectee sends back its true id and key.
	// 3) Use key to encrypt SDP - send offer.
	// Standard setup from here on out - trade encrypted SDP and ICE.

	onbind(){
	}

	send(id,type,data){
		u.log(this.chord, "Queueing command from conductor to send over chord:");
		u.log(this.chord, type);
		switch(type){
			//All of these calls RELY on an accurate key exchange beforehand.
			//These interactiona are queued.

			case msg_types.MSG_SDP_OFFER:
				this.queueOrPerformActionOn(id, id => {this.sendSDP(id, "offer", data)} );
				break;
			case msg_types.MSG_SDP_ANSWER:
				this.queueOrPerformActionOn(id, id => {this.sendSDP(id, "answer", data)} );
				break;
			case msg_types.MSG_ICE:
				this.queueOrPerformActionOn(id, id => {this.sendICE(id, data)} );
				break;
		}
	}

	onmessage(msg){
		let out = {
				type: null,
				data: null,
				id: null
			};

		u.log(this.chord, `Response requested at conductor via chord:`);

		switch(msg.handler){
			case "sdp-offer":
				u.log(this.chord, `SDP offer from ${out.id}`);

				out.type = msg_types.RESPONSE_SDP_OFFER;
				out.data = msg.sdp;
				break;
			case "sdp-answer":
				u.log(this.chord, `SDP answer from ${out.id}`);

				out.type = msg_types.RESPONSE_SDP_ANSWER;
				out.data = msg.sdp;
				break;
			case "ice":
				u.log(this.chord, `ICE candidate from ${out.id}`);

				out.type = msg_types.RESPONSE_ICE;
				out.data = msg.ice;
				break;
			default:
				u.log(this.chord, `Misc message from: ${out.id}`);

				out.type = msg_types.RESPONSE_NONE;
				break;
		}

		out.id = msg.id;

		return out;
	}

	close(){
	}

	//
	// ChordMessageHandler
	//

	delegate(message){
		u.log(this.chord, "Received message at chord signal channel:");
		u.log(this.chord, `${message}`);

		switch(message.handler){
			case "key-shake-init":
				this.recvHandshakeInit(message);
				break;
			case "key-shake-reply":
				this.recvHandshakeReply(message);
				break;
			case "sdp-offer":
			case "sdp-answer":
				this.recvSDP(message);
				break;
			case "ice":
				this.recvICE(message);
				break;
		}
	}

	//
	// Entry management
	//
	fetchOrCreateNodeEntry(id){
		if(!this.handshakes[id]){
			this.handshakes[id] = {
				id,
				queue: [],
				status: HSHAKE_UNKNOWN,
				pubKey: null
			};
		}

		return this.handshakes[id];
	}

	queueOrPerformActionOn(id, func){
		//If no handshake, or ongoing then queue action.
		//Otherwise, execute action with id of entry.
		let entry = this.fetchOrCreateNodeEntry(id);

		//noinspection FallThroughInSwitchStatementJS
		switch(entry.status){
			case HSHAKE_UNKNOWN:
				this.initiateHandshake(id);
				//falls through
			case HSHAKE_SENT:
				entry.queue.push(func);
				break;
			case HSHAKE_OBTAINED:
				this.clearActionQueue(entry);
				func(id);
				break;
		}
	}

	clearActionQueue(entry){
		u.log(this.chord, `Clearing action queue for ${entry.id}`);

		while(entry.queue.length)
			(entry.queue.shift())(entry.id);
	}

	finishEntry(lookupID, pubPEM, optNewName, optAesKey){
		let entry = this.fetchOrCreateNodeEntry(lookupID);

		entry.status = HSHAKE_OBTAINED;

		if(optNewName)
			this.renameEntry(lookupID, optNewName);

		entry.pubKey = pki.publicKeyFromPem(pubPEM);

		entry.aesKey = (optAesKey) ? optAesKey : random.getBytesSync(16);

		return entry;
	}

	renameEntry(oldName, newName){
		if(oldName===newName || !this.handshakes[oldName])
			return false;
		else {
			this.handshakes[newName] = this.handshakes[oldName];
			this.handshakes[newName].id = newName;
			delete this.handshakes[oldName];
		}
	}

	//
	// Handshake Functions
	//

	initiateHandshake(id){
		u.log(this.chord, `Initialising handshake with: ${id}`);

		let entry = this.fetchOrCreateNodeEntry(id);

		entry.status = HSHAKE_SENT;

		this.message("key-shake-init", ModuleRegistry.wrap({pub: this.chord.pubKeyPem}), id);
	}

	recvHandshakeInit(message){
		//Message has: pub.
		u.log(this.chord, `Received handshake from: ${message.src}`);

		let entry = this.finishEntry(message.src, message.data.pub);
		this.updateLastMessage(message);

		this.message("key-shake-reply", ModuleRegistry.wrap({
			origId: message.dest,
			pub: this.chord.pubKeyPem,
			encKey: entry.pubKey.encrypt(entry.aesKey, "RSA-OAEP")
		}), message.src);
	}

	recvHandshakeReply(message){
		//Message has: origId, pub, encKey.
		u.log(this.chord, `Received handshake reply from ${message.src}: true ID ${message.id}.`);

		let entry = this.finishEntry(message.data.origID,
			message.data.pub,
			message.src,
			this.chord.key.privateKey.decrypt(message.data.encKey, "RSA-OAEP")
		);

		try {
			this.chord.conductor.renameConnection(message.origID, message.id);
		} finally {
			this.clearActionQueue(entry);
		}
	}

	//
	// RTC functions
	//

	sendSDP(id, type, msg){
		let entry = this.fetchOrCreateNodeEntry(id);

		let iv = random.getBytesSync(12),
			cipherObj = cipher.createCipher('AES-GCM', entry.aesKey);

		cipherObj.start({
			iv,
			additionalData: 'binary-encoded string',
			tagLength: 128
		});

		cipherObj.update(forgeUtil.createBuffer(JSON.stringify(msg)));
		cipherObj.finish();

		this.message("sdp-"+type, {
			sdpEnc: cipherObj.output.data,
			tag: cipherObj.mode.tag.data,
			iv: iv
		}, id);
	}

	sendICE(id, msg){
		let entry = this.fetchOrCreateNodeEntry(id);

		let iv = random.getBytesSync(12),
			cipherObj = cipher.createCipher('AES-GCM', entry.aesKey);

		cipherObj.start({
			iv,
			additionalData: 'binary-encoded string',
			tagLength: 128
		});

		cipherObj.update(forgeUtil.createBuffer(JSON.stringify(msg)));
		cipherObj.finish();

		this.message("ice", {
			iceEnc: cipherObj.output.data,
			tag: cipherObj.mode.tag.data,
			iv: iv
		}, id);
	}

	recvSDP(message){
		//Message has: sdpEnc, tag, iv

		this.updateLastMessage(message);

		let entry = this.fetchOrCreateNodeEntry(message.src),
			iv = message.data.iv,
			decipher = cipher.createDecipher('AES-GCM', entry.aesKey);

		decipher.start({
			iv,
			additionalData: 'binary-encoded string',
			tagLength: 128,
			tag: message.data.tag
		});

		decipher.update(forgeUtil.createBuffer(message.data.sdpEnc));
		let success = decipher.finish();

		message.data.sdp = (success) ? JSON.parse(decipher.output.data) : "";

		this.chord.conductor.response(message, this);
	}

	recvICE(message) {
		//Message has: iceEnc, tag, iv

		this.updateLastMessage(message);

		let entry = this.fetchOrCreateNodeEntry(message.src),
			iv = message.data.iv,
			decipher = cipher.createDecipher('AES-GCM', entry.aesKey);

		decipher.start({
			iv,
			additionalData: 'binary-encoded string',
			tagLength: 128,
			tag: message.data.tag
		});

		decipher.update(forgeUtil.createBuffer(message.data.iceEnc));
		let success = decipher.finish();

		message.data.ice = (success) ? JSON.parse(decipher.output.data) : "";

		this.chord.conductor.response(message, this);
	}

	//
	// Helpers
	//
	message(handler, data, dest) {
		let msg = this.chord.newMessage(this.id, handler, data, dest);

		if(this.handshakes[dest] && this.handshakes[dest].lastMessage)
			lastMessage.reply(msg);
		else
			this.chord.message(msg);
	}

	updateLastMessage(message){
		if(message.src && this.handshakes[id])
			this.handshakes[message.src].lastMessage = message;
	}


}

module.exports = ChordSignalChannel;