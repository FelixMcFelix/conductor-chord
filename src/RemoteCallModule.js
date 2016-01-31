"use strict";

const RemoteCallable = require("./RemoteCallable.js"),
	RemoteNode = require("./RemoteNode.js"),
	ID = require("./ID.js");

class RemoteCallModule extends RemoteCallable {
	constructor(chord){
		super(chord, "ChordRPC");
		chord.registerModule(this);
	}

	delegate (handler, message) {
		if(super.delegate(handler, message))
			return;

		switch(handler){
			case "getSuccessor":
				this.chord.node.getSuccessor()
					.then(
						result => this.answer(message.returnID, message.reqID, (result) ? result.id.idString : result)
					);
				break;
			case "setSuccessor":
				this.chord.node.setSuccessor(this.chord.obtainRemoteNode(message.params[0]))
					.then(
						result => this.answer(message.returnID, message.reqID, null)
					);
				break;
			case "getPredecessor":
				this.chord.node.getPredecessor()
					.then(
						result => this.answer(message.returnID, message.reqID, (result) ? result.id.idString : result)
					);
				break;
			case "setPredecessor":
				this.chord.node.setPredecessor(this.chord.obtainRemoteNode(message.params[0]))
					.then(
						result => this.answer(message.returnID, message.reqID, null)
					);
				break;
			case "updateFingerTable":
				this.chord.node.updateFingerTable(this.chord.obtainRemoteNode(message.params[0]), message.params[1])
					.then(
						result => this.answer(message.returnID, message.reqID, null)
					);
				break;
			case "findSuccessor":
				this.chord.node.findSuccessor(new ID(message.params[0]))
					.then(
						result => this.answer(message.returnID, message.reqID, result.id.idString)
					);
				break;
			case "findPredecessor":
				this.chord.node.findPredecessor(new ID(message.params[0]))
					.then(
						result => this.answer(message.returnID, message.reqID, result.id.idString)
					);
				break;
			case "closestPrecedingFinger":
				this.chord.node.closestPrecedingFinger(new ID(message.params[0]))
					.then(
						result => this.answer(message.returnID, message.reqID, result.id.idString)
					);
				break;
			case "notify":
				this.chord.node.notify(this.chord.obtainRemoteNode(message.params[0]))
					.then(
						result => this.answer(message.returnID, message.reqID, null)
					);
				break;
			case "unlinkClient":
				this.answer(message.returnID,
					message.reqID,
					this.chord.node.unlinkClient(message.params[0])
				);
				break;
			default:
				//ILLEGAL CALL
				break;
		}
	}
}

module.exports = RemoteCallModule;