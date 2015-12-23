"use strict";

const u = require("./UtilFunctions.js"),
	ChordSignalChannel = require("./ChordSignalChannel.js"),
	BootstrapChannelClient = require("./BootstrapChannelClient.js"),
	BootstrapChannelServer = require("./BootstrapChannelServer.js"),
	ModuleRegistry = require("./ModuleRegistry.js"),
	RemoteCallModule = require("./RemoteCallModule.js"),
	Node = require("./Node.js"),
	RemoteNode = require("./RemoteNode.js"),
	ID = require("./ID.js"),
	sha3 = require("js-sha3"),
	pki = require("node-forge").pki,
	Conductor = require("webrtc-conductor");


class ConductorChord {
	static get defaultConfig(){
		return {
			idWidth: 224,

			keyWidth: 2048,

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
		u.log(this, "Created.");

		//Store the K,V pair <ID, pubKey> on the local view of the DHT.
		//This will be relocated once an actual network is joined.
		u.log(this, "Adding public key to local store.");
		this.addItem(this.id.idString, this.pubKeyPem);
		u.log(this, "Added.");

		//Prepare the standard connection channel and an instance of Conductor:
		u.log(this, "Creating standard channel and conductor.");
		this.config.conductorConfig.channel = new ChordSignalChannel(this);
		this.conductor = Conductor.create(this.config.conductorConfig);
		u.log(this, "Channel and conductor created? "+this.conductor!=null);

		//Set onconnection event to handle connections made to us.
		this.conductor.onconnection = conn => {
			conn.ondatachannel = dChan => {
				dChan.onmessage = msg => {
					// console.log(a);
					// dChan.send(a.data);
					let parsy = JSON.parse(msg.data);
					this.message(parsy.id, parsy.data)
				};
				this.externalNodes[conn.id] = new RemoteNode(this, new ID(conn.id), conn)
			}
		};

		//Create a module registry, register the RPC default module.
		this.registry = new ModuleRegistry();
		this.rcm = new RemoteCallModule(this);
		this.registerModule(this.rcm);

		//If this node is actually a server, load a background channel which will mediate requests to join the network.
		if(this.config.isServer){
			u.log(this, "Initialising server backing channel.");
			this.conductor.register(new BootstrapChannelServer(this));
		}

		//space to store, well, external nodes - if you're a server, for instance.
		this.externalNodes = {};
		this.server = {
			connect: false,
			node: null
		};
	}

	join(addr){
		u.log(this, "Joining "+addr);

		let chan = new BootstrapChannelClient(addr, this);

		this.conductor.connectTo(this.id.idString, chan)
			.then(
				result =>{
					u.log(this, result);
					result.on("message", msg => {
						let parsy = JSON.parse(msg.data);
						this.message(parsy.id, parsy.data);
					});

					let srvNode = new RemoteNode(this, new ID(result.id), result);

					this.server.node = srvNode;

					//Test chain of message handlers.
					// result.send(JSON.stringify({
					// 	id: result.id,
					// 	data: JSON.stringify({msg: "Hello!"})
					// }))

					this.node.stableJoin(srvNode)
						.then(
							x => {return srvNode.getSuccessor()}
						)
						.then(
							x => u.log(this, x)
						)

				},
				reason => u.log(this, reason)
				);
	}

	addItem(key, value){
		let hash = sha3["sha3_"+this.config.idWidth].buffer(key);
		this.addItemDirect(hash, value)
	}

	addItemDirect(hash, value){
		this.node.add(hash, value)
	}

	lookupItem(key){
		//should return a promise.

		let hash = sha3["sha3_"+this.config.idWidth].buffer(key);
		return this.lookupItemDirect(hash);
	}

	lookupItemDirect(id){
		return this.node.lookup(id);
	}

	message(id, msg){
		console.log(`Received message at the chord for ${ID.coerceString(id)}: ${msg}`);

		if(this.externalNodes[ID.coerceString(id)])
			this.externalNodes[ID.coerceString(id)].message(id, msg);
		else
			this.node.message(id, msg);
	}

	registerModule(module){
		this.registry.register(module);
	}
}

module.exports = ConductorChord;