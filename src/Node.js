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

	setFinger(index, node){
		//Set the node, and then check further indices to see if this node is a better fit.
		//Improvement over std chord.
		do {
			this.finger[index++].node = node;
		} while(index<this.finger.length
			&& ID.inRightOpenBound(node.id, this.finger[index].start, this.finger[index].node.id));
	}

	removeFinger(id){
		//Scan right to left for a block of fingers represented by this id.
		//Replace them all with the node found immediately to the right of the block.
		//If last element was removed, replace with self.
		//Improvement over std chord.

		let index = this.finger.length - 1,
			replace;

		while(index >=0){
			replace = (index === this.finger.length-1) ? this : this.finger[index+1].node;

			while(index >=0 && ID.compare(id, this.finger[index].node.id) === 0){
				this.finger[index].node = replace;

				index--;
			}

			index--;
		}
	}

	//Promise updated
	getSuccessor(){
		return new Promise((resolve, reject) => {
			resolve(this.finger[0].node)
		}); 
	}

	//Promise updated
	setSuccessor(val){
		return new Promise((resolve, reject) => {
			//this.finger[0].node = val;
			this.setFinger(0, val);
			resolve(val)
		});
	}

	//Promise updated
	getPredecessor(){
		return new Promise((resolve, reject) => {
			resolve(this.predecessor)
		}); 
	}

	//Promise updated
	setPredecessor(val){
		return new Promise((resolve, reject) => {
			this.predecessor = val;
			resolve(val);
		});
	}

	//Promise updated
	initOn(knownNode){
		this.chord.server.connect = true;
		if(knownNode){
			return this.initialiseFingerTable(knownNode)
				.then( () => {
					return this.updateOthers();
				} )
				.then( () => {
					this.chord.server.connect = false;
				} );
			//move keys from successor to self as well.
		} else {
			for(var i=0; i<chord.config.idwidth; i++)
				this.finger[i].node = this;
			this.predecessor = this;
			this.chord.server.connect = false;
			return Promise.resolve();
		}

	}

	//Promise updated
	initialiseFingerTable(knownNode){
		return knownNode.findSuccessor(this.finger[0].start)
			.then(
				succ => {return this.setSuccessor(succ);}
			)
			.then(
				succ => {return succ.getPredecessor();}
			)
			.then(
				pred => {return this.setPredecessor(pred);}
			)
			.then(
				() => {
					let proms = [];

					for(var i=0; i<this.finger.length-1; i++) {
						let p = (proms.length===0) ? Promise.resolve() : proms[proms.length-1],
							f = ((i)=>{
								return () => {
									if(ID.inRightOpenBound(this.finger[i+1].start, this.id, this.finger[i].node.id)){
										//this.finger[i+1].node = this.finger[i].node;
										this.setFinger(i+1, this.finger[i].node)
									} else {
										console.log(`Using new unknown node.`)
										proms.push(
											knownNode.findSuccessor(this.finger[i+1].start)
												.then(
													succ => {
														//this.finger[i+1].node = succ;
														this.setFinger(i+1, succ);
													}
												)
										)
									}
								};
							})(i);
						p.then(f);
					}

					return Promise.all(proms);
				}
			);
	}

	//Promise updated
	updateOthers(){
		//Inform other nodes about our existence.
		let proms = [];

		for (var i = 0; i < this.finger.length; i++) {
			//find last node p whose ith finger might be n
			(i=>{proms.push(
				this.findPredecessor(this.id.subtract(ID.powerOfTwoBuffer(i)))
					.then(
						p => {return p.updateFingerTable(this, i)}
					)
				)
			})(i);
		}

		return Promise.all(proms);
	}

	//Promise updated
	updateFingerTable(foreignNode, index){
		//Update the finger of some remote node
		if(ID.inRightOpenBound(foreignNode.id, this.id, this.finger[index].node.id)){
			//this.finger[index].node = foreignNode;
			this.setFinger(index, foreignNode);
			return this.getPredecessor()
				.then(
					res => {return res.updateFingerTable(foreignNode, index)}
				)
		} else {
			return Promise.resolve();
		}

	}
	
	//Promise updated
	closestPrecedingFinger(id){
		return new Promise( resolve => {
			for (var i = this.finger.length - 1; i >= 0; i--) {
				if(ID.inOpenBound(this.finger[i].node.id, this.id, id)){
					resolve(this.finger[i].node);
					break;
				}
			}
			resolve(this);
		} );
	}
	
	//Promise updated
	findSuccessor(id){
		return this.findPredecessor(id)
			.then( nPrime => { return nPrime.getSuccessor() } )
	}
	
	//Promise updated
	findPredecessor(id){
		return new Promise( (resolve, reject) => {
			let nPrime = this;

			let condUpd = () => {
				nPrime.getSuccessor()
					.then(
						succ => {
							if (!ID.inLeftOpenBound(id, nPrime.id, succ.id)) {
								nPrime.closestPrecedingFinger(id)
									.then(
										newPrime => {
											nPrime = newPrime;
											condUpd();
										},
										rea => reject(rea)
									)
							} else {
								resolve(nPrime);
							}
						},
						rea => reject(rea)
					)
				};

			condUpd();
		} )
	}

	//Stabilization methods
	//Promise updated
	stableJoin(knownNode){
		return this.setPredecessor(null)
			.then(
				() => {
					this.chord.server.connect = true;
					return knownNode.findSuccessor(this.id);
				}
			)
			.then(
				res => {
					return this.setSuccessor(res);
				}
			);
	}

	//periodically verify n's immediate successor
	//and tell the successor about n.
	//Promise updated
	stabilize(){
		let oSucc;

		u.log(this.chord, `ME:`);
		u.log(this.chord, this.id.idString);

		return this.getSuccessor()
			.then(succ => {
				oSucc = succ;
				u.log(this.chord, `MY SUCCESSOR:`);
				u.log(this.chord, succ.id.idString);
				return succ.getPredecessor();
			})
			.then(pred => {
				u.log(this.chord, `MY SUCCESSOR'S PREDECESSOR:`);
				u.log(this.chord, (pred) ? pred.id.idString : pred);

				if(pred && ID.inOpenBound(pred.id, this.id, oSucc.id)) {
					u.log(this.chord, `NEW SUCCESSOR FOUND`);
					return this.setSuccessor(pred);
				} else {
					return Promise.resolve();
				}
			})
			.then(
				res => {
					u.log(this.chord, `NOTIFYING SUCCESSOR ABOUT:`);
					u.log(this.chord, this.id.idString);
					return oSucc.notify(this);
				}
			)

	}

	//Promise updated
	notify(nPrime){
		u.log(this.chord, `NOTIFIED BY:`);
		u.log(this.chord, ID.coerceString(nPrime.id));

		if(this.predecessor === null || ID.inOpenBound(nPrime.id, this.predecessor.id, this.id))
			this.predecessor = nPrime;

		return Promise.resolve();
	}

	//Promise updated
	fixFingers(){
		let i = Math.floor(Math.random() * (this.finger.length-1) + 1);
		//this.finger[i].node = this.findSuccessor(this.finger[i].start);

		return this.findSuccessor(this.finger[i].start)
			.then(
				succ => this.setFinger(i, succ)//this.finger[i].node = succ
			)
	}

	//Custom
	
	message(id, msg){
		//TODO

		// debugger;

		u.log(this.chord, `Received message at the local node for ${id}: ${msg}
			I am ${this.id.idString}`);

		if(this.chord.server.connect && ID.compare(id, this.id)!== 0) {
			this.chord.server.node.message(id, msg);
		} else if (!this.predecessor && ID.compare(id, this.id)!== 0 ) {
			this.getSuccessor()
				.then(
					successor => successor.message(id, msg)
				)
		} else if (ID.compare(this.id, id)===0 || ID.inLeftOpenBound(id, this.predecessor.id, this.id)){
			//Pass to appropriate handler - this is our message.
			this.chord.registry.parse(msg);
		} else {
			//Pass along the chain to a responsible node.
			this.closestPrecedingFinger(id)
				.then(
					node => node.message(id, msg)
				)
		}
	}

	unlinkClient(idString){
		if(this.chord.config.isServer && this.chord.directNodes[idString]){
			delete this.chord.directNodes[idString];
			return true;
		}

		return false;
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
