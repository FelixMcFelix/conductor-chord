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
				reqID
			});

		this.chord.message(id, msgText);

		return new Promise((resolve, reject) => {
			requestSpace[reqID] = {resolve, reject};
		});
	}

	delegate(handler, message){
		switch(handler){
			case "getSuccessor":
				break;
			case "setSuccessor":
				break;
			case "getPredecessor":
				break;
			case "setPredecessor":
				break;
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
				this.requestSpace[message.id].resolve(message.result);
				delete this.requestSpace[message.id];
				break;
			case "error":
				this.requestSpace[message.id].reject(message.reason);
				delete this.requestSpace[message.id];
				break;
			default:
				//ILLEGAL CALL
				break;
		}
	}
}

module.exports = RemoteCallModule;