"use strict";

const u = require("./UtilFunctions")

class ConductorChord {
	static get defaultConfig(){
		return {
			debug: false
		}
	};

	constructor(config){
		this.config = u.mergeConfig(ConductorChord.defaultConfig, config);
	}
}

module.exports = ConductorChord;