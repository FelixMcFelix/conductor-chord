"use strict";

const u = require("./UtilFunctions.js"),
	ID = require("./ID.js"),
	Finger = require("./Finger.js");

class Node{
	constructor(chord){
		this.id = chord.id;
		this.chord = chord;
		this.finger = [];
		this.predecessor = this;

		//Create Finger Table
		for(var i=0; i<chord.config.idWidth; i++)
			this.finger[i] = new Finger(this, i);
	}

	clean () {
		this.predecessor = this;

		//Wipe the finger table
		for(var i=0; i<this.finger.length; i++)
			this.finger[i].node = this;
	}

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
			replace,
			last = index;

		while(index >=0){
			replace = (index === this.finger.length-1) ? this : this.finger[index+1].node;

			while(index >=0 && ID.compare(id, this.finger[index].node.id) === 0){
				last = index;
				this.finger[index].node = replace;

				index--;
			}

			index--;
		}

		return last;
	}

	preserveFingerInvariant(){
		//We can observe that the largest value for any node in the finger table is our predecessor.
		//This property is required for correctness of the system to hold.

		for (var i = 0; i < this.finger.length; i++) {
			let finger = this.finger[i];

			if(this.predecessor && ID.inLeftOpenBound(finger.node.id, this.id, this.predecessor.id))
				finger.node = this.predecessor;

		};
	}

	getSuccessor(){
		return new Promise((resolve, reject) => {
			resolve(this.finger[0].node)
		}); 
	}

	setSuccessor(val){
		return new Promise((resolve, reject) => {
			let end = () => {
				this.setFinger(0, val);
				this.chord.statemachine.set_successor(val);
				resolve(val);
			}

			if(!val.isConnected || val.isConnected())
				end();
			else {
				this.chord.nodeOverRing(ID.coerceString(val.id), val)
					.then(
						() => end()
					)
			}
			
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

			this.preserveFingerInvariant();

			this.chord.statemachine.set_predecessor(val);

			resolve(val);
		});
	}
	
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
	
	findSuccessor(id){
		return this.findPredecessor(id)
			.then( nPrime => { return nPrime.getSuccessor() } )
	}
	
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
	stableJoin(knownNode){
		let succ;

		return this.setPredecessor(null)
			.then(
				() => {
					this.chord.server.connect = true;
					return knownNode.findSuccessor(this.id);
				}
			)
			.then(
				foundSucc => {
					succ = foundSucc;
					return this.chord.nodeOverRing(ID.coerceString(succ.id), succ);
				}
			)
			.then(
				conn => {
					return this.setSuccessor(succ);
				}
			);
	}

	//periodically verify n's immediate successor
	//and tell the successor about n.
	stabilize(){
		let oSucc;

		// if(this.chord.state === "disconnected" || this.chord.state === "external")
		// 	return;

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

				if(pred){
					u.log(this.chord, `x: ${ID.coerceString(pred.id)}`);
					u.log(this.chord, `LB: ${ID.coerceString(this.id)}`);
					u.log(this.chord, `UB: ${ID.coerceString(oSucc.id)}`);
					u.log(this.chord, `x in (UB, LB): ${ID.inOpenBound(pred.id, this.id, oSucc.id)}`);
				}

				if(pred && ID.inOpenBound(pred.id, this.id, oSucc.id)) {
					u.log(this.chord, `NEW SUCCESSOR FOUND`);
					oSucc = pred;
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

	notify(nPrime){
		u.log(this.chord, `NOTIFIED BY:`);
		u.log(this.chord, ID.coerceString(nPrime.id));

		if(this.predecessor === null || ID.inOpenBound(nPrime.id, this.predecessor.id, this.id))
			return this.setPredecessor(nPrime);

		return Promise.resolve();
	}

	fixFingers(){
		let i = Math.floor(Math.random() * (this.finger.length-1) + 1);
		//this.finger[i].node = this.findSuccessor(this.finger[i].start);

		if(this.chord.state === "disconnected" || this.chord.state === "external")
			return;

		return this.findSuccessor(this.finger[i].start)
			.then(
				succ => this.setFinger(i, succ)//this.finger[i].node = succ
			)
	}

	//Custom
	
	message(msg){
		u.log(this.chord, `Received message at the local node for ${msg.dest}: ${msg.data}
			I am ${this.id.idString}`);

		u.log(this.chord, `!!! STATE: ${this.chord.state} !!!`)

		if(this.chord.state.substr(0,8) === "external" && ID.compare(msg.dest, this.id)!== 0) {
			let nodeIdList = Object.getOwnPropertyNames(this.chord.directNodes),
				chosen;

			if(nodeIdList.length === 0) {
				//Something went badly wrong, and the state machine got stuck.
				//Help it out a little?
				this.chord.statemachine.handle("disconnect_all");
			} else if(this.chord.server.node && this.chord.server.node.isConnected()){
				chosen = this.chord.server.node;
			} else {
				chosen = this.chord.directNodes[nodeIdList[0]];
			}

			if(chosen) {
				chosen.message(this.chord.messageCore.makeProxyMessage(msg, chosen.id))
			}

		} else if (this.chord.state === "partial" && ID.compare(msg.dest, this.id)!== 0 ) {
			this.getSuccessor()
				.then(
					successor => successor.message(this.chord.messageCore.makeProxyMessage(msg, successor.id))
				)
		} else if (!msg.bypass && (ID.compare(this.id, msg.dest)===0 || ID.inLeftOpenBound(msg.dest, this.predecessor.id, this.id))){
			//Pass to appropriate handler - this is our message.
			this.chord.messageCore.handleMessage(msg);
		} else {
			//Pass along the chain to a responsible node.
			this.closestPrecedingFinger(msg.dest)
			.then(
				dest => {
					if(dest===this){
						//Successor is likely inaccurate - the earlier checks determined that
						//the message was NOT for us.
						//Send to successor, it may know better.
						this.finger[0].node.message(msg);
					} else {
						dest.message(msg);
					}
				}
			)
		}
	}

	unlinkClient(idString){
		if(this.chord.config.isServer && this.chord.directNodes[idString]){
			// delete this.chord.directNodes[idString];
			return true;
		}

		return false;
	}
}

module.exports = Node;
