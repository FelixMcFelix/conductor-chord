"use strict";

const Node = require("./Node.js");

class RemoteNode extends Node{
	constructor(chord, id){
		this.chord = chord;
		this.id = id;

		//ONLY FINGERS SHOULD HAVE CONNECTIONS.
		this.connection = null;
		//TODO
	}

	get successor(){
		//TODO
		return new Promise((resolve, reject) => {
			chord.rcm.call(this.id, "getSuccessor", [])
				.then(result => resolve(result),
					reason => reject(reason)
				);
		});
	}

	set successor(s){
		//TODO
	}

	get predecessor(){
		//TODO
	}

	set predecessor(p){
		//TODO
	}

	updateFingerTable(foreignId, index){
		//TODO
	}

	findSuccessor(id){
		//TODO
	}

	findPredecessor(id){
		//TODO
	}

	closestPreceedingFinger(id){
		//TODO
	}

	notify(nPrime){
		//TODO
	}

	//Custom

	message(id, msg){
		//TODO
	}

	//Item management

	lookup(id){
		//TODO
	}

	add(id){
		//TODO
	}

}

module.exports = RemoteNode;