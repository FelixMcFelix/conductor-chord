"use strict";

const u = require("./UtilFunctions.js");

class Node{
	constructor(chord, id){
		//TODO
	}

	get successor(){
		return this.fingerTable[0].node;
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
	}
	
	lookup(id){
		//TODO
	}
	
	add(id, value){
		//TODO
	}
}

module.exports = Node;
