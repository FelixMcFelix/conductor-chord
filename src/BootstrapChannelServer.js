"use strict";

const msg_types = require("webrtc-conductor").enums,
	  WebSocketServer = require("ws").server;

class BootstrapChannelServer{
	constructor(chord){
		this._manager = null;
		this.internalID = "Boot-Server";
		/* TODO */
	}

	onbind(){
		/* TODO */
	}

	send(id,type,data){
		/* TODO */
	}

	onmessage(msg){
		/* TODO */
	}

	close(){
		/* TODO */
	}
}

module.exports = BootstrapChannelServer;