"use strict";

const ModuleRegistry = require("./ModuleRegistry");

class RemoteCallModule {
	constructor(chord){
		this.id = "ChordRPC";
		this.chord = chord;

		this.reqID = 0;
		this.requestSpace = {};
	}

	call(id, method, params){
		let reqID = this.reqID++,
			msgText = ModuleRegistry.wrap(this.id, method, {
				params,
				reqID,
				returnID: this.chord.id.idString
			});

		this.chord.message(id, msgText);

		return new Promise((resolve, reject) => {
			this.requestSpace[reqID] = {resolve, reject};
		});
	}

	delegate(handler, message){
		switch(handler){
			case "getSuccessor":
				this.chord.node.getSuccessor()
					.then(
						result => this.answer(message.returnID, message.reqID, result.id.idString)
					);
				break;
			case "setSuccessor":
				this.chord.node.setSuccessor()
					.then(
						result => this.answer(message.returnID, message.reqID, null)
					);
				break;
			case "getPredecessor":
				this.chord.node.getPredecessor()
					.then(
						result => this.answer(message.returnID, message.reqID, result.id.idString)
					);
				break;
			case "setPredecessor":
				this.chord.node.setPredecessor()
					.then(
						result => this.answer(message.returnID, message.reqID, null)
					);
			case "updateFingerTable":
				break;
			case "findSuccessor":
				break;
			case "findPredecessor":
				break;
			case "closestPreceedingFinger":
				break;
			case "notify":
				break;
			case "message":
				break;
			case "lookup":
				break;
			case "add":
				break;
			case "answer":
				this.requestSpace[message.reqID].resolve(message.result);
				delete this.requestSpace[message.reqID];
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
		this.chord.message(returnID, ModuleRegistry.wrap(this.id, "answer", {reqID, result}));
	}

	error(returnID, reqID, result){
		this.chord.message(returnID, ModuleRegistry.wrap(this.id, "error", {reqID, result}));
	}
}

module.exports = RemoteCallModule;