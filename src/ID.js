"use strict";

const StringView = require("../lib/StringView.js");

class ID {
	constructor(input){
		if (input instanceof ArrayBuffer){
			this.buffer = input;
			this.dataView = new Uint8Array(input);
			this.stringView = new StringView(this.buffer);
		} else if (ArrayBuffer.isView(input)){
			this.buffer = input.buffer;
			if(input instanceof Uint8Array)
				this.dataView = input;
			else
				this.dataView = new Uint8Array(this.buffer);
			this.stringView = new StringView(this.buffer);
		} else if (typeof input === "string"){
			this.stringView = StringView.makeFromBase64(input);
			this.buffer = this.stringView.buffer;
			this.dataView = new Uint8Array(this.buffer);
		} else {
			throw new TypeError("Illegal type for ID constructor: "+ typeof input);
		}
	}

	get idLength(){
		return this.buffer.byteLength * 8;
	}

	get idArray(){
		return this.dataView;
	}

	get idString(){
		if(this.base64 === undefined)
			this.base64 = this.stringView.toBase64(true);
		return this.base64;
	}

	leftShiftIn(bit){
		return ID.leftShiftIn(this, bit);
	}

	compareTo(id){
		return ID.compare(this, id);
	}

	add(arrayLike){
		return ID.add(this, arrayLike);
	}

	subtract(arrayLike){
		return ID.subtract(this, arrayLike);
	}

	inOpenBound(aL1, aL2){
		return ID.inOpenBound(this, aL1, aL2);
	}

	inLeftOpenBound(aL1, aL2){
		return ID.inRightOpenBound(this, aL1, aL2);
	}

	inRightOpenBound(aL1, aL2){
		return ID.inLeftOpenBound(this, aL1, aL2);
	}

	inClosedBound(aL1, aL2){
		return ID.inClosedBound(this, aL1, aL2);
	}

	static leftShiftIn(id, bit){
		let out = ID.uint8FromArrayLike(id).slice(0);

		for (let i = out.length - 1; i >= 0; i--) {
			let old = out[i];
			out[i] = (old << 1) + bit;
			bit = (old & 0x80) >> 7;
		};

		return new ID(out);
	}

	static compare(id1, id2){
		let arr1 = ID.uint8FromArrayLike(id1),
			arr2 = ID.uint8FromArrayLike(id2),
			loopLen = (arr1.length > arr2.length) ? arr1.length : arr2.length,
			retVal = 0;

		for(let i = 0; i<loopLen && retVal===0; i++){
			let pt1 = (arr1.length-loopLen+i < 0) ? 0x00 : arr1[arr1.length-loopLen+i],
				pt2 = (arr2.length-loopLen+i < 0) ? 0x00 : arr2[arr2.length-loopLen+i];

			retVal = pt1 - pt2;
		};

		return retVal;
	}

	static add(aL1, aL2){
		let arr1 = ID.uint8FromArrayLike(aL1),
			arr2 = ID.uint8FromArrayLike(aL2),
			out,
			addition;

		if(arr1.length > arr2.length){
			out = arr1.slice(0);
			addition = arr2;
		} else {
			out = arr2.slice(0);
			addition = arr1;
		}

		console.log(arr1);
		console.log(arr2);
		console.log(out);
		console.log(addition);

		let carry = 0;
		for (let i = out.length - 1; i >= 0; i--) {
			let addIter = i + addition.length - out.length,
				pt = (addIter < 0) ? 0x00 : addition[addIter],
				old = out[i];

			out[i] += pt + carry;
			carry = old > out[i];

		};

		// console.log(out)
		// console.log(addition)

		return new ID(out);
	}

	static subtract(aL1, aL2){
		let arr1 = ID.uint8FromArrayLike(aL1),
			arr2 = ID.uint8FromArrayLike(aL2),
			out,
			subtraction;

		if(arr1.length > arr2.length){
			out = arr1.slice(0);
			subtraction = new Uint8Array(arr1.length);
			subtraction.set(arr2, arr1.length-arr2.length);
		} else {
			out = arr2.slice(0);
			subtraction = new Uint8Array(arr2.length);
			subtraction.set(arr1, arr2.length-arr1.length);
		}

		out = ID.add(out, ID.twosComplement(subtraction));
		return out;
	}

	static inOpenBound(al_value, al_LB, al_UB){
		let bVal = ID.boundsChecks(al_value, al_LB, al_UB);
		return bVal[0] && !(bVal[1] || bVal[2]);
	}

	static inLeftOpenBound(al_value, al_LB, al_UB){
		let bVal = ID.boundsChecks(al_value, al_LB, al_UB);
		return bVal[0] || bVal[2] && !bVal[1];
	}

	static inRightOpenBound(al_value, al_LB, al_UB){
		let bVal = ID.boundsChecks(al_value, al_LB, al_UB);
		return bVal[0] || bVal[1] && !bVal[2];
	}

	static inClosedBound(al_value, al_LB, al_UB){
		let bVal = ID.boundsChecks(al_value, al_LB, al_UB);
		return bVal[0] || bVal[1] || bVal[2];
	}

	static boundsChecks(al_value, al_LB, al_UB){
		let cmpLB = ID.compare(al_value, al_LB),
			cmpUB = ID.compare(al_value, al_UB),
			order = ID.compare(al_LB, al_UB);

		return [
			(order < 0)? (cmpLB>0 && cmpUB<0) : (cmpLB<0 || cmpUB>0), //Strictly in bounds.
			cmpLB === 0, //On left bound.
			cmpUB === 0 //On right bound.
		];
	}

	static powerOfTwoBuffer(power){
		let bytes = power/8;
		bytes = (bytes | 0) === bytes ? bytes : (bytes | 0) + 1;

		let out = new Uint8Array(bytes);
		out[0] = 0x01 << power%8;

		return out;
	}

	static onesComplement(arrayLike){
		let arr = ID.uint8FromArrayLike(arrayLike).slice(0);

		for (var i = arr.length - 1; i >= 0; i--) {
			arr[i] = ~arr[i]
		};

		return arr;
	}

	static twosComplement(arrayLike){
		return ID.add([0x01], ID.onesComplement(arrayLike));
	}

	static uint8FromArrayLike(arrayLike){
		if (arrayLike instanceof ArrayBuffer || arrayLike instanceof Array){
			return new Uint8Array(arrayLike);
		} else if (ArrayBuffer.isView(arrayLike)){
			return new Uint8Array(arrayLike.buffer);
		} else if (arrayLike instanceof ID){
			return arrayLike.dataView;
		} else {
			throw new TypeError(arrayLike + "is not an array-like type: "+ typeof arrayLike);
		}
	}
}

module.exports = ID;