"use strict";

const Message = require("./Message.js");

const TYPE_MSG = 0,
	TYPE_PROXY = 1,
	parse_func = {
		"00": text => {

		}
	},
	validation_func = {
		"00": message => {
			
		}
	};


class MessageParser {
	constructor (chord) {
		this.chord = chord;
	}

	parseMessage (string) {

	}
}

module.exports = MessageParser;