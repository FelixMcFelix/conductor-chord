"use strict";

module.exports = function(param){
	// When the channel is in use by a WebRTC manager, it inserts a pointer to itself at this value.
	// You may use this to refer to the bound manager, for instance when calling this._manager.response(msg, channel);
	// after receving a reply along the channel.
	this._manager = null;

	// Internal ID used by the registry of the manager to help find registered channels by name.
	this.internalID = "structure_example";

	// Function called by manager when opening a new WebRTC Data Channel. This function is used to convert webrtc negotiation
	// details into a form suitable for the channel, as well as sending this information along the channel.
	this.send = function(id, type, data){
		//Where
		//	id is the name assigned to the connection object. This property is useful in designing P2P systems.
		//	type is one of require("webrtc-adapter-test").enums belonging to "MSG_*".
		//	data is the ice candidate, sdp request or sdp reply to send to the other client.
	};

	// Function called by the manager if the _manager.response(msg, channel) method is called. This function is used to parse
	// and handle the data actually received, and interpret what class of message has been received so that the manager can
	// act upon the received information as needed. Making it so that users must call .response allows for chaining channels.
	this.onmessage = function(msg){
		//Where
		//	msg is the data received along this channel.

		//RETURN
		//	{type, data, id}
		//	Where
		//		type is one of require("webrtc-adapter-test").enums belonging to "RESPONSE_*".
		//		data is the extracted form of what was sent along the channel (the sdp response, ice candidates...)
		//		id is the string denoting the connection which the received data is for (the identity of the sender).
	};

	// An optional function called by the manager once the channel has been bound to it.
	// This function should be used to set up any connections or data structures which require access to the manager,
	// and may return either a void value or a promise indicating when the channel may be safely used to create new
	// connections.
	this.onbind = function(){
		//RETURN
		//	Promise<Boolean> or void
	};

	// Function called by the manager or application code if the channel must be closed.
	// All cleanup and related logic should be handled here so that open connections are not left inaccessible
	// by the program.
	this.close = function(){
		/* ... */
	};
}