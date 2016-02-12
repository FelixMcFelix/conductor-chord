"use strict";

const Message = require("./Message.js");

const TYPE_MSG = 0,
	TYPE_PROXY = 1,
	parse_func = {
		"00": text => {

		}
	},
	out_func = {
		"00": message => {

		}
	};


class MessageParser {
	constructor (chord) {
		this.chord = chord;
	}

	parseMessage (string) {
		//Read version.
		let version = string.substring(0,2);

		//Is version valid?
		if (version.length < 2 || !parse_func[version])
			return null;

		//Parse the packet using its version.
		//TODO

		//Was reading the packet successful?
	}
}

module.exports = MessageParser;