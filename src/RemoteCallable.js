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
				_remoteNo: 1
			},
			msgText = ModuleRegistry.wrap(msg);

		return new Promise((resolve, reject) => {
			let myReqObj = {
				reqID,
				destID,
				method,
				msg,
				resolve,
				reject,
				triesLeft: this._rcRetries
			};

			myReqObj.timeout = this.setupTimeoutForRequest(myReqObj, this._rcTimeout);

			this._requestSpace[reqID] = myReqObj;

			this.chord.sendNewMessage(this.id, method, msgText, destID);
		});
	}

	delegate (message) {
		let handled = true;

		switch (message.handler) {
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
				if(message.data._remote
					&& message.src in this._answerCache
					&& message.data.reqID in this._answerCache[message.src]) {

					//We know the answer to this lucky soul's request!
					this.answer(message, this._answerCache[message.src][message.data.reqID]);

				} else {
					//Not ours, pass it by.
					handled = false;
				}
				break;
		}
		return handled;
	}

	_rcvAnswer (message) {
		let myReqStore = this._requestSpace[message.data.reqID];

		if(myReqStore && message.dest && message.dest === this.chord.id.idString){
			//CLEAR THE TIMEOUT ASAP.
			clearTimeout(myReqStore.timeout);

			this._requestSpace[message.data.reqID].resolve(message.data.result);
			delete this._requestSpace[message.data.reqID];
		} else {
			this.bypassAnswer(message);
		}
	}

	_rcvError (message) {
		//If retries on the call is zero, then reject.
		//Else? Retry, decrement the counter if error matches the packet we sent.
		let myReqStore = this._requestSpace[message.data.reqID];

		//Make sure we're responding to a genuine request here folks.
		if(myReqStore && message.dest && message.dest === this.chord.id.idString){
			
			if(myReqStore.triesLeft === 0){
				//No tries left, be doen with this!
				myReqStore.reject(message.data.reason);
				delete this._requestSpace[message.data.reqID];

			} else if (message.data._remoteNo > this._rcRetries - myReqStore.triesLeft) {
				//Packet is not an earlier error.
				//I.e. its _remoteNo > maxRetries - remRetries
				clearTimeout(myReqStore.timeout);

				//Set up for next attempt.
				myReqStore.msg._remoteNo++;
				myReqStore.triesLeft--;
				myReqStore.timeout = this.setupTimeoutForRequest(myReqStore, this._rcTimeout);

				//Try, try again.
				this.chord.sendNewMessage(this.id, myReqStore.method, ModuleRegistry.wrap(myReqStore.msg), myReqStore.destID);
			}

		} else {
			//Try and route it to its rightful owner?
			this.bypassError(message);
		}
	}

	setupTimeoutForRequest (requestSpaceEntry, duration) {
		return setTimeout(()=> {
			if(requestSpaceEntry) this._rcvError(
				{
					data:{
						reason: "Timed out.",
						reqID: requestSpaceEntry.reqID,
						_remoteNo: requestSpaceEntry.msg._remoteNo
					},
					dest: this.chord.id.idString
				} )
		}, duration);
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
		let returnID = message.src,
			reqID = message.data.reqID,
			_remoteNo = message.data._remoteNo;

		this._cacheAnswer(returnID, reqID, result);
		message.reply(this.chord.newMessage(this.id, "answer", ModuleRegistry.wrap({reqID, result, _remoteNo, hops: 5}), returnID));
	}

	error (message, reason) {
		let returnID = message.src,
			reqID = message.data.reqID,
			_remoteNo = message.data._remoteNo;

		message.reply(this.chord.newMessage(this.id, "error", ModuleRegistry.wrap({reqID, reason, _remoteNo, hops: 10}), returnID));
	}

	bypassAnswer (message) {
		message.data.hops--;
		if(message.hops){
			message.data = ModuleRegistry.wrap(message.data);
			message.pass();
		} else {
			this.error(message, `Answer was lost - failed to route.`);
		}
	}

	bypassError (message) {
		message.data.hops--;
		if(message.hops){
			message.data = ModuleRegistry.wrap(message.data);
			message.pass();
		}
	}
}

module.exports = RemoteCallable;