/*
    Copyright 2019 0KIMS association.

    This file is part of wasmsnark (Web Assembly zkSnark Prover).

    wasmsnark is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    wasmsnark is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with wasmsnark. If not, see <https://www.gnu.org/licenses/>.
*/

/* globals WebAssembly */
const bigInt = require("big-integer");
const ModuleBuilder = require("wasmbuilder");
const assert = require("assert");

async function buildProtoboard(builder, defBytes, bitsPerBytes) {
    const protoboard = new Protoboard();

    protoboard.defBytes = defBytes;
    protoboard.bitsPerBytes = bitsPerBytes || 32;

    protoboard.memory = new WebAssembly.Memory({initial:1});
    protoboard.i32 = new Uint32Array(protoboard.memory.buffer);

    const moduleBuilder = new ModuleBuilder();
    builder(moduleBuilder, protoboard);

    const code = moduleBuilder.build();

    const wasmModule = await WebAssembly.compile(code);

    protoboard.instance = await WebAssembly.instantiate(wasmModule, {
        env: {
            "memory": protoboard.memory
        }
    });

    Object.assign(protoboard, protoboard.instance.exports);

    return protoboard;
}

class Protoboard {

    constructor() {

    }

    alloc(length) {
        if (typeof length === "undefined") {
            length = this.defBytes;
        }
        const res = this.i32[0];
        this.i32[0] += length;
        return res;
    }

    set(pos, nums, nBytes) {
        if (!Array.isArray(nums)) {
            nums = [nums];
        }
        if (typeof nBytes === "undefined") {
            nBytes = this.defBytes;
        }

        const words = Math.floor((nBytes -1)/4)+1;
        let p = pos;

        const CHUNK = bigInt.one.shiftLeft(this.bitsPerBytes);

        for (let i=0; i<nums.length; i++) {
            let v = bigInt(nums[i]);
            for (let j=0; j<words; j++) {
                const rd = v.divmod(CHUNK);
                this.i32[p>>2] = rd.remainder.toJSNumber();
                v = rd.quotient;
                p += 4;
            }
            assert(v.isZero());
            this.i32[p>>2] = bigInt(nums[i]).shiftRight( (words-1)*this.bitsPerBytes).toJSNumber();
            p += 4;
        }

        return pos;
    }

    get(pos, nElements, nBytes) {
        if (typeof nBytes == "undefined") {
            if (typeof nElements == "undefined") {
                nElements = 1;
                nBytes = this.defBytes;
            } else {
                nElements = nBytes;
                nBytes = this.defBytes;
            }
        }

        const words = Math.floor((nBytes -1)/4)+1;

        const CHUNK = bigInt.one.shiftLeft(this.bitsPerBytes);


        const nums = [];
        for (let i=0; i<nElements; i++) {
            let acc = bigInt.zero;
            for (let j=words-1; j>=0; j--) {
                acc = acc.times(CHUNK);
                let v = this.i32[(pos>>2)+j];
                if (this.bitsPerBytes <32) {
                    if (v&0x80000000) v = v-0x100000000;
                }
                acc = acc.add(v);
            }
            nums.push(acc);
            pos += words*4;
        }

        if (nums.length == 1) return nums[0];
        return nums;
    }
}

module.exports = buildProtoboard;
