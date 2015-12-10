var expect = require("chai").expect,
	ID = require("../src/ID.js");

describe("ID", () => {
	describe("Creation", () => {
		it("should allow creation from an existing typed array", () => {
			var orig = new Uint8Array([0x43,0x7e,0x20]);
			var id1 = new ID(orig);

			expect(id1.idArray.buffer === orig.buffer).to.be.true;
		});

		it("should allow creation from an existing ArrayBuffer", () => {
			var orig = new Uint8Array([0x43,0x7e,0x20]);
			var id1 = new ID(orig.buffer);

			expect(id1.idArray.buffer === orig.buffer).to.be.true;
		});

		it("should allow creation from a base64 string", () => {
			var orig = "SGVsbG8h";
			var id1 = new ID(orig);

			expect(id1.idString === orig).to.be.true;
		});

		it("should throw a TypeError for any other type", () => {
			var orig = {};

			expect(()=>{new ID(orig);}).to.throw(TypeError);
		});
	});

	describe("Comparison", () => {
		it("should return 0 for two equal IDs", () => {
			var id1 = new ID(new Uint8Array([0x50,0x50,0x30]));
			var id2 = new ID(new Uint8Array([0x50,0x50,0x30]));

			expect(id1.compareTo(id2)===0).to.be.true;
		});

		it("should return a value less than 0 if left is less than right", () => {
			var id1 = new ID(new Uint8Array([0x49,0x50,0x31]));
			var id2 = new ID(new Uint8Array([0x50,0x50,0x30]));

			expect(id1.compareTo(id2)<0).to.be.true;
		});

		it("should return a value greater than 0 if left is greater than right", () => {
			var id1 = new ID(new Uint8Array([0x51,0x50,0x29]));
			var id2 = new ID(new Uint8Array([0x50,0x50,0x30]));

			expect(id1.compareTo(id2)>0).to.be.true;
		});

		it("should return correct value if left is wider (and smaller) than right", () => {
			var id1 = new ID(new Uint8Array([0x00,0x49,0x31]));
			var id2 = new ID(new Uint8Array(/*0x00*/[0x50,0x30]));

			expect(id1.compareTo(id2)<0).to.be.true;
		});

		it("should return correct value if left is wider (and larger) than right", () => {
			var id1 = new ID(new Uint8Array([0x01,0x49,0x29]));
			var id2 = new ID(new Uint8Array(/*0x00*/[0x50,0x30]));

			expect(id1.compareTo(id2)>0).to.be.true;
		});

		it("should return correct value if right is wider (and smaller) than left", () => {
			var id1 = new ID(new Uint8Array(/*0x00*/[0x50,0x30]));
			var id2 = new ID(new Uint8Array([0x00,0x49,0x31]));

			expect(id1.compareTo(id2)>0).to.be.true;
		});

		it("should return correct value if right is wider (and larger) than left", () => {
			var id1 = new ID(new Uint8Array(/*0x00*/[0x50,0x30]));
			var id2 = new ID(new Uint8Array([0x01,0x51,0x29]));

			expect(id1.compareTo(id2)<0).to.be.true;
		});
	});

	describe("Arithmetic", () => {
		it("should allow left shifting in the value 0", () => {
			var orig = new Uint8Array([0xf0,0xc0,0xf0]);
			var resultOracle = new Uint8Array([0xe1,0x81,0xe0]);
			var id1 = new ID(orig);
			var idRes = new ID(resultOracle);
			
			var result = ID.leftShiftIn(id1, 0);

			expect(idRes.compareTo(result) === 0).to.be.true;
		});

		it("should allow left shifting in the value 1", () => {
			var orig = new Uint8Array([0xf0,0xc0,0xf0]);
			var resultOracle = new Uint8Array([0xe1,0x81,0xe1]);
			var id1 = new ID(orig);
			var idRes = new ID(resultOracle);
			
			var result = ID.leftShiftIn(id1, 1);

			expect(idRes.compareTo(result) === 0).to.be.true;
		});

		it("should allow addition over the domain", () => {
			var orig = new Uint8Array([0x00,0x23]);
			var resultOracle = new Uint8Array([0x12,0x34]);

			var id1 = new ID(orig);
			var idRes = new ID(resultOracle);
			
			var result = ID.add(id1, [0x12,0x11]);

			expect(idRes.compareTo(result) === 0).to.be.true;
		});

		it("should overflow properly with addition (simulate modular arithmetic)", () => {
			var orig = new Uint8Array([0xff,0xff]);
			var resultOracle = new Uint8Array([0x00,0x31]);

			var id1 = new ID(orig);
			var idRes = new ID(resultOracle);
			
			var result = ID.add(id1, [0x32]);

			expect(idRes.compareTo(result) === 0).to.be.true;
		});

		it("should properly perform the one's complement of an array buffer", () => {
			var orig = new Uint8Array([0x0f,0x70]);
			var resultOracle = new Int8Array([0xf0,0x8f]);

			var id1 = new ID(orig);
			var idRes = new ID(resultOracle);
			
			var result = ID.onesComplement(id1);

			expect(idRes.compareTo(result) === 0).to.be.true;
		});

		it("should properly perform the two's complement of an array buffer", () => {
			var orig = new Uint8Array([0x0f,0x70]);
			var resultOracle = new Int8Array([0xf0,0x90]);

			var id1 = new ID(orig);
			var idRes = new ID(resultOracle);
			
			var result = ID.twosComplement(id1);

			expect(idRes.compareTo(result) === 0).to.be.true;
		});

		it("should allow subtraction over the domain", () => {
			var orig = new Uint8Array([0x01,0x00]);
			var resultOracle = new Uint8Array([0x00,0xff]);

			var id1 = new ID(orig);
			var idRes = new ID(resultOracle);
			
			var result = ID.subtract(id1, [0x01]);

			expect(idRes.compareTo(result) === 0).to.be.true;
		});

		it("should overflow properly with subtraction (simulate modular arithmetic)", () => {
			var orig = new Uint8Array([0x00,0x00]);
			var resultOracle = new Uint8Array([0xfa,0x00]);

			var id1 = new ID(orig);
			var idRes = new ID(resultOracle);
			
			var result = ID.subtract(id1, [0x06,0x00]);

			expect(idRes.compareTo(result) === 0).to.be.true;
		});
	});

	describe("Bounds Checks", () => {
		it("should return true for all checks if value is strictly between both bounds", () => {
			var value = new ID(new Uint8Array([0x00,0xff,0x00])),
				ub = new Uint8Array([0xff,0x00,0x00]),
				lb = new Uint8Array([0x00,0x00,0xff]);

			expect(value.inOpenBound(lb, ub)
				&& value.inLeftOpenBound(lb, ub)
				&& value.inRightOpenBound(lb, ub)
				&& value.inClosedBound(lb, ub)).to.be.true;
		});

		it("should return true for only right-open and closed if value is on the left bound", () => {
			var value = new ID(new Uint8Array([0xff,0x00,0x00])),
				ub = new Uint8Array([0xff,0x00,0x00]),
				lb = new Uint8Array([0x00,0x00,0xff]);

			expect(!value.inOpenBound(lb, ub)
				&& !value.inLeftOpenBound(lb, ub)
				&& value.inRightOpenBound(lb, ub)
				&& value.inClosedBound(lb, ub)).to.be.true;
		});

		it("should return true for only left-open and closed if value is on the right bound", () => {
			var value = new ID(new Uint8Array([0x00,0x00,0xff])),
				ub = new Uint8Array([0xff,0x00,0x00]),
				lb = new Uint8Array([0x00,0x00,0xff]);

			expect(!value.inOpenBound(lb, ub)
				&& value.inLeftOpenBound(lb, ub)
				&& !value.inRightOpenBound(lb, ub)
				&& value.inClosedBound(lb, ub)).to.be.true;
		});

		it("should return false for all checks if value is outside of bounds", () => {
			var value = new ID(new Uint8Array([0x00,0x00,0x00])),
				ub = new Uint8Array([0xff,0x00,0x00]),
				lb = new Uint8Array([0x00,0x00,0xff]);

			expect(!value.inOpenBound(lb, ub)
				&& !value.inLeftOpenBound(lb, ub)
				&& !value.inRightOpenBound(lb, ub)
				&& !value.inClosedBound(lb, ub)).to.be.true;
		});

		it("should return true if value is between bounds and bounds overflow ", () => {
			var value = new ID(new Uint8Array([0x00,0x00,0x10])),
				ub = new Uint8Array([0x00,0x00,0xff]),
				lb = new Uint8Array([0xff,0x00,0x00]);

			expect(value.inOpenBound(lb, ub)
				&& value.inLeftOpenBound(lb, ub)
				&& value.inRightOpenBound(lb, ub)
				&& value.inClosedBound(lb, ub)).to.be.true;
		});

		it("should map to all values if lb = ub", () => {
			var value = new ID(new Uint8Array([0x12,0x34,0x56])),
				ub = new Uint8Array([0xff,0x00,0x00]),
				lb = new Uint8Array([0xff,0x00,0x00]);

			expect(value.inOpenBound(lb, ub)
				&& value.inLeftOpenBound(lb, ub)
				&& value.inRightOpenBound(lb, ub)
				&& value.inClosedBound(lb, ub)).to.be.true;
		});

		it("should include itself if lb = ub and at least one bound is closed", () => {
			var value = new ID(new Uint8Array([0xff,0x00,0x00])),
				ub = new Uint8Array([0xff,0x00,0x00]),
				lb = new Uint8Array([0xff,0x00,0x00]);

			expect(!value.inOpenBound(lb, ub)
				&& value.inLeftOpenBound(lb, ub)
				&& value.inRightOpenBound(lb, ub)
				&& value.inClosedBound(lb, ub)).to.be.true;
		});
	});

	describe("Specific Forms", () => {
		it("should allow creation of power-of-two IDs", () => {
			var buf = ID.powerOfTwoBuffer(29);
			var resultOracle = new Uint8Array([0x20,0x00,0x00,0x00]);

			var match = true;
			for(var i=0;i<resultOracle.length;i++){
				match = buf[i] === resultOracle[i];
				if(!match)
					break;
			}

			expect(match).to.be.true;
		});

		it("should create power-of-two buffers as Uint8Array", () => {
			var buf = ID.powerOfTwoBuffer(6);
			expect(buf instanceof Uint8Array).to.be.true;
		});

		it("should ensure that power-of-two buffers are given enough array space", () => {
			var buf1 = ID.powerOfTwoBuffer(44);
			var buf2 = ID.powerOfTwoBuffer(16);
			var buf3 = ID.powerOfTwoBuffer(390);
			
			expect(buf1.byteLength===Math.ceil(44/8) && buf2.byteLength===Math.ceil(16/8) && buf3.byteLength===Math.ceil(390/8)).to.be.true;
		});
	});
});