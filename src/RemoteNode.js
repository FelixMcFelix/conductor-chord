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
				.then(result => resolve((result)? this.chord.obtainRemoteNode(result) : result),
					reason => reject(reason)
				);
		});
	}

	getPredecessor(){
		//Return an ID, then create a remotenode from that.
		return new Promise((resolve, reject) => {
			this.chord.rcm.call(this.id, "getPredecessor", [])
				.then(result => resolve((result)? this.chord.obtainRemoteNode(result) : result),
					reason => reject(reason)
				);
		});
	}

	findSuccessor(id){
		return new Promise((resolve, reject) => {
			this.chord.rcm.call(this.id, "findSuccessor", [ID.coerceString(id)])
				.then(result => resolve(this.chord.obtainRemoteNode(result)),
					reason => reject(reason)
				);
		});
	}

	findPredecessor(id){
		return new Promise((resolve, reject) => {
			this.chord.rcm.call(this.id, "findPredecessor", [ID.coerceString(id)])
				.then(result => resolve(this.chord.obtainRemoteNode(result)),
					reason => reject(reason)
				);
		});
	}

	closestPrecedingFinger(id){
		return new Promise((resolve, reject) => {
			this.chord.rcm.call(this.id, "closestPrecedingFinger", [ID.coerceString(id)])
				.then(result => resolve(this.chord.obtainRemoteNode(result)),
					reason => reject(reason)
				);
		});
	}

	notify(nPrime){
		return this.chord.rcm.call(this.id, "notify", [ID.coerceString(nPrime.id)]);
	}

	//Custom

	message(msg){
		if(this.isConnected())
			this.connection.send(this.chord.messageCore.encodeMessage(msg));
		else {
			console.log(`Creating new connection to ${ID.coerceString(this.id)} - none found or not open.`);

			this.chord.smartConnectToNode(this.id, this)
				.then(node => {
					this.chord.message(msg);
				},
				reason => {
					console.log("Failed to create new connection to remote node.")
				});
		}
	}

	isConnected() {
		return this.connection
			&& this.connection.connection
			&& (this.connection.connection.iceConnectionState === "connected"
			|| this.connection.connection.iceConnectionState === "completed");
	}

	unlinkClient(idString){
		return this.chord.rcm.call(this.id, "unlinkClient", [idString]);
	}

}

module.exports = RemoteNode;