"use strict";

class ChordSignalChannel{
	constructor(chord){
		//TODO
	}

	get internalID(){
		return "Conductor-Chord";
	}

	// Description of algorithm:
	// 1) Send a request to the ID you think you want - include your public key and id.
	// 2) On receipt, connectee sends back its true id and key.
	// 3) Use key to encrypt SDP - send offer.
	// Standard setup from here on out - trade encrypted SDP and ICE.

	onbind(){
		//TODO
	}

	send(id,type,data){
		//TODO
	}

	onmessage(msg){
		//TODO
	}

	close(){
		//TODO
	}
}

module.exports = ChordSignalChannel;