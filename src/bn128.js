/*
    Copyright 2019 0KIMS association.

    This file is part of websnark (Web Assembly zkSnark Prover).

    websnark is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    websnark is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with websnark. If not, see <https://www.gnu.org/licenses/>.
*/
/* globals WebAssembly */
const bigInt = require("big-integer");
const ModuleBuilder = require("wasmbuilder");
const buildF1m = require("./build_f1m.js");
const buildF2m = require("./build_f2m.js");
const buildF1 = require("./build_f1.js");
const buildCurve = require("./build_curve.js");
const buildTest = require("./build_testg1");
const buildFFT = require("./build_fft");
const buildMultiexp = require("./build_multiexp");
const buildPol = require("./build_pol");
const utils = require("./utils");

async function build() {
    const bn128 = new Bn128();

    bn128.q = bigInt("21888242871839275222246405745257275088696311157297823662689037894645226208583");
    bn128.r = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    bn128.n64 = Math.floor((bn128.q.minus(1).bitLength() - 1)/64) +1;
    bn128.n32 = bn128.n64*2;
    bn128.n8 = bn128.n64*8;

    bn128.memory = new WebAssembly.Memory({initial:10000});
    bn128.i32 = new Uint32Array(bn128.memory.buffer);

    const moduleBuilder = new ModuleBuilder();
    moduleBuilder.setMemory(10000);
    buildF1m(moduleBuilder, bn128.q, "f1m");
    buildF1(moduleBuilder, bn128.r, "fr", "frm");
    buildCurve(moduleBuilder, "g1", "f1m");
    buildMultiexp(moduleBuilder, "g1", "g1", "f1m", "fr");
    buildFFT(moduleBuilder, "fft", "frm");
    buildPol(moduleBuilder, "pol", "frm");

    const pNonResidueF2 =  moduleBuilder.alloc(
        utils.bigInt2BytesLE(
            bigInt("15537367993719455909907449462855742678907882278146377936676643359958227611562"), // -1 in montgomery
            bn128.n8
        )
    );

    buildF2m(moduleBuilder, pNonResidueF2, "f2m", "f1m");
    buildCurve(moduleBuilder, "g2", "f2m");
    buildMultiexp(moduleBuilder, "g2", "g2", "f2m", "fr");

    buildTest(moduleBuilder);

    const code = moduleBuilder.build();

    const wasmModule = await WebAssembly.compile(code);

    bn128.instance = await WebAssembly.instantiate(wasmModule, {
        env: {
            "memory": bn128.memory
        }
    });

    bn128.pq = moduleBuilder.modules.f1m.pq;
    bn128.pr = moduleBuilder.modules.frm.pq;

    bn128.pg1 = bn128.g1_allocPoint([bigInt(1), bigInt(2), bigInt(1)]);

    Object.assign(bn128, bn128.instance.exports);

    return bn128;
}

class Bn128 {

    constructor() {

    }

    alloc(length) {
        while (this.i32[0] & 3) this.i32[0]++;  // Return always aligned pointers
        const res = this.i32[0];
        this.i32[0] += length;
        return res;
    }

    putInt(pos, _a) {
        const a = bigInt(_a);
        if (pos & 0x7) throw new Error("Pointer must be aligned");
        if (a.bitLength > this.n64*64) {
            return this.putInt(a.mod(this.q));
        }
        for (let i=0; i<this.n32; i++) {
            this.i32[(pos>>2)+i] = a.shiftRight(i*32).and(0xFFFFFFFF).toJSNumber();
        }
    }

    getInt(pos) {
        if (pos & 0x7) throw new Error("Pointer must be aligned");
        let acc = bigInt(this.i32[(pos>>2)+this.n32-1]);
        for (let i=this.n32-2; i>=0; i--) {
            acc = acc.shiftLeft(32);
            acc = acc.add(this.i32[(pos>>2)+i]);
        }
        return acc;
    }

    allocInt(_a) {
        const p = this.alloc(this.n8);
        if (_a) this.putInt(p, _a);
        return p;
    }

    putIntF2(pos, a) {
        this.putInt(pos, a[0]);
        this.putInt(pos+this.n8, a[1]);
    }

    getIntF2(pos) {
        const p = Array(2);
        p[0] = this.getInt(pos);
        p[1] = this.getInt(pos+this.n8);
        return p;
    }

    allocIntF2(a) {
        const pP = this.alloc(this.n8*2);
        if (a) {
            this.putIntF2(pP, a);
        }
        return pP;
    }

    g1_putPoint(pos, p) {
        this.putInt(pos, p[0]);
        this.putInt(pos+this.n8, p[1]);
        if (p.length == 3) {
            this.putInt(pos+this.n8*2, p[2]);
        } else {
            this.putInt(pos+this.n8*2, 1);
        }
    }

    g1_getPoint(pos) {
        const p = Array(3);
        p[0] = this.getInt(pos);
        p[1] = this.getInt(pos+this.n8);
        p[2] = this.getInt(pos+this.n8*2);
        return p;
    }

    g1_allocPoint(p) {
        const pP = this.alloc(this.n8*3);
        if (p) {
            this.g1_putPoint(pP, p);
        }
        return pP;
    }


    g2_putPoint(pos, p) {
        this.putIntF2(pos, p[0]);
        this.putIntF2(pos+this.n8*2, p[1]);
        if (p.length == 3) {
            this.putIntF2(pos+this.n8*4, p[2]);
        } else {
            this.putIntF2(pos+this.n8*4, 1);
        }
    }

    g2_getPoint(pos) {
        const p = Array(3);
        p[0] = this.getIntF2(pos);
        p[1] = this.getIntF2(pos+this.n8*2);
        p[2] = this.getIntF2(pos+this.n8*4);
        return p;
    }

    g2_allocPoint(p) {
        const pP = this.alloc(this.n8*6);
        if (p) {
            this.g2_putPoint(pP, p);
        }
        return pP;
    }

    putBin(b) {
        const p = this.alloc(b.byteLength);
        const s32 = new Uint32Array(b);
        this.i32.set(s32, p/4);
        return p;
    }

    test_AddG1(n) {
        const start = new Date().getTime();

        const pg = this.g1_allocPoint([bigInt(1), bigInt(2), bigInt(1)]);
        this.g1_toMontgomery(pg,pg);
        const p2 = this.g1_allocPoint();
        this.instance.exports.testAddG1(n, pg, p2);
        this.g1_fromMontgomery(p2,p2);

        const end = new Date().getTime();
        const time = end - start;

        return time;
    }

    test_fft(n) {

        const N=n;

        const p = this.i32[0];
        for (let i=0; i<N; i++) {
            this.putInt(p+i*32, i);
        }

        const start = new Date().getTime();
        this.fft_ifft(p, N);
        const end = new Date().getTime();
        const time = end - start;

        return time;
    }

}

module.exports = build;
