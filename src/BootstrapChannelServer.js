"use strict";

const msg_types = require("webrtc-conductor").enums,
	  WebSocketServer = require("ws").server;

class BootstrapChannelServer{
	constructor(chord){
		this._manager = null;
		this.internalID = "Boot-Server";
		this.wss = null;
		this.chord = chord;
	}

	onbind(){
		let t = this;
		this.wss = new WebSocketServer({port: 4860});

		return new Promise((resolve, reject) => {
			this.wss.onmessage = msg => {t._manager.response(msg, t);};

			this.wss.onopen = () => {resolve(false);};
			this.wss.onerror = (e) => {reject(e);};
		});
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

function safeSend(ws, obj){
	try{
		ws.send(JSON.stringify(obj));
	} catch (e) {
		console.log(e);
	}
}

module.exports = BootstrapChannelServer;