"use strict";

const u = require("./UtilFunctions.js"),
	ID = require("./ID.js");

class Node{
	constructor(chord, id){
		//TODO
		this.id = id;
		this.chord = chord;
	}

	get successor(){
		return this.fingerTable[0].node;
	}

	get predecessor(){
		//TODO
	}
	
	initialiseFingerTable(knownNode){
		//TODO
	}
	
	closestPreceedingFinger(id){
		//TODO
	}
	
	findSuccessor(id){
		//TODO
	}
	
	findPredecessor(id){
		//TODO
	}
	
	message(id, msg){
		//TODO
		if(ID.inLeftOpenBound(id, this.predecessor, this.id)){
			//TODO
		}
	}
	
	lookup(id){
		//TODO
	}
	
	add(id, value){
		//TODO
	}
}

module.exports = Node;
