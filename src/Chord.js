"use strict";

const u = require("./UtilFunctions.js"),
	ChordSignalChannel = require("./ChordSignalChannel.js"),
	BootstrapChannelClient = require("./BootstrapChannelClient.js"),
	BootstrapChannelServer = require("./BootstrapChannelServer.js"),
	ModuleRegistry = require("./ModuleRegistry.js"),
	RemoteCallModule = require("./RemoteCallModule.js"),
	FileStore = require("./FileStore.js"),
	MessageCore = require("./MessageCore.js"),
	Message = require("./Message.js"),
	Node = require("./Node.js"),
	RemoteNode = require("./RemoteNode.js"),
	ID = require("./ID.js"),
	sha3 = require("js-sha3"),
	pki = require("node-forge").pki,
	machina = require('machina'),
	Conductor = require("webrtc-conductor");


class ConductorChord {
	static get defaultConfig(){
		return {
			idWidth: 224,

			keyWidth: 2048,

			remoteCall: {
				timeout: 5000,
				retries: 2,
				cacheAnswerDuration: 20000
			},

			fileStore: {
				itemDuration: 30000,
				itemRefreshPeriod: 5000
			},

			messageMaxHops: 448,

			serverConfig: {
				port: 7171
			},

			conductorConfig: {
				channel: null,
				timeout: 0
			},

			stabilizeInterval: 1000,

			fixFingersInterval: 666,

			moveKeysInterval: 10000,

			checkPubKeyInterval: 2500,

			isServer: false,

			allowUpgrade: true,

			allowDowngrade: false,

			debug: false
		}
	};

	constructor(config){
		this.config = u.mergeConfig(ConductorChord.defaultConfig, config);
		u.log(this, "Config merged.");
		u.log(this, this.config);

		//Generate a public-private key combination, and store the public key in PEM format.
		u.log(this, "Generating RSA keys...");
		this.key = pki.rsa.generateKeyPair({bits: this.config.keyWidth, e: 0x10001});
		this.pubKeyPem = pki.publicKeyToRSAPublicKeyPem(this.key.publicKey);
		u.log(this, "Generated.");

		//Generate an ID on the network from this public key.
		u.log(this, "Generating ID from public key.");
		let idBuf = sha3["sha3_"+this.config.idWidth].buffer(this.pubKeyPem);
		this.id = new ID(idBuf);
		u.log(this, "ID created:");
		u.log(this, this.id.idString);

		//Set up a Node object to represent the local state.
		u.log(this, "Creating local node.");
		this.node = new Node(this);

		//Create a module registry, register the RPC default module.
		//Create file storage subsystem.
		u.log(this, "Establishing registry, core modules...");
		this.registry = new ModuleRegistry();
		this.rcm = new RemoteCallModule(this);
		this.fileStore = new FileStore(this);
		this.messageCore = new MessageCore(this);

		//Store the K,V pair <ID, pubKey> on the local view of the DHT.
		//This will be relocated once an actual network is joined.
		u.log(this, "Adding public key to local store.");
		this.addItem(this.id.idString, this.pubKeyPem);

		//Prepare the standard connection channel and an instance of Conductor:
		//(SignalChannel registers itself to the module registry)
		u.log(this, "Creating standard channel and conductor.");
		this.config.conductorConfig.channel = new ChordSignalChannel(this);
		this.conductor = Conductor.create(this.config.conductorConfig);

		//Set onconnection event to handle connections made to us.
		this.conductor.onconnection = conn => {
			conn.ondatachannel = dChan => {
				dChan.onmessage = msg => {
					let msgObj = this.messageCore.parseMessage(msg.data);
					if(msgObj)
						this.message(msgObj);
				};

				let node = this.obtainRemoteNode(conn.id);
				node.connection = conn; 
				this.directNodes[conn.id] = node;

				conn.ondisconnect = evt => {
					this.statemachine.disconnect(node);
				};

				this.statemachine.node_connection(node);
			}
		};

		//If this node is actually a server, load a background channel which will mediate requests to join the network.
		if(this.config.isServer){
			u.log(this, "Initialising server backing channel.");
			this.conductor.register(new BootstrapChannelServer(this));
			setInterval(this.node.stabilize.bind(this.node), this.config.stabilizeInterval);
			setInterval(this.node.fixFingers.bind(this.node), this.config.fixFingersInterval);
			setInterval(this.fileStore.relocateKeys.bind(this.fileStore), this.config.moveKeysInterval);
			setInterval(this._checkForID.bind(this), this.config.checkPubKeyInterval);
		}

		//space to store, well, external nodes - if you're a server, for instance.
		//This is also used for resource management and ring bypass.
		this.directNodes = {};
		this.knownNodes = {}; // nodes w/o connections
		this.server = {
			connect: false,
			node: null,
			address: null
		};

		u.log(this, "Creating state machine.");
		this.createStateMachine();

		if(this.config.debug) {
			try {
				window.chorddebug = this;
			} catch (e) {
				global.chorddebug = this;
			}
		}
	}

