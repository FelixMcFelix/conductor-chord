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

		switch(msg.type){
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

	delegate(handler, message){
		u.log(this.chord, "Received message at chord signal channel:");
		u.log(this.chord, {handler, message});

		message.type = handler;

		switch(handler){
			case "key-shake-init":
				this.recvHandshakeInit(message);
				break;
			case "key-shake-reply":
				this.recvHandshakeReply(message);
				break;
			case "sdp-offer":
				this.recvSDPOffer(message);
				break;
			case "sdp-answer":
				this.recvSDPAnswer(message);
				break;
			case "ice":
				this.recvICE(message);
				break;
			case "proxy":
				this.handleProxyReq(message);
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

		// this.message(id, "key-shake-init", {id: ID.coerceString(this.chord.id), destID:id, pub: this.chord.pubKeyPem});
		this.proxy(id, "key-shake-init", {id: ID.coerceString(this.chord.id), destID:id, pub: this.chord.pubKeyPem});
	}

	recvHandshakeInit(message){
		//Message has: id, destID, pub.
		u.log(this.chord, `Received handshake from: ${message.id}`);

		let entry = this.finishEntry(message.id, message.pub);
		this.updateProxy(message.id, message.proxy);

		// this.message(message.id, "key-shake-reply", {id: ID.coerceString(this.chord.id), origID: message.destID, pub: this.chord.pubKeyPem})
		this.proxy(message.id, "key-shake-reply", {
			id: ID.coerceString(this.chord.id),
			origID: message.destID,
			pub: this.chord.pubKeyPem,
			encKey: entry.pubKey.encrypt(entry.aesKey, "RSA-OAEP")
		});
	}

	recvHandshakeReply(message){
		//Message has: id, origID, pub, encKey.
		u.log(this.chord, `Received handshake reply from ${message.origID}: true ID ${message.id}.`);

		let entry = this.finishEntry(message.id,
			message.pub,
			message.origID,
			this.chord.key.privateKey.decrypt(message.encKey, "RSA-OAEP")
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

		this.proxy(id, "sdp-"+type, {
			id: ID.coerceString(this.chord.id),
			sdpEnc: cipherObj.output.data,
			tag: cipherObj.mode.tag.data,
			iv: iv
		});
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

		this.proxy(id, "ice", {
			id: ID.coerceString(this.chord.id),
			iceEnc: cipherObj.output.data,
			tag: cipherObj.mode.tag.data,
			iv: iv
		});
	}

	recvSDPOffer(message){
		//Message has: id, sdpEnc, tag, iv

		this.updateProxy(message.id, message.proxy);

		let entry = this.fetchOrCreateNodeEntry(message.id),
			iv = message.iv,
			decipher = cipher.createDecipher('AES-GCM', entry.aesKey);

		decipher.start({
			iv,
			additionalData: 'binary-encoded string',
			tagLength: 128,
			tag: message.tag
		});

		decipher.update(forgeUtil.createBuffer(obj.data));
		let success = decipher.finish();

		message.sdp = (success) ? JSON.parse(decipher.output.data) : "";

		this.chord.conductor.response(message, this);
	}

	recvSDPAnswer(message){
		//Message has: id, sdpEnc, tag, iv

		this.updateProxy(message.id, message.proxy);

		let entry = this.fetchOrCreateNodeEntry(message.id),
			iv = message.iv,
			decipher = cipher.createDecipher('AES-GCM', entry.aesKey);

		decipher.start({
			iv,
			additionalData: 'binary-encoded string',
			tagLength: 128,
			tag: message.tag
		});

		decipher.update(forgeUtil.createBuffer(obj.data));
		let success = decipher.finish();

		message.sdp = (success) ? JSON.parse(decipher.output.data) : "";

		this.chord.conductor.response(message, this);
	}

	recvICE(message) {
		//Message has: id, iceEnc, tag, iv

		this.updateProxy(message.id, message.proxy);

		let entry = this.fetchOrCreateNodeEntry(message.id),
			iv = message.iv,
			decipher = cipher.createDecipher('AES-GCM', entry.aesKey);

		decipher.start({
			iv,
			additionalData: 'binary-encoded string',
			tagLength: 128,
			tag: message.tag
		});

		decipher.update(forgeUtil.createBuffer(message.iceEnc));
		let success = decipher.finish();

		message.ice = (success) ? JSON.parse(decipher.output.data) : "";

		this.chord.conductor.response(message, this);
	}

	//
	// Helpers
	//
	message(id, handler, msg) {
		this.chord.message(id, ModuleRegistry.wrap(this.id, handler, msg));
	}

	handleProxyReq(msg) {
		msg.data.o.proxy = ID.coerceString(this.chord.id);

		this.chord.message(msg.dest, JSON.stringify(msg.data));
	}

	proxy(id, handler, msg){
		let successor = this.chord.node.finger[0].node,
			predecessor = this.chord.node.predecessor;

		if( successor
			&& (typeof successor == "RemoteNode")
			&& successor.isConnected()
			&& predecessor
			&& (typeof predecessor == "RemoteNode")
			&& predecessor.isConnected() )
			this.proxyByRing(id, handler, msg);
		else
			this.proxyByDirect(id, handler, msg);
	}

	updateProxy(id, proxyId){
		if(proxyId && this.handshakes[id])
			this.handshakes[id].proxy = proxyId;
	}

	proxyByRing(id, handler, msg){
		//needs to lookup the proxy last used for the dest...
		let record = this.handshakes[id];

		if(!record || !record.proxy)
			this.chord.message(id, handler, msg)
		else {
			this.chord.message(ID.coerceString(record.proxy), ModuleRegistry.wrap(this.id, "proxy", {
				data: {m: this.id, h: handler, o: msg},
				dest: ID.coerceString(id),
				src: ID.coerceString(this.chord.id)
			}))
		}
	}

	proxyByDirect(id, handler, msg) {
		//Select either our successor, the server or a working directNode.
		let successor = this.chord.node.finger[0].node,
			server = this.chord.server.node,
			directNodeNames = Object.getOwnPropertyNames(this.chord.directNodes),
			chosen;

		if(successor && (typeof successor == "RemoteNode") && successor.isConnected()) {
			chosen = successor;
		} else if (server && server.isConnected()) {
			chosen = server;
		} else if (directNodeNames.length !== 0) {
			for (var i = directNodeNames.length - 1; i >= 0; i--) {
				chosen = this.chord.directNodes[directNodeNames[i]];

				if (chosen.isConnected())
					break;
				if (i==0)
					chosen = null;
			};
		} else {
			//Whelp kid you're all out of options.
		}

		chosen.message(ID.coerceString(chosen.id), ModuleRegistry.wrap(this.id, "proxy", {
			data: {m: this.id, h: handler, o: msg},
			dest: ID.coerceString(id),
			src: ID.coerceString(this.chord.id)
		}))
	}
}

module.exports = ChordSignalChannel;