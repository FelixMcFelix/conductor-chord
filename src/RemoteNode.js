"use strict";

const Node = require("./Node.js");

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
				.then(result => resolve(result),
					reason => reject(reason)
				);
		});
	}

	setSuccessor(s){
		//TODO
		return new Promise((resolve, reject) => {
			chord.rcm.call(this.id, "setSuccessor", [])
				.then(result => resolve(result),
					reason => reject(reason)
				);
		});
	}

	getPredecessor(){
		//TODO
		return new Promise((resolve, reject) => {
			chord.rcm.call(this.id, "getPredecessor", [])
				.then(result => resolve(result),
					reason => reject(reason)
				);
		});
	}

	setPredecessor(p){
		//TODO
		return new Promise((resolve, reject) => {
			chord.rcm.call(this.id, "setPredecessor", [])
				.then(result => resolve(result),
					reason => reject(reason)
				);
		});
	}

	updateFingerTable(foreignId, index){
		//TODO
		return new Promise((resolve, reject) => {
			chord.rcm.call(this.id, "getSuccessor", [])
				.then(result => resolve(result),
					reason => reject(reason)
				);
		});
	}

	findSuccessor(id){
		//TODO
		return new Promise((resolve, reject) => {
			chord.rcm.call(this.id, "getSuccessor", [])
				.then(result => resolve(result),
					reason => reject(reason)
				);
		});
	}

	findPredecessor(id){
		//TODO
		return new Promise((resolve, reject) => {
			chord.rcm.call(this.id, "getSuccessor", [])
				.then(result => resolve(result),
					reason => reject(reason)
				);
		});
	}

	closestPreceedingFinger(id){
		//TODO
		return new Promise((resolve, reject) => {
			chord.rcm.call(this.id, "getSuccessor", [])
				.then(result => resolve(result),
					reason => reject(reason)
				);
		});
	}

	notify(nPrime){
		//TODO
		return new Promise((resolve, reject) => {
			chord.rcm.call(this.id, "getSuccessor", [])
				.then(result => resolve(result),
					reason => reject(reason)
				);
		});
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
			console.log("Creating new connection - none found or not open.")
			this.chord.conductor.connectTo(id)
				.then(result => {
					this.connection = result;

					result.on("message", msg => {
						let parsy = JSON.parse(msg.data)
						this.chord.message(parsy.id, parsy.data)
					});

					this.message(id, msg);
				},
				reason => {
					console.log("Failed to create new connection to remote node.")
				});
		}
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