	smartConnectToNode(id, optNode) {
		if (Object.getOwnPropertyNames(this.directNodes).length === 0) {
			return this.join(this.server.address)
				.then( () => {
					return this.nodeOverRing(id, optNode);
				} );
		} else if (this.directNodes[ID.coerceString(id)]) {
			let entry = this.directNodes[ID.coerceString(id)];

			if(entry.isConnected())
				return Promise.resolve(this.directNodes[ID.coerceString(id)]);
			else
				return this.nodeOverRing(id, optNode);
		} else {
			return this.nodeOverRing(id, optNode);
		}
	}

	obtainRemoteNode(id){
		let saneID = ID.coerceString(id);

		if (saneID === this.id.idString) {
			return this.node;
		} else if (this.directNodes[saneID]) {
			return this.directNodes[saneID];
		} else if (this.knownNodes[saneID]) {
			return this.knownNodes[saneID];
		} else {
			let node = new RemoteNode(this, new ID(saneID), null);
			this.knownNodes[saneID] = node;
			return node;
		}
	}

	nodeOverRing(id, optNode){
		let saneId = ID.coerceString(id);

		return new Promise( (resolve, reject) => {
			this.conductor.connectTo(saneId, "Conductor-Chord")
				.then( conn => {
					let node = this.obtainRemoteNode(conn.id);

					if (optNode)
						optNode.connection = conn;
		
					node.connection = conn;

					if (!node.isConnected()) {
						node.connection.close();
						reject("Connection was closed - attempt to obtain link failed.");
					}

					conn.on("message", msg => {
						let msgObj = this.messageCore.parseMessage(msg.data);
						if(msgObj)
							this.message(msgObj);
					});

					conn.ondisconnect = evt => {
						this.statemachine.disconnect(node);
					};

					this.knownNodes[conn.id] = node;
					this.directNodes[conn.id] = node;

					if(ID.compare(conn.id, node.id) !== 0){
						delete this.directNodes[ID.coerceString(node.id)];
						node.id = new ID(conn.id)
					}

					this.statemachine.node_connection(node);

					resolve(node);
				} );
		} );
	}

	get state () {
		if(this.statemachine)
			return this.statemachine.state;
		return "disconnected";
	}

	createStateMachine () {
		let t = this;

		this.statemachine = new machina.Fsm({
			initialize: function(options) {
				//idk?
			},

			namespace: "chord-fsm",

			initialState: "disconnected",

			states: {
				disconnected: { 
					_onEnter() {
						//force predecessor and all fingers to be self...
						t.node.clean();

						if(t.config.isServer)
							this.transition("full_server");
					},

					node_connection(node) {
						this.transition("external");
					}
				},

				full_server: {
					_onEnter() {
						//set predecessor and successor to null
						t.node.predecessor = t.node;
						t.node.setFinger(0, t.node);
					},

					set_successor(node) {
						this.transition("partial");
					},
				},

				external: {
					_onEnter() {
						//set predecessor and successor to null
						this._lastPredec = t.node.predecessor;

						if(this._lastPredec !== null)
							this.transition("external_known")

						t.node.predecessor = t.node;
						t.node.setFinger(0, t.node);
						
						if(this.priorState !== "disconnected" && !t.config.isServer)
							t._finalResortReconnect();
					},

					set_successor(node) {
						this.transition("partial");
					},

					// set_predecessor(node) {
					// 	if(t.node.finger[0].node )
					// }

					disconnect_all() {
						this.transition("disconnected");
					}
				},

				external_known: {
					_onEnter() {
						//we're still known about - wait some time before trying to fully reconnect.
						t.node.predecessor = t.node;
						t.node.setFinger(0, t.node);

						this._fullReconnTime = setTimeout(()=>t._finalResortReconnect(), 5000);
					},

					_onExit() {
						 clearTimeout(this._fullReconnTime);
					},

					set_successor(node) {
						this.transition("partial");
					},

					// set_predecessor(node) {
					// 	if(t.node.finger[0].node )
					// }

					disconnect_all() {
						this.transition("disconnected");
					}
				},

				partial: {
					_onEnter() {
						//The server can be told about its predecessor BEFORE it knows it has a successor.
						//Check for this, and move if needed.

						if(t.node.predecessor && t.node.predecessor !== t.node)
							this.set_predecessor(t.node.predecessor);
					},

					set_predecessor(node) {
						this.transition("full_fragile");
					},

					disconnect_successor() {
						this.transition("external");
					},

					disconnect_all() {
						this.transition("disconnected");
					}
				},

				full_fragile: {
					_onEnter() {
						//Check for current status of successor list, if required.
						//TODO

						t.fileStore.relocateKeys();
					},

					set_predecessor (node) {
						t.fileStore.relocateKeys();
					},

					disconnect_successor() {
						this.transition("external");
					},

					disconnect_predecessor() {
						this.transition("partial");
					},

					disconnect_all() {
						this.transition("disconnected");
					}
				},

				full_stable: {
					//IGNORE THIS STATE FOR NOW!
					//Deal with it once 
					disconnect_predecessor() {
						this.transition("partial");
					},

					set_predecessor (node) {
						t.fileStore.relocateKeys();
					},

					disconnect_all() {
						this.transition("disconnected");
					}
				}
			},

			//Known events:
			//
			//"node_connection" - we have obtained a connection to a new node.
			//"set_successor" - successor has been (re)defined.
			//"set_predecessor" - predecessor has been (re)defined.
			//"disconnection" - used to determine the actual event to fire (in order of severity):
			//	-> "disconnect_all"
			//	-> "disconnect_successor"
			//	-> "disconnect_predecessor"
			//	-> "disconnect_backup"
			//	-> "disconnect"
			//"connect_backup" - backup successor has been identified and connected to.
			//
			//Finger table modification is handled in the disconnect handler,
			//it is noted that they do not affect the overall correctnesss of the system.
			node_connection(node) {
				this.handle("node_connection", node);
			},

			set_successor(node) {
				this.handle("set_successor", node);
			},

			set_predecessor(node) {
				this.handle("set_predecessor", node);
			},

			disconnect(node) {
				let evt = "disconnect",
					nodeID = ID.coerceString(node.id),
					leastFingerNo =  t.node.removeFinger(nodeID);

				if(t.directNodes[nodeID])
					delete t.directNodes[nodeID];

				//Check 1: was it a backup?
				//TODO

				// debugger;

				//Check 2: was it our predecessor?
				if(!t.node.predecessor || ID.coerceString(t.node.predecessor.id) === nodeID){
					evt = "disconnect_predecessor";
					t.node.predecessor = null;
				}

				//Check 3: was it our successor?
				if(leastFingerNo === 0)
					evt = "disconnect_successor";
				

				//Check 4: do we have ANY connections left?
				if(Object.getOwnPropertyNames(t.directNodes).length === 0)
					evt = "disconnect_all";

				this.handle(evt, node);
			},

			connect_backup(node) {
				this.handle("connect_backup", node);
			}
		});
	}

