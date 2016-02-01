"use strict";

const ModuleRegistry = require("./ModuleRegistry"),
	ID = require("./ID.js");

class RemoteCallable {
	constructor (chord, moduleid) {
		this.chord = chord;
		this.id = moduleid;

		//Modify these in your super classes if needed.
		this._rcTimeout = this.chord.config.remoteCall.timeout;
		this._rcRetries = this.chord.config.remoteCall.retries;
		this._rcCacheDuration = this.chord.config.remoteCall.cacheAnswerDuration;

		this._reqID = 0;
		this._requestSpace = {};
		this._answerCache = {};
	}

	call (id, method, params) {
		let reqID = this._reqID++,
			destID = ID.coerceString(id),
			msg = {
				params,
				reqID,
				returnID: this.chord.id.idString,
				_remoteNo: 1
			},
			msgText = ModuleRegistry.wrap(this.id, method, msg);

		return new Promise((resolve, reject) => {
			this._requestSpace[reqID] = {
				reqID,
				destID,
				method,
				msg,
				resolve,
				reject,
				triesLeft: this._rcRetries,
				timeout: this.setupTimeoutForRequest(this._requestSpace[reqID], this._rcTimeout)
			};

			this.chord.message(destID, msgText);
		});
	}

	delegate (handler, message) {
		let handled = true;
		switch (handler) {
			case "answer":
				this._rcvAnswer(message);
				break;
			case "error":
				this._rcvError(message);
			default:
				//Traffic is either not ours,
				//or is a remote call.
				//existence (or non-existence) of _remote
				//will tell us which (answered) calls to check for.
				if(message._remote
					&& message.returnID in this._answerCache
					&& message.reqID in this._answerCache[message.returnID]) {

					//We know the answer to this lucky soul's request!
					this.answer(message.returnID, message.reqID, this._answerCache[message.returnID][message.reqID]);

				} else {
					//Not ours, pass it by.
					handled = false;
				}
				break;
		}
		return handled;
	}

	_rcvAnswer (message) {
		if(message.returnID === this.chord.id.idString){
			this._requestSpace[message.reqID].resolve(message.result);
			delete this._requestSpace[message.reqID];
		} else {
			this.bypassAnswer(message);
		}
	}

	_rcvError (message) {
		//If retries on the call is zero, then reject.
		//Else? Retry, decrement the counter if error matches the packet we sent.
		let myReqStore = this._requestSpace[message.reqID];

		//Make sure we're responding to a genuine request here folks.
		if(myReqStore && message.returnID && message.returnID === this.chord.id.idString){
			
			if(myReqStore.triesLeft === 0){
				//No tries left, be doen with this!
				myReqStore.reject(message.reason);
				delete this._requestSpace[message.reqID];

			} else if (message._remoteNo > this._rcRetries - myReqStore.triesLeft) {
				//Packet is not an earlier error.
				//I.e. its _remoteNo > maxRetries - remRetries
				clearTimeout(myReqStore.timeout);

				//Set up for next attempt.
				myReqStore.msg._remoteNo++;
				myReqStore.triesLeft--;
				myReqStore.timeout = this.setupTimeoutForRequest(myReqSpace, this._rcTimeout);

				//Try, try again.
				this.chord.message(myReqSpace.destID, ModuleRegistry.wrap(this.id, myReqStore.method, myReqStore.msg));
			}

		} else {
			//Try and route it to its rightful owner?
			this.bypassError(message);
		}
	}

	setupTimeoutForRequest (requestSpaceEntry, duration) {
		return setTimeout(()=>this._rcvError({
			reason: "Timed out.",
			reqID: requestSpaceEntry.reqID,
			returnID: requestSpaceEntry.msg.returnID,
			_remoteNo: requestSpaceEntry.msg._remoteNo

		}), duration);
	}

	_cacheAnswer (returnID, reqID, result) {
		//Store.
		if(!(returnID in this._answerCache))
			this._answerCache[returnID] = {};
		this._answerCache[returnID][reqID] = result;
		//Set up the answer's deletion later.
		setTimeout( () => {
			delete this._answerCache[returnID][reqID];
		}, this._rcCacheDuration)
	}

	answer (message, result) {
		//Place into answer cache.
		let returnID = message.returnID,
			reqID = message.reqID,
			_remoteNo = message._remoteNo;

		this._cacheAnswer(returnID, reqID, result);
		this.chord.message(returnID, ModuleRegistry.wrap(this.id, "answer", {reqID, result, returnID, _remoteNo, hops: 5}));
	}

	error (message, reason) {
		this.chord.message(message.returnID, ModuleRegistry.wrap(this.id, "error", {
			reqID: message.reqID, reason, returnID: message.returnID, _remoteNo: message._remoteNo, hops: 10
		}));
	}

	bypassAnswer (answerObj) {
		answerObj.hops--;
		if(answerObj.hops)
			this.chord.message(answerObj.returnID, ModuleRegistry.wrap(this.id, "answer", answerObj), true);
		else
			this.error(answerObj.returnID, answerObj.reqID, `Answer was lost - failed to route.`);
	}

	bypassError (errorObj) {
		errorObj.hops--;
		if(errorObj.hops)
			this.chord.message(errorObj.returnID, ModuleRegistry.wrap(this.id, "error", errorObj), true);
	}
}

module.exports = RemoteCallable;