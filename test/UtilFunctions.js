var expect = require("chai").expect,
	u = require("../src/UtilFunctions.js");

describe("Utility Functions", () => {
	it("should correctly merge two configurations", () => {
		var defaultC = {
			prop1: true,
			prop2: {
				innerProp: "A thing"
			},
			prop4: 62
		},

		newC = {
			prop1: false,
			prop3: [42,43,44],
			prop4: "Sixty-Two"
		},

		resultExpect = {
			prop1: false,
			prop2: {
				innerProp: "A thing"
			},
			prop3: [42,43,44],
			prop4: "Sixty-Two"
		};

		var res = true;
		var comp = u.mergeConfig(defaultC, newC);

		expect(comp).to.deep.equal(resultExpect);
	});
});