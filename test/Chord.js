var chai = require("chai"),
	chaiAsPromised = require("chai-as-promised"),
	expect = require("chai").expect,
	Chord = require("../src/Chord.js"),
	ID = require("../src/ID.js");

chai.use(chaiAsPromised);

describe("Chord", () => {
	describe("Construction", function() {
		this.timeout(0);
		var tim, c1, c2, c;

		it("should construct without error, given no additional config", () => {
			expect(()=>{var k = new Chord();}).to.not.throw(Error);
		});

		it("should be that two constructed instances have differing pub/priv key pairs", () => {
			c1 = new Chord();
			c2 = new Chord();

			expect(JSON.stringify(c1.key) !== JSON.stringify(c2.key)).to.be.true;
		});

		it("should hold the entry corresponding to its own public key", () => {
			c = new Chord();

			return expect(
				c.lookupItem(c.id.idString)
			).to.eventually.equal(c.pubKeyPem);
		});

		it("should be able to update any keys it has placed within the network.", () => {
			var c = new Chord();

			return expect(
				new Promise((resolve, reject) => {
					setTimeout(()=> {
						c.updateItem(c.id.idString, "Hi there!")
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

		it("should be able to update an owned key more than once", () => {
			c = new Chord();

			return expect(
				new Promise((resolve, reject) => {
					setTimeout(()=> {
						c.updateItem(c.id.idString, "Hi there!")
						.then(
							result => {return c.updateItem(c.id.idString, "Hi again!")}
						)
						.then(
							result => {return c.lookupItem(c.id.idString)}
						)
						.then(
							result => resolve(result),
							reason => reject(reason)
						)
					}, 500)
				})
			).to.eventually.equal("Hi again!");
		});

		afterEach(() => {
			if(tim)
				clearTimeout(tim);

			if(c)
				c.fileStore.dropOwnership(c.id.idString);
			if(c1)
				c1.fileStore.dropOwnership(c1.id.idString);
			if(c2)
				c2.fileStore.dropOwnership(c2.id.idString);
		});
	});	
});