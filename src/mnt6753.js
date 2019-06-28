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

/* globals WebAssembly, Blob, Worker, navigator, Promise, window */
const bigInt = require("big-integer");
const mnt6753_wasm = require("../build/mnt6753_wasm.js");
const assert = require("assert");
const blakejs = require("blakejs");
const utils = require("./utils");

function bits(n) {
    let E = n;
    const res = [];
    while (E.gt(bigInt.zero)) {
        if (E.isOdd()) {
            res.push( 1 );
        } else {
            res.push( 0 );
        }
        E = E.shiftRight(1);
    }
    return res;
}

const ateLoopCount = bigInt("204691208819330962009469868104636132783269696790011977400223898462431810102935615891307667367766898917669754470400");
//    const ateLoopNafBytes = naf(ateLoopCount).map( (b) => (b==-1 ? 0xFF: b) );
//    const pAteLoopNafBytes = module.alloc(ateLoopNafBytes);
const ateLoopBitBytes = bits(ateLoopCount);



const MEM_PAGES=1000;
const SIZEF1 = 96;
const inBrowser = (typeof window !== "undefined");
let NodeWorker;
let NodeCrypto;
if (!inBrowser) {
    NodeWorker = require("worker_threads").Worker;
    NodeCrypto = require("crypto");
}


