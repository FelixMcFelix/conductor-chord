"use strict";

const u = require("./UtilFunctions.js"),
	ChordSignalChannel = require("./ChordSignalChannel.js"),
	BootstrapChannelClient = require("./BootstrapChannelClient.js"),
	BootstrapChannelServer = require("./BootstrapChannelServer.js"),
	ModuleRegistry = require("./ModuleRegistry.js"),
	RemoteCallModule = require("./RemoteCallModule.js"),
	FileStore = require("./FileStore.js"),
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

			serverConfig: {
				port: 7171
			},

			conductorConfig: {
				channel: null
			},

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

		u.log(this, "Creating state machine.");
		this.createStateMachine();

		//Create a module registry, register the RPC default module.
		//Create file storage subsystem.
		u.log(this, "Establishing registry, core modules...");
		this.registry = new ModuleRegistry();
		this.rcm = new RemoteCallModule(this);
		this.fileStore = new FileStore(this);

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
					let parsy = JSON.parse(msg.data);
					this.message(parsy.id, parsy.data)
				};
				let node = this.obtainRemoteNode(conn.id);
				node.connection = conn; 
				this.directNodes[conn.id] = node;
			}
		};

		//If this node is actually a server, load a background channel which will mediate requests to join the network.
		if(this.config.isServer){
			u.log(this, "Initialising server backing channel.");
			this.conductor.register(new BootstrapChannelServer(this));
			setInterval(this.node.stabilize.bind(this.node), 1000);
			setInterval(this.node.fixFingers.bind(this.node), 666);
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
					let node;

					if (optNode) {
						node = optNode;
					} else {
						node = this.obtainRemoteNode(conn.id);
					}
					node.connection = conn;

					conn.on("message", msg => {
						let parsy = JSON.parse(msg.data);
						this.message(parsy.id, parsy.data);
					});

					conn.ondisconnect = evt => {
						this.node.removeFinger(conn.id);
						if(this.directNodes[conn.id])
							delete this.directNodes[conn.id];
					};

					this.directNodes[conn.id] = node;

					if(ID.compare(conn.id, node.id) !== 0){
						delete this.directNodes[ID.coerceString(node.id)];
						node.id = new ID(conn.id)
					}

					resolve(node);
				} )
				.catch( reason => reject(reason) );
		} );
	}

	get state () {
		if(this.statemachine)
			return this.statemachine.state;
		return "disconnected";
	}

	createStateMachine () {
		this.statemachine = new machina.Fsm({
			initialize: function (options) {
				//idk?
			},

			namespace: "chord-fsm",

			initialState: "disconnected",

			states: {
				disconnected: {

				},

				external: {

				},

				partial: {

				},

				full_fragile: {

				},

				full_stable: {

				}
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
						let parsy = JSON.parse(msg.data);
						this.message(parsy.id, parsy.data);
					});

					result.ondisconnect = evt => {
						this.node.removeFinger(result.id);
						if(this.directNodes[result.id])
							delete this.directNodes[result.id];
					};

					let srvNode = new RemoteNode(this, new ID(result.id), result);

					this.server.node = srvNode;
					this.directNodes[result.id] = srvNode;
					this.knownNodes[result.id] = srvNode;

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
								setInterval(this.node.stabilize.bind(this.node), 1000);
								setInterval(this.node.fixFingers.bind(this.node), 666);
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

	message(id, msg, bypass){
		console.log(`Received message at the chord for ${ID.coerceString(id)}: ${msg}`);

		if(this.directNodes[ID.coerceString(id)])
			this.directNodes[ID.coerceString(id)].message(id, msg);
		else
			this.node.message(id, msg, bypass);
	}

	registerModule(module){
		this.registry.register(module);
	}
}

module.exports = ConductorChord;