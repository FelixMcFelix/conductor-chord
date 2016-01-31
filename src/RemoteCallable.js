"use strict";

const ModuleRegistry = require("./ModuleRegistry"),
	ID = require("./ID.js");

class RemoteCallable {
	constructor (chord, moduleid) {
		this.chord = chord;
		this.id = moduleid;

		this.reqID = 0;
		this.requestSpace = {};
	}

	call (id, method, params) {
		let reqID = this.reqID++,
			destID = ID.coerceString(id),
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

	delegate (handler, message) {
		let handled = true;
		switch (handler) {
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
				handled = false;
				break;
		}
		return handled;
	}

	answer (returnID, reqID, result) {
		this.chord.message(returnID, ModuleRegistry.wrap(this.id, "answer", {reqID, result, returnID, hops: 5}));
	}

	error (returnID, reqID, result) {
		this.chord.message(returnID, ModuleRegistry.wrap(this.id, "error", {reqID, result, returnID, hops: 10}));
	}

	bypassAnswer (answerObj) {
		this.chord.message(answerObj.returnID, ModuleRegistry.wrap(this.id, "answer", answerObj), true);
	}
}

module.exports = RemoteCallable;