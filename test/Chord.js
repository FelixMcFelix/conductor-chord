var chai = require("chai"),
	chaiAsPromised = require("chai-as-promised"),
	expect = require("chai").expect,
	Chord = require("../src/Chord.js").Chord,
	ID = require("../src/ID.js");

chai.use(chaiAsPromised);

describe("Chord", () => {
	describe("Construction", function() {
		this.timeout(0);
		var tim, c1, c2, c;
		var config = {
			fileStore: {
				itemDuration: 1000,
				itemRefreshPeriod: 100
			}
		}

		it("should construct without error, given no additional config", () => {
			expect(()=>{c = new Chord(config);}).to.not.throw(Error);
		});

		it("should be that two constructed instances have differing pub/priv key pairs", () => {
			c1 = new Chord(config);
			c2 = new Chord(config);

			expect(JSON.stringify(c1.key) !== JSON.stringify(c2.key)).to.be.true;
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

	describe("File System", function() {
		this.timeout(0);
		var tim, c1, c2, c;
		var config = {
			fileStore: {
				itemDuration: 1000,
				itemRefreshPeriod: 100
			}
		}

		it("should hold the entry corresponding to its own public key on construction", () => {
			c = new Chord(config);

			return expect(
				c.lookupItem(c.id.idString)
			).to.eventually.equal(c.pubKeyPem);
		});

		it("should be able to update any keys it has placed within the network.", () => {
			c = new Chord(config);

			return expect(
				new Promise((resolve, reject) => {
					tim = setTimeout(()=> {
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
			c = new Chord(config);

			return expect(
				new Promise((resolve, reject) => {
					tim = setTimeout(()=> {
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

		it("should hold onto an object for longer than its max lifetime", () => {
			c = new Chord(config);

			return expect(
				new Promise((resolve, reject) => {
					tim = setTimeout(()=> {
						return c.lookupItem(c.id.idString)
						.then(
							result => resolve(result),
							reason => reject(reason)
						)
					}, 5000)
				})
			).to.eventually.equal(c.pubKeyPem);
		});

		it("should not hold an item a set time after it has been disowned", () => {
			c = new Chord(config);

			return expect(
				new Promise((resolve, reject) => {
					tim = setTimeout(()=> {
						c.fileStore.dropOwnership(c.id.idString);

						setTimeout(() => {
							c.lookupItem(c.id.idString)
								.then(
									result => resolve(result),
									reason => reject(reason)
								)
						}, 1500)
					}, 500)
				})
			).to.eventually.equal(null);
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