var chai = require("chai"),
	chaiAsPromised = require("chai-as-promised"),
	expect = require("chai").expect,
	Chord = require("../src/Chord.js"),
	ID = require("../src/ID.js");

chai.use(chaiAsPromised);

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

			return expect(
				c.lookupItem(c.id.idString)
			).to.eventually.equal(c.pubKeyPem);
		});

		it("should be able to update any keys it has placed within the network.", () => {
			var c = new Chord();

			return expect(
				new Promise((resolve, reject) => {
					setTimeout(()=> {
						c.fileStore.update(c.id.idString, "Hi there!")
						.then(
							result => {return c.lookupItem(c.id.idString)}
						)
						.then(
							result => resolve(result),
							reason => reject(reason)
						)
					}, 500)
				})
			).to.eventually.equal("Hi there!");
		});
	});	
});