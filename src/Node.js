"use strict";

const u = require("./UtilFunctions.js");

class Node{
	constructor(chord, id){
		//TODO
	}

	get successor(){
		return this.fingerTable[0].node;
	}
}

module.exports = Node;