class Deferred {
    constructor() {
        this.promise = new Promise((resolve, reject)=> {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
}

/*
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
*/

function thread(self) {
    let instance;
    let memory;
    let i32;
    let i8;
    let prePSize;
    let preQSize;

    async function init(data) {
        const code = new Uint8Array(data.code);
        const wasmModule = await WebAssembly.compile(code);
        memory = new WebAssembly.Memory({initial:data.init});
        i8 = new Uint8Array(memory.buffer);
        i32 = new Uint32Array(memory.buffer);
        prePSize = data.prePSize;
        preQSize = data.preQSize;

        instance = await WebAssembly.instantiate(wasmModule, {
            env: {
                "memory": memory
            }
        });
    }

    function alloc(length) {
        let l=length;
        while (l & 7) l++;
        while (i32[0] & 7) i32[0]++;  // Return always aligned pointers
        const res = i32[0];
        i32[0] += l;
        while (i32[0] > memory.buffer.byteLength) {
            memory.grow(128);
            i32 = new Uint32Array(memory.buffer);
            i8 = new Uint8Array(memory.buffer);
        }
        return res;
    }

    function putBin(b) {
        const p = alloc(b.byteLength);
        const s8 = new Uint8Array(b);
        i8.set(s8, p);
        return p;
    }

    function getBin(p, l) {
        return memory.buffer.slice(p, p+l);
    }

/*
    function getInt(p) {
        const idx = p>>2;
        let acc = BigInt(i32[idx+23]);
        for (let i=22; i>=0; i--) {
            acc = acc << 32n;
            acc = acc + BigInt(i32[idx+i]);
        }
        return acc;
    }
*/

    self.onmessage = function(e) {
        function buf2hex(buffer) { // buffer is an ArrayBuffer
          return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
        }

        let data;
        if (e.data) {
            data = e.data;
        } else {
            data = e;
        }

        if (data.command == "INIT") {
            init(data).then(function() {
                self.postMessage(data.result);
            });
        } else if (data.command == "PRECOMPUTE_G1") {
//            console.log(data.threadId + " preG1");
            const oldAlloc = i32[0];
            const pP = putBin(data.P);
            const pPreP = alloc(prePSize);
            instance.exports.mnt6753_prepareG1(pP, pPreP);

            data.result = getBin(pPreP, prePSize);
            i32[0] = oldAlloc;
            self.postMessage(data.result, [data.result]);
        } else if (data.command == "PRECOMPUTE_G1_SCALED") {
//            console.log(data.threadId + " preG1scake");
            const oldAlloc = i32[0];
            const pP = putBin(data.P);
            const pPreP = alloc(prePSize);
            const nr = data.R.byteLength;
            const pr = putBin(data.R);

            instance.exports.g1m_timesScalar(pP, pr, nr, pP);

            instance.exports.mnt6753_prepareG1(pP, pPreP);

            data.result = getBin(pPreP, prePSize);
            i32[0] = oldAlloc;
            self.postMessage(data.result, [data.result]);
        } else if (data.command == "PRECOMPUTE_G2") {
//            console.log(data.threadId + " preG2");
            const oldAlloc = i32[0];

            const pQ = putBin(data.Q);
            const pPreQ = alloc(preQSize);

            instance.exports.mnt6753_prepareG2(pQ, pPreQ);

            data.result = getBin(pPreQ, preQSize);
            i32[0] = oldAlloc;
            self.postMessage(data.result, [data.result]);
        } else if (data.command == "MILLER_LOOP") {
//            console.log(data.threadId + " miller");

            const oldAlloc = i32[0];
            const pRes = alloc(96*6);
            const pPreP = putBin(data.preP);
            const pPreQ = putBin(data.preQ);

            instance.exports.mnt6753_millerLoop(pPreP, pPreQ, pRes);

            data.result = getBin(pRes, 96*6);
            i32[0] = oldAlloc;
            //console.log(buf2hex(data.result));
            self.postMessage(data.result, [data.result]);
        } else if (data.command == "COMPUTE_LINE_FUNCTIONS") {
//            console.log(data.threadId + " miller");

            const oldAlloc = i32[0];
            let pRes;
            const pPreP = putBin(data.preP);
            const pPreQ = putBin(data.preQ);

            if (!data.currentLineFunctions) {
              pRes = alloc(96*6*data.iterations);
              for (let i = 0; i < data.iterations; i++) {
                instance.exports.ftm_one(pRes + 96*6*i);
              }
            } else {
              pRes = putBin(data.currentLineFunctions);
            }

            instance.exports.mnt6753_computeLineFunctions(pPreP, pPreQ, pRes);

            data.result = getBin(pRes, 96*6*data.iterations);
            i32[0] = oldAlloc;
            //console.log(buf2hex(data.result));
            self.postMessage(data.result, [data.result]);
        } else if (data.command == "COMBINE_LINE_FUNCTIONS") {
//            console.log(data.threadId + " miller");

            const oldAlloc = i32[0];
            let l = putBin(data.l);
            let r = putBin(data.r);
            let pRes = alloc(96*6*data.iterations);

            instance.exports.mnt6753_combineLineFunctions(l, r, pRes);

            data.result = getBin(pRes, 96*6*data.iterations);
            i32[0] = oldAlloc;
            //console.log(buf2hex(data.result));
            self.postMessage(data.result, [data.result]);
        } else if (data.command == "FUSED_MILLER_LOOP") {
//            console.log(data.threadId + " miller");

            const oldAlloc = i32[0];
            const pRes = alloc(96*6);

            const lineFunctions = putBin(data.lineFunctions);
            instance.exports.mnt6753_fusedMillerLoop(lineFunctions, pRes);

            data.result = getBin(pRes, 96*6);
            i32[0] = oldAlloc;
            self.postMessage(data.result, [data.result]);
        } else if (data.command == "PEDERSEN_HASH") {
//            console.log(data.threadId + " peersenHash");

            const oldAlloc = i32[0];
            const pBytes = putBin(data.bytes);
            const pRes = alloc(96*6);


            instance.exports.g1m_pedersenHash(pBytes, data.bitLength, pRes);

            data.result = getBin(pRes, 96*3);
            i32[0] = oldAlloc;
            self.postMessage(data.result, [data.result]);
        } else if (data.command == "TERMINATE") {
            process.exit();
        }
    };
}

async function build() {

    const mnt6753 = new Mnt6753();

    mnt6753.memory = new WebAssembly.Memory({initial:MEM_PAGES});
    mnt6753.i32 = new Uint32Array(mnt6753.memory.buffer);
    mnt6753.i8 = new Uint8Array(mnt6753.memory.buffer);

    const wasmModule = await WebAssembly.compile(mnt6753_wasm.code);

    mnt6753.instance = await WebAssembly.instantiate(wasmModule, {
        env: {
            "memory": mnt6753.memory
        },
    });

    mnt6753.workers = [];
    mnt6753.pendingDeferreds = [];
    mnt6753.working = [];

    mnt6753.pq = mnt6753_wasm.pq;
    mnt6753.pr = mnt6753_wasm.pr;
    mnt6753.pG1gen = mnt6753_wasm.pG1gen;
    mnt6753.pG1zero = mnt6753_wasm.pG1zero;
    mnt6753.pG2gen = mnt6753_wasm.pG2gen;
    mnt6753.pG2zero = mnt6753_wasm.pG2zero;
    mnt6753.pOneT = mnt6753_wasm.pOneT;

    let concurrency;

    if ((typeof(navigator) === "object") && navigator.hardwareConcurrency) {
        concurrency = navigator.hardwareConcurrency;
    } else {
        concurrency = 8;
    }

    function getOnMsg(i) {
        return function(e) {
            let data;
            if ((e)&&(e.data)) {
                data = e.data;
            } else {
                data = e;
            }

            mnt6753.working[i]=false;
            mnt6753.pendingDeferreds[i].resolve(data);
            mnt6753.processWorks();
        };
    }

    for (let i = 0; i<concurrency-1; i++) {

        if (inBrowser) {
            const blob = new Blob(["(", thread.toString(), ")(self);"], { type: "text/javascript" });
            const url = URL.createObjectURL(blob);

            mnt6753.workers[i] = new Worker(url);

            mnt6753.workers[i].onmessage = getOnMsg(i);

        } else {
            mnt6753.workers[i] = new NodeWorker("(" + thread.toString()+ ")(require('worker_threads').parentPort);", {eval: true});

            mnt6753.workers[i].on("message", getOnMsg(i));
        }

        mnt6753.working[i]=false;
    }

    const initPromises = [];
    for (let i=0; i<mnt6753.workers.length;i++) {
        const copyCode = mnt6753_wasm.code.buffer.slice(0);
        initPromises.push(mnt6753.postAction(i, {
            command: "INIT",
            init: MEM_PAGES,
            code: copyCode,
            prePSize: mnt6753_wasm.prePSize,
            preQSize: mnt6753_wasm.preQSize
        }, [copyCode]));
    }

    await Promise.all(initPromises);

    return mnt6753;
}


function packBits(arr) {
    const bytes = [];
    let acc = 0;
    for (let i=0; i<arr.length; i++) {
        if (arr[i]) {
            acc = acc | (1 << (i & 0x7));
        }
        if (((i & 0x7) == 0x7) || (i == arr.length-1)) {
            bytes.push(acc);
            acc =0;
        }
    }
    return new Uint8Array(bytes);
}

function unpackBits(bytes, len) {
    const res = [];
    for (let i=0; i<len; i++) {
        res.push(((bytes[i >> 3] >> (i&0x7)) & 1) == 1);
    }
    return res;
}

class Mnt6753 {
    constructor() {
        this.actionQueue = [];
    }

    postAction(workerId, e, transfers, _deferred) {
        assert(this.working[workerId] == false);
        this.working[workerId] = true;

        this.pendingDeferreds[workerId] = _deferred ? _deferred : new Deferred();
        this.workers[workerId].postMessage(e, transfers);

        return this.pendingDeferreds[workerId].promise;
    }

    processWorks() {
        for (let i=0; (i<this.workers.length)&&(this.actionQueue.length > 0); i++) {
            if (this.working[i] == false) {
                const work = this.actionQueue.shift();
                work.data.threadId = i;
                this.postAction(i, work.data, work.transfers, work.deferred);
            }
        }
    }

    queueAction(actionData, transfers) {
        const d = new Deferred();
        this.actionQueue.push({
            data: actionData,
            transfers: transfers,
            deferred: d
        });
        this.processWorks();
        return d.promise;
    }

    alloc(length) {
        while (this.i32[0] & 3) this.i32[0]++;  // Return always aligned pointers
        const res = this.i32[0];
        this.i32[0] += length;
        return res;
    }


    putBin(p, b) {
        const s8 = new Uint8Array(b);
        this.i8.set(s8, p);
    }

    getBin(p, l) {
        return this.memory.buffer.slice(p, p+l);
    }

    bin2int(b) {
        const i32 = new Uint32Array(b);
        let acc = bigInt(i32[23]);
        for (let i=22; i>=0; i--) {
            acc = acc.shiftLeft(32);
            acc = acc.add(i32[i]);
        }
        return acc.toString();
    }

    getInt(p) {
        const idx = p>>2;
        let acc = bigInt(this.i32[idx+23]);
        for (let i=22; i>=0; i--) {
            acc = acc.shiftLeft(32);
            acc = acc.add(this.i32[idx+i]);
        }
        return acc;
    }

    bin2g1(b) {
        return [
            this.bin2int(b.slice(96*0,96*1)),
            this.bin2int(b.slice(96*1,96*2)),
            this.bin2int(b.slice(96*2,96*3)),
        ];
    }

    bin2g2(b) {
        return [
            [
                this.bin2int(b.slice(96*0,96*1)),
                this.bin2int(b.slice(96*1,96*2)),
                this.bin2int(b.slice(96*2,96*3)),
            ],
            [
                this.bin2int(b.slice(96*3,96*4)),
                this.bin2int(b.slice(96*4,96*5)),
                this.bin2int(b.slice(96*5,96*6)),
            ],
            [
                this.bin2int(b.slice(96*6,96*7)),
                this.bin2int(b.slice(96*7,96*8)),
                this.bin2int(b.slice(96*8,96*9)),
            ],
        ];
    }


    setInt(pos, _a, _size) {
        const n32 = _size ? (((_size - 1)>>2)+1) : SIZEF1 >> 2;
        const a = bigInt(_a);
        if (pos & 0x7) throw new Error("Pointer must be aligned");
        for (let i=0; i<n32; i++) {
            this.i32[(pos>>2)+i] = a.shiftRight(i*32).and(0xFFFFFFFF).toJSNumber();
        }
    }

    setF1(p, e) {
        const n32 = (SIZEF1 >> 2);
        let arr;
        if (Array.isArray(e)) {
            if (e.length == n32 ) {
                arr = e;
            } else if (e.length == 3) {
                arr = e[2].slice(0);
                // Remove
                while (arr[arr.length-1] <0) arr.pop();
                // Fill it with zeros
                const filledElements = arr.length;
                arr.length = n32;
                arr.fill(0, filledElements, n32);
            } else {
                throw new Error("Invalid format");
            }
            this.i32.set(Uint32Array.from(arr), p >> 2);
        } else {
            this.setInt(p, e);
        }
    }


    setF3(p, e) {
        this.setF1(p, e.a);
        this.setF1(p + SIZEF1, e.b);
        this.setF1(p + 2*SIZEF1, e.c);
    }

    setF6(p, e) {
        this.setF3(p, e.a);
        this.setF3(p+3*SIZEF1, e.b);
    }

    setG1Affine(p, e) {
        this.setF1(p, e.x);
        this.setF1(p + SIZEF1, e.y);
        this.setF1(p + 2*SIZEF1, 1);
    }

    setG2Affine(p, e) {
        this.setF3(p, e.x);
        this.setF3(p + SIZEF1*3, e.y);
        this.setF3(p + SIZEF1*6, {a: 1, b:0, c:0});
    }

    terminate() {
        for (let i=0; i<this.workers.length; i++) {
            this.workers[i].postMessage({command: "TERMINATE"});
        }
    }



    async precomputeG1(pP) {
        const P = this.getBin(pP, SIZEF1*3);
        return this.queueAction({
            command: "PRECOMPUTE_G1",
            P: P ,
        }, [P]);
    }


    async precomputeG2(pQ) {
        const Q = this.getBin(pQ, SIZEF1*9);
        return this.queueAction({
            command: "PRECOMPUTE_G2",
            Q: Q ,
        }, [Q]);
    }

    async precomputeG1Scaled(pP, pR) {
        const P = this.getBin(pP, SIZEF1*3);
        const R = this.getBin(pR, 16);
        return this.queueAction({
            command: "PRECOMPUTE_G1_SCALED",
            P: P,
            R: R
        }, [P, R]);
    }

    async millerLoop(preP, preQ) {
        const prePcopy = preP.slice();
        const preQcopy = preQ.slice();
        return this.queueAction({
            command: "MILLER_LOOP",
            preP: prePcopy,
            preQ: preQcopy,
        }, [prePcopy, preQcopy]);
    }

    async computeLineFunctions(preP, preQ, currentLineFunctions) {
        const prePcopy = preP.slice();
        const preQcopy = preQ.slice();
        return this.queueAction({
            command: "COMPUTE_LINE_FUNCTIONS",
            preP: prePcopy,
            preQ: preQcopy,
            iterations: ateLoopBitBytes.length,
            currentLineFunctions: currentLineFunctions,
        }, [prePcopy, preQcopy]);
    }

    async combineLineFunctions(l, r) {
        const lCopy = l.slice();
        const rCopy = r.slice();
        return this.queueAction({
            command: "COMBINE_LINE_FUNCTIONS",
            l: lCopy,
            r: rCopy,
            iterations: ateLoopBitBytes.length,
        }, [l, r]);
    }

    async fusedMillerLoop(lineFunctions) {
        return this.queueAction({
            command: "FUSED_MILLER_LOOP",
            lineFunctions: lineFunctions,
        }, [lineFunctions]);
    }

    verifySync(verificationKey, input, proof) {

        if (input) {
            if  ((!Array.isArray(input))||(utils.isOcamNum(input))) input = [input];
        } else {
            input = [];
        }

        const oldAlloc = this.i32[0];

        const pA = this.alloc(SIZEF1*3);
        const pB = this.alloc(SIZEF1*9);
        const pAlfaBeta = this.alloc(SIZEF1*6);
        const pIC = this.alloc(SIZEF1*3);
        const pICaux = this.alloc(SIZEF1*3);
        const pICr = this.alloc(SIZEF1);
        const pC = this.alloc(SIZEF1*3);
        const pDeltaPrime = this.alloc(SIZEF1*9);
        const pBytes = this.alloc(768);
        const pPedersenResult = this.alloc(SIZEF1);
        const pBlakeResult = this.alloc(SIZEF1);
        const pYS = this.alloc(SIZEF1*3);
        const pZ = this.alloc(SIZEF1*3);
        const pDelta = this.alloc(SIZEF1*9);


        this.setG1Affine(pA, proof.a);
        this.setG2Affine(pB, proof.b);
        this.setG1Affine(pC, proof.c);
        this.setG2Affine(pDeltaPrime, proof.deltaPrime);

        const bits = [
            (this.i8[pA+96] & 1) == 1,
            ...unpackBits(this.i8.slice(pA, pA+96), 753),
            (this.i8[pB+96*3] & 1) == 1,
            ...unpackBits(this.i8.slice(pB, pB+96), 753),
            ...unpackBits(this.i8.slice(pB+96, pB+96*2), 753),
            ...unpackBits(this.i8.slice(pB+96*2, pB+96*3), 753),
            (this.i8[pC+96] & 1) == 1,
            ...unpackBits(this.i8.slice(pC, pC+96), 753),
            (this.i8[pDeltaPrime+96*3] & 1) == 1,
            ...unpackBits(this.i8.slice(pDeltaPrime, pDeltaPrime+96), 753),
            ...unpackBits(this.i8.slice(pDeltaPrime+96, pDeltaPrime+96*2), 753),
            ...unpackBits(this.i8.slice(pDeltaPrime+96*2, pDeltaPrime+96*3), 753),
        ];

        this.instance.exports.g1m_toMontgomery(pA, pA);
        this.instance.exports.g2m_toMontgomery(pB, pB);
        this.instance.exports.g1m_toMontgomery(pC, pC);
        this.instance.exports.g2m_toMontgomery(pDeltaPrime, pDeltaPrime);



        this.setG1Affine(pIC, verificationKey.query[0]);
        this.instance.exports.g1m_toMontgomery(pIC, pIC);
        for (let i=0; i<input.length; i++) {
            this.setG1Affine(pICaux, verificationKey.query[i+1]);
            this.instance.exports.g1m_toMontgomery(pICaux, pICaux);

            this.setF1(pICr, input[i]);
            this.instance.exports.g1m_timesScalar(pICaux, pICr, SIZEF1, pICaux);

            this.instance.exports.g1m_add(pICaux, pIC, pIC);
        }
        this.instance.exports.g1m_affine(pIC, pIC);

        this.setF6(pAlfaBeta, verificationKey.alphaBeta);
        this.instance.exports.ftm_toMontgomery(pAlfaBeta, pAlfaBeta);

        this.instance.exports.g1m_neg(pC, pC);
        this.instance.exports.g1m_neg(pIC, pIC);
        const valid1 = this.instance.exports.mnt6753_pairingEq3(pA, pB, pIC, this.pG2gen, pC, pDeltaPrime, pAlfaBeta);

        this.i32[0] = oldAlloc;

        // Construct the bits array

        const bytes = packBits(bits);

//        console.log("Bits: " + JSON.stringify(bits));

        this.i8.set(bytes, pBytes);

        this.instance.exports.g1m_pedersenHash(pBytes, bits.length, pPedersenResult);

//        console.log("Pedersen: " + this.getInt(pPedersenResult).toString());

        const blakeResult = blakejs.blake2s(this.i8.subarray(pPedersenResult, pPedersenResult + 95));

        this.instance.exports.f1m_zero(pBlakeResult);
        this.i8.set(blakeResult, pBlakeResult);

//        console.log("Blake: " + this.getInt(pBlakeResult).toString());

        this.instance.exports.f1m_toMontgomery(pBlakeResult, pBlakeResult);
        this.instance.exports.mnt6753_groupMap(pBlakeResult, pYS);

//        this.instance.exports.g1m_fromMontgomery(pYS, pYS);
//        console.log("Ys.x: " + this.getInt(pYS).toString());
//        console.log("Ys.y: " + this.getInt(pYS+96).toString());
//        console.log("Ys.z: " + this.getInt(pYS+96*2).toString());
//        this.instance.exports.g1m_toMontgomery(pYS, pYS);

        this.setG1Affine(pZ, proof.z);
        this.setG2Affine(pDelta, verificationKey.delta);
        this.instance.exports.g1m_toMontgomery(pZ, pZ);
        this.instance.exports.g2m_toMontgomery(pDelta, pDelta);

        this.instance.exports.g1m_neg(pZ, pZ);
        const valid2 = this.instance.exports.mnt6753_pairingEq2(pYS, pDeltaPrime, pZ, pDelta, this.pOneT);

        return (valid1==1)&&(valid2==1);
    }



    async calculateYS(pA, pB, pC, pDeltaPrime, pYS) {
        const pBytes = this.alloc(768);
        const pBlakeResult = this.alloc(SIZEF1);

        const bits = [
            (this.i8[pA+96] & 1) == 1,
            ...unpackBits(this.i8.slice(pA, pA+96), 753),
            (this.i8[pB+96*3] & 1) == 1,
            ...unpackBits(this.i8.slice(pB, pB+96), 753),
            ...unpackBits(this.i8.slice(pB+96, pB+96*2), 753),
            ...unpackBits(this.i8.slice(pB+96*2, pB+96*3), 753),
            (this.i8[pC+96] & 1) == 1,
            ...unpackBits(this.i8.slice(pC, pC+96), 753),
            (this.i8[pDeltaPrime+96*3] & 1) == 1,
            ...unpackBits(this.i8.slice(pDeltaPrime, pDeltaPrime+96), 753),
            ...unpackBits(this.i8.slice(pDeltaPrime+96, pDeltaPrime+96*2), 753),
            ...unpackBits(this.i8.slice(pDeltaPrime+96*2, pDeltaPrime+96*3), 753),
        ];

        // Construct the bits array

        const bytes = packBits(bits);

        //        console.log("Bits: " + JSON.stringify(bits));

        const bytesbuff = bytes.buffer.slice();
        const res = await this.queueAction({
            command: "PEDERSEN_HASH",
            bytes: bytesbuff,
            bitLength: bits.length,
        }, [bytesbuff]);

        // console.log("Pedersen: " + this.bin2int(res).toString());

        const res8 = new Uint8Array(res.slice(0,95));

        const blakeResult = blakejs.blake2s(res8);

        this.instance.exports.f1m_zero(pBlakeResult);
        this.i8.set(blakeResult, pBlakeResult);


        // console.log("Blake: " + this.getInt(pBlakeResult).toString());

        this.instance.exports.f1m_toMontgomery(pBlakeResult, pBlakeResult);
        this.instance.exports.mnt6753_groupMap(pBlakeResult, pYS);

    }

    async verifyFused(verificationKey, input, proof) {

        if (input) {
            if  ((!Array.isArray(input))||(utils.isOcamNum(input))) input = [input];
        } else {
            input = [];
        }

        const oldAlloc = this.i32[0];

        let rnd = new Uint8Array(16);

        const pr = this.alloc(16);

        let br;
        if (inBrowser) {
            window.crypto.getRandomValues(rnd);
            this.putBin(pr, rnd);
        } else {
            br = NodeCrypto.randomBytes(16);
            this.putBin(pr, br);
        }


        const pA = this.alloc(SIZEF1*3);
        const pB = this.alloc(SIZEF1*9);
        const pAlfaBeta = this.alloc(SIZEF1*6);
        const pIC = this.alloc(SIZEF1*3);
        const pICaux = this.alloc(SIZEF1*3);
        const pICr = this.alloc(SIZEF1);
        const pC = this.alloc(SIZEF1*3);
        const pDeltaPrime = this.alloc(SIZEF1*9);
        const pYS = this.alloc(SIZEF1*3);
        const pZ = this.alloc(SIZEF1*3);
        const pDelta = this.alloc(SIZEF1*9);
        const pAcc = this.alloc(SIZEF1*6);
        const pAux = this.alloc(SIZEF1*6);

        this.setG1Affine(pA, proof.a);
        this.setG2Affine(pB, proof.b);
        this.setG1Affine(pC, proof.c);
        this.setG2Affine(pDeltaPrime, proof.deltaPrime);

        const promiseYS = this.calculateYS(pA, pB, pC, pDeltaPrime, pYS);

        this.instance.exports.g1m_toMontgomery(pA, pA);
        this.instance.exports.g2m_toMontgomery(pB, pB);

        this.instance.exports.g1m_toMontgomery(pC, pC);
        this.instance.exports.g2m_toMontgomery(pDeltaPrime, pDeltaPrime);

        this.instance.exports.g1m_neg(pC, pC);

        this.setG1Affine(pZ, proof.z);
        this.setG2Affine(pDelta, verificationKey.delta);
        this.instance.exports.g1m_toMontgomery(pZ, pZ);
        this.instance.exports.g2m_toMontgomery(pDelta, pDelta);
        this.instance.exports.g1m_neg(pZ, pZ);

        this.setF6(pAlfaBeta, verificationKey.alphaBeta);
        this.instance.exports.ftm_toMontgomery(pAlfaBeta, pAlfaBeta);
        this.instance.exports.ftm_exp(pAlfaBeta, pr, 16, pAlfaBeta);

        const prPre_B = this.precomputeG2(pB);
        const prPre_DeltaPrime = this.precomputeG2(pDeltaPrime);
        const prPre_G2gen = this.precomputeG2(this.pG2gen);



        this.setG1Affine(pIC, verificationKey.query[0]);
        this.instance.exports.g1m_toMontgomery(pIC, pIC);
        for (let i=0; i<input.length; i++) {
            this.setG1Affine(pICaux, verificationKey.query[i+1]);
            this.instance.exports.g1m_toMontgomery(pICaux, pICaux);

            this.setF1(pICr, input[i]);
            this.instance.exports.g1m_timesScalar(pICaux, pICr, SIZEF1, pICaux);

            this.instance.exports.g1m_add(pICaux, pIC, pIC);
        }
        this.instance.exports.g1m_affine(pIC, pIC);
        this.instance.exports.g1m_neg(pIC, pIC);

        const promises = [];

        const prPre_IC = this.precomputeG1Scaled(pIC, pr);
        promises.push(Promise.all([prPre_IC, prPre_G2gen]).then( (res) => {
            return this.computeLineFunctions(res[0], res[1]);
        }));

        const prPre_Delta = this.precomputeG2(pDelta);

        const prPre_YS = promiseYS.then( () => {
            return this.precomputeG1(pYS);
        });

        const prPre_A = this.precomputeG1Scaled(pA, pr);
        promises.push(Promise.all([prPre_A, prPre_B]).then( (res) => {
            return this.computeLineFunctions(res[0], res[1]);
        }));

        const promises2 = [];

        const prPre_C = this.precomputeG1Scaled(pC, pr);
        promises2.push(Promise.all([prPre_C, prPre_DeltaPrime]).then( (res) => {
            return this.computeLineFunctions(res[0], res[1]);
        }));

        promises2.push(Promise.all([prPre_YS, prPre_DeltaPrime]).then( (res) => {
            return this.computeLineFunctions(res[0], res[1]);
        }));

        const promises3 = [];
        const prPre_Z = this.precomputeG1(pZ);
        promises3.push(Promise.all([prPre_Z, prPre_Delta]).then( (res) => {
            return this.millerLoop(res[0], res[1]);
        }));

        const lineFunctionsResults = await (Promise.all(promises).
                                                      then((r1) => {

          const p1 = this.combineLineFunctions(r1[0], r1[1]);
          return p1;
        }));
        const lineFunctionsResults2 = await (Promise.all(promises2)
        .then((r2) => {
          const p2 = this.combineLineFunctions(r2[0], r2[1]);
          return p2;
        }));
        const combined = (Promise.all([lineFunctionsResults, lineFunctionsResults2])
                                            .then((r3) => {
                                              const p3 = this.combineLineFunctions(r3[0], r3[1]);
                                              return p3;
                                            })
                                            .then((p3) => {
                                              const p4 = this.fusedMillerLoop(p3);
                                              return p4;
                                            }));

        const p5 = Promise.all(promises3);
        const fin = await Promise.all([combined, p5]);

        this.putBin(pAcc, fin[0]);
        this.putBin(pAux, fin[1][0]);
        this.instance.exports.ftm_mul(pAcc, pAux, pAcc);

        /*
        const results = await Promise.all(promises);
        this.putBin(pAcc, results[0]);
        for (let i = 1; i<results.length; i++) {
            this.putBin(pAux, results[i]);
            this.instance.exports.ftm_mul(pAcc, pAux, pAcc);
        }
        */

        this.instance.exports.mnt6753_finalExponentiation(pAcc, pAcc);

        const valid = this.instance.exports.ftm_eq(pAcc, pAlfaBeta);
//        const valid = this.instance.exports.ftm_eq(pAcc, this.pOneT);

        this.i32[0] = oldAlloc;
        return (valid==1);
    }


    async verify(verificationKey, input, proof) {

        if (input) {
            if  ((!Array.isArray(input))||(utils.isOcamNum(input))) input = [input];
        } else {
            input = [];
        }

        const oldAlloc = this.i32[0];

        let rnd = new Uint8Array(16);

        const pr = this.alloc(16);

        let br;
        if (inBrowser) {
            window.crypto.getRandomValues(rnd);
            this.putBin(pr, rnd);
        } else {
            br = NodeCrypto.randomBytes(16);
            this.putBin(pr, br);
        }


        const promises = [];

        const pA = this.alloc(SIZEF1*3);
        const pB = this.alloc(SIZEF1*9);
        const pAlfaBeta = this.alloc(SIZEF1*6);
        const pIC = this.alloc(SIZEF1*3);
        const pICaux = this.alloc(SIZEF1*3);
        const pICr = this.alloc(SIZEF1);
        const pC = this.alloc(SIZEF1*3);
        const pDeltaPrime = this.alloc(SIZEF1*9);
        const pYS = this.alloc(SIZEF1*3);
        const pZ = this.alloc(SIZEF1*3);
        const pDelta = this.alloc(SIZEF1*9);
        const pAcc = this.alloc(SIZEF1*6);
        const pAux = this.alloc(SIZEF1*6);
        const pAo = this.alloc(SIZEF1*3);
        const pBo = this.alloc(SIZEF1*9);
        const pCo = this.alloc(SIZEF1*3);
        const pDeltaPrimeo = this.alloc(SIZEF1*9);


        // 1.- start the all precompute G2
        this.setG2Affine(pBo, proof.b);
        this.setG2Affine(pDeltaPrimeo, proof.deltaPrime);

        this.instance.exports.g2m_toMontgomery(pBo, pB);

        this.instance.exports.g2m_toMontgomery(pDeltaPrimeo, pDeltaPrime);

        this.setG2Affine(pDelta, verificationKey.delta);
        this.instance.exports.g2m_toMontgomery(pDelta, pDelta);

        const prPre_B = this.precomputeG2(pB);
        const prPre_DeltaPrime = this.precomputeG2(pDeltaPrime);
        const prPre_G2gen = this.precomputeG2(this.pG2gen);
        const prPre_Delta = this.precomputeG2(pDelta);

        // 2. Start calculate Ys
        this.setG1Affine(pAo, proof.a);
        this.setG1Affine(pCo, proof.c);

        const promiseYS = this.calculateYS(pAo, pBo, pCo, pDeltaPrimeo, pYS);

        // 3. Precompute G1
        this.instance.exports.g1m_toMontgomery(pAo, pA);
        this.instance.exports.g1m_toMontgomery(pCo, pC);
        this.instance.exports.g1m_neg(pC, pC);

        this.setG1Affine(pZ, proof.z);

        this.instance.exports.g1m_toMontgomery(pZ, pZ);
        this.instance.exports.g1m_neg(pZ, pZ);

        this.setG1Affine(pIC, verificationKey.query[0]);
        this.instance.exports.g1m_toMontgomery(pIC, pIC);
        for (let i=0; i<input.length; i++) {
            this.setG1Affine(pICaux, verificationKey.query[i+1]);
            this.instance.exports.g1m_toMontgomery(pICaux, pICaux);

            this.setF1(pICr, input[i]);
            if (this.instance.exports.int_gte(pICr, this.pr)) return false;
            this.instance.exports.g1m_timesScalar(pICaux, pICr, SIZEF1, pICaux);

            this.instance.exports.g1m_add(pICaux, pIC, pIC);
        }
        this.instance.exports.g1m_affine(pIC, pIC);
        this.instance.exports.g1m_neg(pIC, pIC);

        const prPre_IC = this.precomputeG1Scaled(pIC, pr);
        const prPre_A = this.precomputeG1Scaled(pA, pr);
        const prPre_C = this.precomputeG1Scaled(pC, pr);
        const prPre_YS = promiseYS.then( () => {
            return this.precomputeG1(pYS);
        });


        // 4. Miller loops
        promises.push(Promise.all([prPre_IC, prPre_G2gen]).then( (res) => {
            return this.millerLoop(res[0], res[1]);
        }));

        promises.push(Promise.all([prPre_A, prPre_B]).then( (res) => {
            return this.millerLoop(res[0], res[1]);
        }));

        promises.push(Promise.all([prPre_C, prPre_DeltaPrime]).then( (res) => {
            return this.millerLoop(res[0], res[1]);
        }));

        promises.push(Promise.all([prPre_YS, prPre_DeltaPrime]).then( (res) => {
            return this.millerLoop(res[0], res[1]);
        }));

        const prPre_Z = this.precomputeG1(pZ);
        promises.push(Promise.all([prPre_Z, prPre_Delta]).then( (res) => {
            return this.millerLoop(res[0], res[1]);
        }));

        // 5. AlfaBeta

        this.setF6(pAlfaBeta, verificationKey.alphaBeta);
        this.instance.exports.ftm_toMontgomery(pAlfaBeta, pAlfaBeta);
        this.instance.exports.ftm_exp(pAlfaBeta, pr, 16, pAlfaBeta);

        const results = await Promise.all(promises);

        // 6. Final
        this.putBin(pAcc, results[0]);
        for (let i = 1; i<results.length; i++) {
            this.putBin(pAux, results[i]);
            this.instance.exports.ftm_mul(pAcc, pAux, pAcc);
        }

        this.instance.exports.mnt6753_finalExponentiation(pAcc, pAcc);

        const valid = this.instance.exports.ftm_eq(pAcc, pAlfaBeta);

        this.i32[0] = oldAlloc;
        return (valid==1);
    }

}

module.exports = build;
