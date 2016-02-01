"use strict";

const RemoteCallable = require("./RemoteCallable.js"),
	ID = require("./ID.js"),
	sha3 = require("js-sha3");

class FileStore extends RemoteCallable {
	constructor (chord) {
		super(chord, "ChordFS")
		this.storage = {};

		chord.registerModule(this);
	}

	delegate (handler, message) {
		if(super.delegate(handler, message))
			return;

		switch (handler) {
			case "store":
				this.store(message.params[0], message.params[1])
					.then(
						response => this.answer(message, response)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "retrieve":
				this.retrieve(message.params[0])
					.then(
						response => this.answer(message, response)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			default:
				break;
		}
	}

	store (key, value) {
		let internalObj = {
				data: (typeof value === "string") ? value : JSON.stringify(value),
				wasStr: typeof value === "string"
			},
			hash = sha3["sha3_"+this.chord.config.idWidth].buffer(key),
			hashStr = ID.coerceString(new ID(hash));

		//If we are indeed the successor to this node, store it.
		//Otherwise send this message abroad.

		//Computation of the hash MUST be determined at the node responsible for storage,
		//to prevent unbalanced/incorrect storage and related attacks.

		if(!this.chord.node.predecessor || ID.inLeftOpenBound(hash, this.chord.node.predecessor.id, this.chord.node.id)){
			this.storage[hashStr] = internalObj;
			return Promise.resolve(true);
		} else {
			return this.call(hash, "store", [key, value]);
		}	
	}

	retrieve (key) {
		let hash = sha3["sha3_"+this.chord.config.idWidth].buffer(key),
			hashStr = ID.coerceString(new ID(hash)),
			maybeFile = this.storage[hashStr];

		if (maybeFile) {
			//We have this item, or at least a copy.
			let dat = maybeFile.wasStr ? maybeFile.data : JSON.parse(maybeFile.data);
			return Promise.resolve(dat);
		} else if (!this.chord.node.predecessor || ID.inLeftOpenBound(hash, this.chord.node.predecessor.id, this.chord.node.id)) {
			//We are responsible, but no copy was shown to exist.
			return Promise.resolve(null);
		} else {
			return this.call(hashStr, "retrieve", [key]);
		}
	}
}

module.exports = FileStore;