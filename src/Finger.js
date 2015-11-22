"use strict";

const ID = require("./ID.js");

class Finger{
	constructor(node, index){
		this.node = node;
		this.start = node.id.add(ID.powerOfTwoBuffer(index));
	}
}

module.exports = Finger;