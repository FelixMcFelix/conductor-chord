"use strict";

const u = require("./UtilFunctions.js"),
	  ChordSignalChannel = require("./ChordSignalChannel.js"),
	  BootstrapChannelClient = require("./BootstrapChannelClient.js"),
	  BootstrapChannelServer = require("./BootstrapChannelServer.js"),
	  Node = require("./Node.js"),
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
		this.node = new Node(this.id);
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

		//If this node is actually a server, load a background channel which will mediate requests to join the network.
		if(this.config.isServer){
			u.log(this, "Initialising server backing channel.");
			this.conductor.register(new BootstrapChannelServer(this));
		}
	}

	join(addr){
		//TODO
	}

	addItem(key, value){
		//TODO
	}

	addItemDirect(hash, value){
		//TODO
	}

	lookupItem(key){
		//TODO
	}

	message(id, msg){
		//TODO
	}

	registerModule(module){
		//TODO
	}
}

module.exports = ConductorChord;