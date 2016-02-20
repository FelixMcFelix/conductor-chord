"use strict";

const RemoteCallable = require("./RemoteCallable.js"),
	ID = require("./ID.js"),
	sha3 = require("js-sha3"),
	pki = require("node-forge").pki,
	random = require("node-forge").random,
	cipher = require("node-forge").cipher,
	forgeUtil = require("node-forge").util;

const STORE_OKAY = 0,
	FILE_EXISTS = 1,
	BAD_UPDATE = 2,
	UPDATE_OKAY = 4,
	NO_FILE = 5,
	KEEPALIVE_OKAY = 6;

class FileStore extends RemoteCallable {
	constructor (chord) {
		super(chord, "ChordFS")
		this.storage = {};
		this.ownedObjects = {};

		chord.registerModule(this);
	}

	delegate (message) {
		if(super.delegate(message))
			return;

		switch (message.handler) {
			case "store":
				this._authStore(message.data.params[0], message.data.params[1], message.data.params[2])
					.then(
						response => this.answer(message, response)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "retrieve":
				this.retrieve(message.data.params[0])
					.then(
						response => this.answer(message, response)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "update":
				this._rcvUpdate(message.data.params)
					.then(
						response => this.answer(message, response)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "keepAlive":
				this._rcvKeepAlive(message.data.params[0])
					.then(
						response => this.answer(message, response)
					)
					.catch(
						reason => this.error(message, reason)
					);
				break;
			case "pubReq":
				this.answer(message, {i:ID.coerceString(this.chord.id), k:this.pubKeyPem});
				break;
			case "moveKey":
				this.answer(message, this._moveKey(params));
			default:
				break;
		}
	}

	store (key, value) {
		return this._authStore(key, value, this.chord.pubKeyPem)
			.then(
				result => {
					switch (result.code) {
						case STORE_OKAY:
							//Try to decrypt the AES key.
							let newKey;
							try {
								newKey = this.chord.key.privateKey.decrypt(result.encKey, "RSA-OAEP");
							} catch (e) {
								throw new Error("CFS: Couldn't decrypt ownership AES.");
							}

							//Store a reference to the owned object.
							//Create a regular event to ping the item to keep it alive.
							this.storeOwnershipKey(key, newKey, result.seq, result.lHash)

							break;
						case FILE_EXISTS:
							break;
					}

					return Promise.resolve(result);
				}
			);
	}

	_authStore (key, value, pubKeyPem) {
		let hash = sha3["sha3_"+this.chord.config.idWidth].buffer(key),
			hashStr = ID.coerceString(new ID(hash)),
			presentObj = this.storage[hashStr];

		//If we are indeed the successor to this node, store it.
		//Otherwise send this message abroad.

		//Computation of the hash MUST be determined at the node responsible for storage,
		//to prevent unbalanced/incorrect storage and related attacks.

		//If an object exists here, rebuff the requester...

		if(presentObj)
			return Promise.resolve({code: FILE_EXISTS, kHash: hashStr, seq: presentObj.seq, lHash: presentObj.lHash});

		let internalObj = {
			key,
			data: (typeof value === "string") ? value : JSON.stringify(value),
			wasStr: typeof value === "string",
			lHash: ID.coerceString(new ID(sha3["sha3_"+this.chord.config.idWidth].buffer(value))),
			aesKey: random.getBytesSync(16),
			seq: 0
		},
			//Prepare the ownership aes key so that only the sender can access the item.
			cryptor = pki.publicKeyFromPem(pubKeyPem),
			securedKey = cryptor.encrypt(internalObj.aesKey, "RSA-OAEP");
			
		if(!this.chord.node.predecessor || ID.inLeftOpenBound(hash, this.chord.node.predecessor.id, this.chord.node.id)){
			//Store the item
			this.storage[hashStr] = internalObj;

			//Set a timeout so that the object will be killed if no user desires that it stays alive.
			internalObj.timeout = setTimeout(()=>{
				delete this.storage[hashStr];
			}, this.chord.config.fileStore.itemDuration);

			return Promise.resolve({code: STORE_OKAY, kHash: hashStr, seq: internalObj.seq, lHash: internalObj.lHash, encKey: securedKey});
		} else {
			return this.call(hashStr, "store", [key, value, this.chord.pubKeyPem]);
		}	
	}

	update (key, value, stopHere) {
		let hash = sha3["sha3_"+this.chord.config.idWidth].buffer(key),
			hashStr = ID.coerceString(new ID(hash)),
			currentObj = this.ownedObjects[hashStr];

		if(!currentObj)
			return Promise.reject("CFS: Cannot update item - not owned.");

		let encData = FileStore.encrypt(JSON.stringify({h:currentObj.lHash, s: currentObj.seq}), currentObj.aesKey)

		return this.call(hashStr, "update", [key, value, encData.data, encData.iv, encData.tag])
			.then(
				result => {
					//update seq, lHash...
					if (result.code !== NO_FILE) {
						currentObj.seq = result.seq;
						currentObj.lHash = result.lHash;
					}

					switch (result.code) {
						case UPDATE_OKAY:
							break;
						case NO_FILE:
							//Not a whole lot we can do here?
							break;
						case BAD_UPDATE:
							//run another, identical call now that we have updated seq and
							//lHash. If this fails, then I guess you never had rights?
							if(stopHere)
								return this.update(key, value, true);
							break;
					}

					return Promise.resolve(result);
				}
			)
	}

	_rcvUpdate (params) {
		let key = params[0],
			value = params[1],
			authStr = params[2],
			iv = params[3],
			tag = params[4],
			hash = sha3["sha3_"+this.chord.config.idWidth].buffer(key),
			hashStr = ID.coerceString(new ID(hash)),
			presentObj = this.storage[hashStr];

		if (!presentObj) {
			return Promise.resolve({code: NO_FILE});
		}

		try {
			let out = JSON.parse(FileStore.decrypt(authStr, presentObj.aesKey, iv, tag));
			
			if (!out)
				throw new Error("Error decoding auth-string.");

			//Now, check lHash and seq.
			//If they match, update was a success.
			if(out.s < presentObj.seq || out.h !== presentObj.lHash)
				throw new Error("seq or lHash did not match expected value!");

			//Okay, we have a match!
			this.storage[hashStr] = {
				key,
				data: (typeof value === "string") ? value : JSON.stringify(value),
				wasStr: typeof value === "string",
				lHash: ID.coerceString(new ID(sha3["sha3_"+this.chord.config.idWidth].buffer(value))),
				aesKey: presentObj.aesKey,
				seq: out.s+1
			};

			return Promise.resolve({code: UPDATE_OKAY, seq: this.storage[hashStr].seq, lHash: this.storage[hashStr].lHash});

		} catch (e) {
			return Promise.resolve({code: BAD_UPDATE, seq: presentObj.seq, lHash: presentObj.lHash});
		}

	}

	keepAlive (key) {
		let hash = sha3["sha3_"+this.chord.config.idWidth].buffer(key),
			hashStr = ID.coerceString(new ID(hash));

		return this.call(hashStr, "keepAlive", [key]);
	}

	_rcvKeepAlive (key) {
		let hash = sha3["sha3_"+this.chord.config.idWidth].buffer(key),
			hashStr = ID.coerceString(new ID(hash)),
			presentObj = this.storage[hashStr];

		if (presentObj) {
			//Clear old timeout ASAP...
			if (presentObj.timeout)
				clearTimeout(presentObj.timeout);

			//And set a new one!
			presentObj.timeout = setTimeout(()=>{
				delete this.storage[hashStr];
			}, this.chord.config.fileStore.itemDuration);

			return Promise.resolve({code: KEEPALIVE_OKAY});
		} else {
			return Promise.resolve({code: NO_FILE});
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

	storeOwnershipKey (key, aesKey, optSeq, optlHash) {
		let hash = sha3["sha3_"+this.chord.config.idWidth].buffer(key),
			keyHash = ID.coerceString(new ID(hash)),
			failureCount = 0;

		this.ownedObjects[keyHash] = {
			aesKey,
			seq: optSeq ? optSeq : 0,
			lHash: optlHash ? optlHash : "AA==",
			interval: setInterval(() => {
				this.keepAlive(key)
				.then(
					result => {
						switch(result.code){
							case KEEPALIVE_OKAY:
								//Everything is fine?
								failureCount = 0;
								break;
							case NO_FILE:
								//File was not found?
								failureCount++;
								if (failureCount > 6) {
									//DELETE OWNERSHIP
									this.dropOwnership(key);
								}
								break;
						}
					}
				);
			}, this.chord.config.fileStore.itemRefreshPeriod)
		};
	}

	dropOwnership (key) {
		let hash = sha3["sha3_"+this.chord.config.idWidth].buffer(key),
			keyHash = ID.coerceString(new ID(hash)),
			obj = this.ownedObjects[keyHash];

		if (obj) {
			if(obj.interval) {
				clearInterval(obj.interval);
			}

			delete this.ownedObjects[keyHash];
		}
	}

	relocateKeys () {
		if (this.chord.state.substr(0,5)!=="full_")
			return;

		for (var hash in this.storage) {
			//Safety check, and do we own this item?
			if(!this.storage.hasOwnProperty(hash)
				|| ID.inLeftOpenBound(hash, this.chord.node.predecessor.id, this.chord.node.id))
				continue;

			//Apparently not - let's get to work!
			this.call(hash, "pubReq", [])
				.then(
					result => {
						let retID = result.i,
							cryptor = cryptor = pki.publicKeyFromPem(result.k),
							internalObj = this.storage[hash],
							securedKey;

						if (internalObj) {
							securedKey = cryptor.encrypt(internalObj.aesKey, "RSA-OAEP");
							return this.call(retID, "moveKey", [internalObj.key, internalObj.data, internalObj.wasStr, internalObj.seq, internalObj.lHash, securedKey])
								.then(
									result => {if (result) delete this.storage[hash];}
								);
						}
					}
				);
		}
	}

	_moveKey (params) {
		let itemKey = params[0],
			data = params[1],
			wasStr = params[2],
			seq = params[3],
			lHash = params[4],
			secureKey = params[5];

		//Decrypt the secret, just for us.
		//This ensures current owners can still update their stuff.
		let secret = this.chord.key.privateKey.decrypt(result.encKey, "RSA-OAEP");

		//Now take the hash of the item's key...
		let hash = sha3["sha3_"+this.chord.config.idWidth].buffer(key),
			hashStr = ID.coerceString(new ID(hash)),
			presentObj = this.storage[hashStr];

		if (presentObj)
			return false;

		this.storage[hashStr] = {
			key: itemKey,
			data,
			wasStr,
			seq,
			lHash,
			aesKey: secret
		}

		return true;
	}

	static encrypt (data, aesKey) {
		let iv = random.getBytesSync(12),
			cipherObj = cipher.createCipher('AES-GCM', aesKey);

		cipherObj.start({
			iv,
			additionalData: 'binary-encoded string',
			tagLength: 128
		});

		cipherObj.update(forgeUtil.createBuffer(data));
		cipherObj.finish();

		return {iv, data: cipherObj.output.data, tag: cipherObj.mode.tag.data};
	}

	static decrypt (cipherText, aesKey, iv, tag) {
		let decipher = cipher.createDecipher('AES-GCM', aesKey);

		decipher.start({
			iv,
			additionalData: 'binary-encoded string',
			tagLength: 128,
			tag: tag
		});

		decipher.update(forgeUtil.createBuffer(cipherText));
		let success = decipher.finish();

		return (success) ? decipher.output.data : null;
	}
}

module.exports = FileStore;