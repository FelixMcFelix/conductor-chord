"use strict";

const ModuleRegistry = require("./ModuleRegistry"),
	RemoteNode = require("./RemoteNode.js"),
	ID = require("./ID.js");

class RemoteCallModule {
	constructor(chord){
		this.id = "ChordRPC";
		this.chord = chord;

		this.reqID = 0;
		this.requestSpace = {};

		chord.registerModule(this);
	}

	call(id, method, params){
		let reqID = this.reqID++,
			destID = (typeof id === "string") ? id : id.idString,
			msgText = ModuleRegistry.wrap(this.id, method, {
				params,
				reqID,
				returnID: this.chord.id.idString
			});

		this.chord.message(destID, msgText);

		return new Promise((resolve, reject) => {
			this.requestSpace[reqID] = {resolve, reject};
		});
	}

	delegate(handler, message){
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
				this.chord.node.closestPrecedingFinger(this.chord.obtainRemoteNode(message.params[0]))
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
			case "message":
				break;
			case "unlinkClient":
				this.answer(message.returnID,
					message.reqID,
					this.chord.node.unlinkClient(message.params[0])
				);
				break;
			case "lookup":
				break;
			case "add":
				break;
			case "answer":
				if(message.returnID === this.chord.id.idString){
					this.requestSpace[message.reqID].resolve(message.result);
					delete this.requestSpace[message.reqID];
				} else {
					this.bypassAnswer(message);
				}	
				break;
			case "error":
				this.requestSpace[message.reqID].reject(message.reason);
				delete this.requestSpace[message.reqID];
				break;
			default:
				//ILLEGAL CALL
				break;
		}
	}

	answer(returnID, reqID, result){
		this.chord.message(returnID, ModuleRegistry.wrap(this.id, "answer", {reqID, result, returnID, hops: 5}));
	}

	error(returnID, reqID, result){
		this.chord.message(returnID, ModuleRegistry.wrap(this.id, "error", {reqID, result, returnID, hops: 10}));
	}

	bypassAnswer(answerObj){
		this.chord.message(answerObj.returnID, ModuleRegistry.wrap(this.id, "answer", answerObj), true);
	}
}

module.exports = RemoteCallModule;