"use strict";

const Node = require("./Node.js"),
	ID = require("./ID.js");

class RemoteNode {
	constructor(chord, id, optConn){
		this.chord = chord;
		this.id = id;

		//ONLY FINGERS SHOULD HAVE CONNECTIONS.
		this.connection = optConn;
		//TODO
	}

	getSuccessor(){
		//Return an ID, then create a remotenode from that.
		return new Promise((resolve, reject) => {
			this.chord.rcm.call(this.id, "getSuccessor", [])
				.then(result => resolve((result)? new RemoteNode(this.chord, new ID(result), null) : result),
					reason => reject(reason)
				);
		});
	}

	setSuccessor(s){
		//Send them an ID, return the remotenode supplied.
		return new Promise((resolve, reject) => {
			this.chord.rcm.call(this.id, "setSuccessor", [ID.coerceString(s.id)])
				.then(result => resolve(s),
					reason => reject(reason)
				);
		});
	}

	getPredecessor(){
		//Return an ID, then create a remotenode from that.
		return new Promise((resolve, reject) => {
			this.chord.rcm.call(this.id, "getPredecessor", [])
				.then(result => resolve((result)? new RemoteNode(this.chord, new ID(result), null) : result),
					reason => reject(reason)
				);
		});
	}

	setPredecessor(p){
		//Send them an ID, return the remotenode supplied.
		return new Promise((resolve, reject) => {
			this.chord.rcm.call(this.id, "setPredecessor", [ID.coerceString(p.id)])
				.then(result => resolve(p),
					reason => reject(reason)
				);
		});
	}

	updateFingerTable(foreignNode, index){
		return this.chord.rcm.call(this.id, "updateFingerTable", [ID.coerceString(foreignNode.id), index]);
	}

	findSuccessor(id){
		return new Promise((resolve, reject) => {
			this.chord.rcm.call(this.id, "findSuccessor", [ID.coerceString(id)])
				.then(result => resolve(new RemoteNode(this.chord, new ID(result), null)),
					reason => reject(reason)
				);
		});
	}

	findPredecessor(id){
		return new Promise((resolve, reject) => {
			this.chord.rcm.call(this.id, "findPredecessor", [ID.coerceString(id)])
				.then(result => resolve(new RemoteNode(this.chord, new ID(result), null)),
					reason => reject(reason)
				);
		});
	}

	closestPrecedingFinger(id){
		return new Promise((resolve, reject) => {
			this.chord.rcm.call(this.id, "closestPrecedingFinger", [ID.coerceString(id)])
				.then(result => resolve(new RemoteNode(this.chord, new ID(result), null)),
					reason => reject(reason)
				);
		});
	}

	notify(nPrime){
		return this.chord.rcm.call(this.id, "notify", [ID.coerceString(nPrime.id)]);
	}

	//Custom

	message(id, msg){
		if(this.connection
			&& this.connection.connection
			&& (this.connection.connection.iceConnectionState === "connected"
			|| this.connection.connection.iceConnectionState === "completed")
			)
			this.connection.send(JSON.stringify({id, data: msg}));
		else {
			console.log("Creating new connection - none found or not open.");

			this.chord.smartConnectToNode(this.id, this)
				.then(node => {
					node.message(id, msg);
				},
				reason => {
					console.log("Failed to create new connection to remote node.")
				});
		}
	}

	unlinkClient(idString){
		return this.chord.rcm.call(this.id, "unlinkClient", [idString]);
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