var expect = require("chai").expect,
	Chord = require("../src/Chord.js"),
	ID = require("../src/ID.js");

describe("Chord", () => {
	describe("Construction", function() {
		this.timeout(0);
		it("should construct without error, given no additional config", () => {
			expect(()=>{var k = new Chord();}).to.not.throw(Error);
		});

		it("should be that two constructed instances have differing pub/priv key pairs", () => {
			var c1 = new Chord();
			var c2 = new Chord();

			expect(JSON.stringify(c1.key) !== JSON.stringify(c2.key)).to.be.true;
		});

		it("should hold the entry corresponding to its own public key", () => {
			var c = new Chord();

			var res = c.lookupItem(c.id.idString);

			expect(res === id.pubKeyPem).to.be.true;
		});
	});	
});