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
						result => this.answer(message, (result) ? result.id.idString : result)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "setSuccessor":
				this.chord.node.setSuccessor(this.chord.obtainRemoteNode(message.data.params[0]))
					.then(
						result => this.answer(message, null)
					);
				break;
			case "getPredecessor":
				this.chord.node.getPredecessor()
					.then(
						result => this.answer(message, (result) ? result.id.idString : result)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "setPredecessor":
				this.chord.node.setPredecessor(this.chord.obtainRemoteNode(message.data.params[0]))
					.then(
						result => this.answer(message, null)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "updateFingerTable":
				this.chord.node.updateFingerTable(this.chord.obtainRemoteNode(message.data.params[0]), message.data.params[1])
					.then(
						result => this.answer(message, null)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "findSuccessor":
				this.chord.node.findSuccessor(new ID(message.data.params[0]))
					.then(
						result => this.answer(message, result.id.idString)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "findPredecessor":
				this.chord.node.findPredecessor(new ID(message.data.params[0]))
					.then(
						result => this.answer(message, result.id.idString)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "closestPrecedingFinger":
				this.chord.node.closestPrecedingFinger(new ID(message.data.params[0]))
					.then(
						result => this.answer(message, result.id.idString)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "notify":
				this.chord.node.notify(this.chord.obtainRemoteNode(message.data.params[0]))
					.then(
						result => this.answer(message, null)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "unlinkClient":
				this.answer(message, this.chord.node.unlinkClient(message.data.params[0]));
				break;
			default:
				//ILLEGAL CALL
				break;
		}
	}
}

module.exports = RemoteCallModule;