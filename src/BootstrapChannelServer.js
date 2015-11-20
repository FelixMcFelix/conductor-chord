"use strict";

const msg_types = require("webrtc-conductor").enums,
	  WebSocketServer = require("ws").Server,
	  u = require("./UtilFunctions.js");

class BootstrapChannelServer{
	constructor(chord){
		this._manager = null;
		this.wss = null;
		this.chord = chord;
	}

	get internalID(){
		return "Boot-Client";
	}

	onbind(){
		let t = this;
		this.wss = new WebSocketServer(t.chord.config.serverConfig);
		u.log(t.chord, "Bound, opening WSS.");

		return new Promise((resolve, reject) => {
			this.wss.onmessage = msg => {t._manager.response(msg, t);};

			this.wss.onopen = () => {
				u.log(t.chord, "Server finally ready!");
				resolve(false);
			};
			this.wss.onerror = (e) => {reject(e);};
		});
	}

	send(id,type,data){
		u.log(this.chord, "Send instruction given to server bootstrap:");
		/* TODO */
	}

	onmessage(msg){
		u.log(this.chord, "Server bootstrap received message:");
		u.log(this.chord, msg);
		/* TODO */
	}

	close(){
		u.log(this.chord, "Closing server bootstrap - this shouldn't happen.");
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