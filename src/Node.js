"use strict";

const u = require("./UtilFunctions.js"),
	ID = require("./ID.js"),
	Finger = require("./Finger.js");

class Node{
	constructor(chord){
		//TODO
		this.id = chord.id;
		this.chord = chord;
		this.finger = [];
		this.predecessor = this;

		//Create Finger Table
		for(var i=0; i<chord.config.idWidth; i++)
			this.finger[i] = new Finger(this, i);
	}

	//NOTE:
	//These show the algorithms, but they do not account for RPC, promises, callbacks etc...
	//Redo these as time goes on.

	getSuccessor(){
		console.log(this);

		return new Promise((resolve, reject) => {
			resolve(this.finger[0].node)
		}); 
	}

	setSuccessor(val){
		return new Promise((resolve, reject) => {
			this.finger[0].node = val;
			resolve()
		});
	}

	getPredecessor(){
		return new Promise((resolve, reject) => {
			resolve(this.predecessor)
		}); 
	}

	setPredecessor(val){
		return new Promise((resolve, reject) => {
			this.predecessor = val;
			resolve();
		});
	}

	initOn(knownNode){
		if(knownNode){
			this.initialiseFingerTable(knownNode);
			this.updateOthers();
			//move keys from successor to self as well.
		} else {
			for(var i=0; i<chord.config.idwidth; i++)
				this.finger[i].node = this;
			this.predecessor = this;
		}

	}
	
	initialiseFingerTable(knownNode){
		this.finger[0].node = knownNode.findSuccessor(finger[0].start);
		this.predecessor = successor.predecessor;
		successor.predecessor = this;

		for(var i=0; i<this.finger.length-1; i++) {
			if(ID.inRightOpenBound(this.finger[i+1].start, this.id, this.finger[i].node.id))
				this.finger[i+1].node = this.finger[i].node;
			else
				this.finger[i+1].node = knownNode.findSuccessor(this.finger[i+1].start);
		};
	}

	updateOthers(){
		//Inform other nodes about our existence.
		for (var i = 0; i < this.finger.length; i++) {
			//find last node p whose ith finger might be n
			let p = findPredecessor(this.id.subtract(ID.powerOfTwoBuffer(i)))
			p.updateFingerTable(this.id, i)
		};
	}

	updateFingerTable(foreignId, index){
		//Update the finger of some remote node
		if(ID.inRightOpenBound(foreignId, this.id, this.finger[index].node)){
			this.finger[index] = foreignID;
			let p = this.predecessor;
			p.updateFingerTable(foreignID, index);
		}
	}
	
	closestPreceedingFinger(id){
		for (var i = this.finger.length - 1; i >= 0; i--) {
			if(ID.inOpenBound(this.finger[i].node.id, this.id, id)){
				return this.finger[i].node;
			}
		};
		return this;
	}
	
	findSuccessor(id){
		let nPrime = this.findPredecessor(id);
		return nPrime.successor;
	}
	
	findPredecessor(id){
		let nPrime = this;
		while(!ID.inLeftOpenBound(id, nPrime, nPrime.successor)){
			nPrime = nPrime.closestPreceedingFinger(id);
		}
		return nPrime;
	}

	//Stabilization methods
	stableJoin(knownNode){
		return new Promise ( (resolve, reject) => {
			this.setPredecessor(null)
			.then(
				res => this.setSuccessor(knownNode)
			)
			.then(
				res => resolve(res),
				rea => reject(rea)
			)
		});
	
	}

	//periodically verify n's immediate successor
	//and tell the successor about n.
	stabilize(){
		let x = this.successor.predecessor;
		if(ID.inOpenBound(x.id, this.id, this.successor.id))
			this.successor = x;
		this.successor.notify(this);
	}

	notify(nPrime){
		if(this.predecessor === null || ID.inOpenBound(nPrime.id, this.predecessor.id, this.id))
			this.predecessor = nPrime;
	}

	fixFingers(){
		let i = Math.random() * (this.finger.length-1) + 1;
		this.finger[i].node = this.findSuccessor(this.finger[i].start);
	}

	//Custom
	
	message(id, msg){
		//TODO

		debugger;

		console.log(`Received message at the local node for ${id}: ${msg}
			I am ${this.id}`);

		if (!this.predecessor){
			this.getSuccessor()
				.then(
					result => result.message(id, msg)
					)
		} else if (ID.inLeftOpenBound(id, this.predecessor.id, this.id)){
			//Pass to appropriate handler - this is our message.
			this.chord.registry.parse(msg);
		} else {
			//Pass along the chain to a responsible node.
			this.closestPreceedingFinger(id).message(id, msg);
		}
	}

	// Item management
	
	lookup(id){
		//TODO
	}
	
	add(id, value){
		//TODO
	}
}

module.exports = Node;
