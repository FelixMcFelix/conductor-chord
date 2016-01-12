"use strict";

const ModuleRegistry = require("ModuleRegistry.js"),
	msg_types = require("webrtc-conductor").enums,
	pki = require("node-forge").pki;

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

		switch(msg.type){
			case "sdp-offer":
				out.type = msg_types.RESPONSE_SDP_OFFER;
				out.data = msg.sdp;
				break;
			case "sdp-answer":
				out.type = msg_types.RESPONSE_SDP_ANSWER;
				out.data = msg.sdp;
				break;
			case "ice":
				out.type = msg_types.RESPONSE_ICE;
				out.data = msg.ice;
				break;
			default:
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
				break
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
		while(entry.queue.length)
			(entry.queue.shift())(entry.id);
	}

	finishEntry(lookupID, pubPEM, optNewName){
		let entry = this.fetchOrCreateNodeEntry(lookupID);

		entry.status = HSHAKE_OBTAINED;

		if(optNewName)
			this.renameEntry(lookupID, optNewName);

		entry.pubKey = pki.publicKeyFromPem(pubPEM);

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
		let entry = this.fetchOrCreateNodeEntry(id);

		entry.status = HSHAKE_SENT;

		this.message(id, "key-shake-init", {id: ID.coerceString(this.chord.id), destID:id, pub: this.chord.pubKeyPem});
	}

	recvHandshakeInit(message){
		//Message has: id, destID, pub.
		this.finishEntry(message.id, message.pub);

		this.message(message.id, "key-shake-reply", {id: ID.coerceString(this.chord.id), origID: message.destID, pub: this.chord.pubKeyPem})
	}

	recvHandshakeReply(message){
		//Message has: id, origID, pub.
		let entry = this.finishEntry(message.id, message.pub, message.origID);
		try {
			this.chord.renameConnection(message.origID, message.id);
		} finally {
			this.clearActionQueue(entry);
		}
	}

	//
	// RTC functions
	//

	sendSDP(id, type, msg){
		//TODO: encrypt
		this.message(id, "sdp-"+type, {id: ID.coerceString(this.chord.id), sdp: msg});
	}

	sendICE(id, msg){
		//TODO: encrypt
		this.message(id, "ice", {id: ID.coerceString(this.chord.id), ice: msg})
	}

	recvSDPOffer(message){
		//Message has: id, sdp

		//TODO: decrypt
		this.chord.conductor.response(this, message);
	}

	recvSDPAnswer(message){
		//Message has: id, sdp

		//TODO: decrypt
		this.chord.conductor.response(this, message);
	}

	recvICE(message){
		//Message has: id, ice

		//TODO: decrypt
		this.chord.conductor.response(this, message);
	}

	//
	// Helpers
	//
	message(id, handler, msg){
		this.chord.message(id, ModuleRegistry.wrap(this, handler, msg));
	}
}

module.exports = ChordSignalChannel;