	join(addr){
		u.log(this, "Joining "+addr);

		let chan = new BootstrapChannelClient(addr, this);
		this.server.address = addr;

		return this.conductor.connectTo(this.id.idString, chan)
			.then(
				result =>{
					u.log(this, result);
					result.on("message", msg => {
						let msgObj = this.messageCore.parseMessage(msg.data);
						if(msgObj)
							this.message(msgObj);
					});

					let srvNode = new RemoteNode(this, new ID(result.id), result);

					result.ondisconnect = evt => {
						this.statemachine.disconnect(srvNode);
					};

					this.server.node = srvNode;
					this.directNodes[result.id] = srvNode;
					this.knownNodes[result.id] = srvNode;

					this.statemachine.node_connection(srvNode);

					return this.node.stableJoin(srvNode)
						.then(
							() => {return this.node.stabilize();}
						)
						.then(
							() => {
								return srvNode.unlinkClient();
							}
						)
						.then(
							() => {
								this.server.connect = false;
								setInterval(this.node.stabilize.bind(this.node), this.config.stabilizeInterval);
								setInterval(this.node.fixFingers.bind(this.node), this.config.fixFingersInterval);
								setInterval(this.fileStore.relocateKeys.bind(this.fileStore), this.config.moveKeysInterval);
								setInterval(this._checkForID.bind(this), this.config.checkPubKeyInterval);
							}
						)
				},
				reason => u.log(this, reason)
				);
	}

	addItem(key, value){
		return this.fileStore.store(key, value);
	}

	lookupItem(key){
		return this.fileStore.retrieve(key);
	}

	updateItem (key, value) {
		return this.fileStore.update(key, value);
	}

	message(msg){
		if(!(msg instanceof Message))
			return;

		msg.hops--;
		if(msg.hops<=0)
			return null;

		u.log(this, `Received message at the chord for ${msg.dest}: ${msg.data}`);

		if(this.directNodes[msg.dest])
			this.directNodes[msg.dest].message(msg);
		else
			this.node.message(msg);
	}

	registerModule(module){
		this.registry.register(module);
	}

	newMessage (module, handler, data, dest) {
		return new Message(this, 0, {src: this.id, dest, module, handler, data, hops: this.config.messageMaxHops});
	}

	sendNewMessage (module, handler, data, dest) {
		let m = this.newMessage(module, handler, data, dest);

		if(m)
			this.message(m);
	}

	_checkForID () {
		if (this.state.substr(0,5)!=="full_")
			return;

		u.log(this, "[CHORD]: Checking to see if own public key is still accessible...");

		this.lookupItem(this.id.idString)
			.then(
				result => {
					if (result!==this.pubKeyPem) {
						u.log(this, "[CHORD]: Public key could not be found - readding...");
						this.addItem(this.id.idString, this.pubKeyPem);
					} else {
						u.log(this, "[CHORD]: Public key still accessible.");
					}
				}
			)
	}

	_finalResortReconnect () {
		let nodeIdList = Object.getOwnPropertyNames(this.directNodes);

		if(nodeIdList.length < 1)
			return;

		let chosen = this.directNodes[nodeIdList[0]]

		return this.node.stableJoin(chosen)
			.then(
				() => {return this.node.stabilize();}
			)
	}
}

module.exports = ConductorChord;