var expect = require("chai").expect,
	Chord = require("../src/Chord.js"),
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

	describe("Arithmetic", () => {
		it("should allow left shifting in the value 0", () => {
			var orig = new Uint8Array([0xf0,0xc0,0xf0]);
			var resultOracle = new Uint8Array([0xe1,0x81,0xe0]);
			var id1 = new ID(orig);
			var idRes = new ID(resultOracle);
			
			var result = ID.leftShift(id1, 0);

			expect(idRes.compareTo(result) === 0).to.be.true;
		});

		it("should allow left shifting in the value 1", () => {
			var orig = new Uint8Array([0xf0,0xc0,0xf0]);
			var resultOracle = new Uint8Array([0xe1,0x81,0xe1]);
			var id1 = new ID(orig);
			var idRes = new ID(resultOracle);
			
			var result = ID.leftShift(id1, 1);

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
			var resultOracle = new Uint8Array([0x00,0x32]);

			var id1 = new ID(orig);
			var idRes = new ID(resultOracle);
			
			var result = ID.add(id1, [0x32]);

			expect(idRes.compareTo(result) === 0).to.be.true;
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