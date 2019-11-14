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
const groth16_wasm = require("../build/groth16_wasm.js");
const assert = require("assert");

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

    async function init(data) {
        const code = new Uint8Array(data.code);
        const wasmModule = await WebAssembly.compile(code);
        memory = new WebAssembly.Memory({initial:data.init});
        i32 = new Uint32Array(memory.buffer);

        instance = await WebAssembly.instantiate(wasmModule, {
            env: {
                "memory": memory
            }
        });
    }

    function alloc(length) {
        while (i32[0] & 3) i32[0]++;  // Return always aligned pointers
        const res = i32[0];
        i32[0] += length;
        while (i32[0] > memory.buffer.byteLength) {
            memory.grow(100);
        }
        i32 = new Uint32Array(memory.buffer);
        return res;
    }

    function putBin(b) {
        const p = alloc(b.byteLength);
        const s32 = new Uint32Array(b);
        i32.set(s32, p/4);
        return p;
    }

    function getBin(p, l) {
        return memory.buffer.slice(p, p+l);
    }

    self.onmessage = function(e) {
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
        } else if (data.command == "G1_MULTIEXP") {

            const oldAlloc = i32[0];
            const pScalars = putBin(data.scalars);
            const pPoints = putBin(data.points);
            const pRes = alloc(96);
            instance.exports.g1_zero(pRes);
            instance.exports.g1_multiexp2(pScalars, pPoints, data.n, 7, pRes);

            data.result = getBin(pRes, 96);
            i32[0] = oldAlloc;
            self.postMessage(data.result, [data.result]);
        } else if (data.command == "G2_MULTIEXP") {

            const oldAlloc = i32[0];
            const pScalars = putBin(data.scalars);
            const pPoints = putBin(data.points);
            const pRes = alloc(192);
            instance.exports.g2_zero(pRes);
            instance.exports.g2_multiexp(pScalars, pPoints, data.n, 7, pRes);

            data.result = getBin(pRes, 192);
            i32[0] = oldAlloc;
            self.postMessage(data.result, [data.result]);
        } else if (data.command == "CALC_H") {
            const oldAlloc = i32[0];
            const pSignals = putBin(data.signals);
            const pPolsA = putBin(data.polsA);
            const pPolsB = putBin(data.polsB);
            const nSignals = data.nSignals;
            const domainSize = data.domainSize;
            const pSignalsM = alloc(nSignals*32);
            const pPolA = alloc(domainSize*32);
            const pPolB = alloc(domainSize*32);
            const pPolA2 = alloc(domainSize*32*2);
            const pPolB2 = alloc(domainSize*32*2);

            instance.exports.fft_toMontgomeryN(pSignals, pSignalsM, nSignals);

            instance.exports.pol_zero(pPolA, domainSize);
            instance.exports.pol_zero(pPolB, domainSize);

            instance.exports.pol_constructLC(pPolsA, pSignalsM, nSignals, pPolA);
            instance.exports.pol_constructLC(pPolsB, pSignalsM, nSignals, pPolB);

            instance.exports.fft_copyNInterleaved(pPolA, pPolA2, domainSize);
            instance.exports.fft_copyNInterleaved(pPolB, pPolB2, domainSize);

            instance.exports.fft_ifft(pPolA, domainSize, 0);
            instance.exports.fft_ifft(pPolB, domainSize, 0);
            instance.exports.fft_fft(pPolA, domainSize, 1);
            instance.exports.fft_fft(pPolB, domainSize, 1);

            instance.exports.fft_copyNInterleaved(pPolA, pPolA2+32, domainSize);
            instance.exports.fft_copyNInterleaved(pPolB, pPolB2+32, domainSize);

            instance.exports.fft_mulN(pPolA2, pPolB2, domainSize*2, pPolA2);

            instance.exports.fft_ifft(pPolA2, domainSize*2, 0);

            instance.exports.fft_fromMontgomeryN(pPolA2+domainSize*32, pPolA2+domainSize*32, domainSize);

            data.result = getBin(pPolA2+domainSize*32, domainSize*32);
            i32[0] = oldAlloc;
            self.postMessage(data.result, [data.result]);
        } else if (data.command == "TERMINATE") {
            process.exit();
        }
    };
}

// We use the Object.assign approach for the backwards compatibility
// @params Number wasmInitialMemory 
async function build(params) {
    const defaultParams = { wasmInitialMemory: 5000 };
    Object.assign(defaultParams, params);
    const groth16 = new Groth16();

    groth16.q = bigInt("21888242871839275222246405745257275088696311157297823662689037894645226208583");
    groth16.r = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    groth16.n64 = Math.floor((groth16.q.minus(1).bitLength() - 1)/64) +1;
    groth16.n32 = groth16.n64*2;
    groth16.n8 = groth16.n64*8;

    groth16.memory = new WebAssembly.Memory({initial:defaultParams.wasmInitialMemory});
    groth16.i32 = new Uint32Array(groth16.memory.buffer);

    const wasmModule = await WebAssembly.compile(groth16_wasm.code);

    groth16.instance = await WebAssembly.instantiate(wasmModule, {
        env: {
            "memory": groth16.memory
        }
    });

    groth16.pq = groth16_wasm.pq;
    groth16.pr = groth16_wasm.pr;

    groth16.pr0 = groth16.alloc(192);
    groth16.pr1 = groth16.alloc(192);

    groth16.workers = [];
    groth16.pendingDeferreds = [];
    groth16.working = [];

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

            groth16.working[i]=false;
            groth16.pendingDeferreds[i].resolve(data);
            groth16.processWorks();
        };
    }

    for (let i = 0; i<concurrency; i++) {

        if (inBrowser) {
            const blob = new Blob(["(", thread.toString(), ")(self);"], { type: "text/javascript" });
            const url = URL.createObjectURL(blob);

            groth16.workers[i] = new Worker(url);

            groth16.workers[i].onmessage = getOnMsg(i);

        } else {
            groth16.workers[i] = new NodeWorker("(" + thread.toString()+ ")(require('worker_threads').parentPort);", {eval: true});

            groth16.workers[i].on("message", getOnMsg(i));
        }

        groth16.working[i]=false;
    }

    const initPromises = [];
    for (let i=0; i<groth16.workers.length;i++) {
        const copyCode = groth16_wasm.code.buffer.slice(0);
        initPromises.push(groth16.postAction(i, {
            command: "INIT",
            init: defaultParams.wasmInitialMemory,
            code: copyCode

        }, [copyCode]));
    }

    await Promise.all(initPromises);

    return groth16;
}

class Groth16 {
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
        const s32 = new Uint32Array(b);
        this.i32.set(s32, p/4);
    }

    getBin(p, l) {
        return this.memory.buffer.slice(p, p+l);
    }

    bin2int(b) {
        const i32 = new Uint32Array(b);
        let acc = bigInt(i32[7]);
        for (let i=6; i>=0; i--) {
            acc = acc.shiftLeft(32);
            acc = acc.add(i32[i]);
        }
        return acc.toString();
    }

    bin2g1(b) {
        return [
            this.bin2int(b.slice(0,32)),
            this.bin2int(b.slice(32,64)),
            this.bin2int(b.slice(64,96)),
        ];
    }
    bin2g2(b) {
        return [
            [
                this.bin2int(b.slice(0,32)),
                this.bin2int(b.slice(32,64))
            ],
            [
                this.bin2int(b.slice(64,96)),
                this.bin2int(b.slice(96,128))
            ],
            [
                this.bin2int(b.slice(128,160)),
                this.bin2int(b.slice(160,192))
            ],
        ];
    }

    async g1_multiexp(scalars, points) {
        const nPoints = scalars.byteLength /32;
        const nPointsPerThread = Math.floor(nPoints / this.workers.length);
        const opPromises = [];
        for (let i=0; i<this.workers.length; i++) {
            const th_nPoints =
                i < this.workers.length -1 ?
                    nPointsPerThread :
                    nPoints - (nPointsPerThread * (this.workers.length -1));
            const scalars_th = scalars.slice(i*nPointsPerThread*32, i*nPointsPerThread*32 + th_nPoints*32);
            const points_th = points.slice(i*nPointsPerThread*64, i*nPointsPerThread*64 + th_nPoints*64);
            opPromises.push(
                this.queueAction({
                    command: "G1_MULTIEXP",
                    scalars: scalars_th,
                    points: points_th,
                    n: th_nPoints
                }, [scalars_th, points_th])
            );
        }

        const results = await Promise.all(opPromises);

        this.instance.exports.g1_zero(this.pr0);
        for (let i=0; i<results.length; i++) {
            this.putBin(this.pr1, results[i]);
            this.instance.exports.g1_add(this.pr0, this.pr1, this.pr0);
        }

        return this.getBin(this.pr0, 96);
    }

    async g2_multiexp(scalars, points) {
        const nPoints = scalars.byteLength /32;
        const nPointsPerThread = Math.floor(nPoints / this.workers.length);
        const opPromises = [];
        for (let i=0; i<this.workers.length; i++) {
            const th_nPoints =
                i < this.workers.length -1 ?
                    nPointsPerThread :
                    nPoints - (nPointsPerThread * (this.workers.length -1));
            const scalars_th = scalars.slice(i*nPointsPerThread*32, i*nPointsPerThread*32 + th_nPoints*32);
            const points_th = points.slice(i*nPointsPerThread*128, i*nPointsPerThread*128 + th_nPoints*128);
            opPromises.push(
                this.queueAction({
                    command: "G2_MULTIEXP",
                    scalars: scalars_th,
                    points: points_th,
                    n: th_nPoints
                }, [scalars_th, points_th])
            );
        }

        const results = await Promise.all(opPromises);

        this.instance.exports.g2_zero(this.pr0);
        for (let i=0; i<results.length; i++) {
            this.putBin(this.pr1, results[i]);
            this.instance.exports.g2_add(this.pr0, this.pr1, this.pr0);
        }

        return this.getBin(this.pr0, 192);
    }

    g1_affine(p) {
        this.putBin(this.pr0, p);
        this.instance.exports.g1_affine(this.pr0, this.pr0);
        return this.getBin(this.pr0, 96);
    }

    g2_affine(p) {
        this.putBin(this.pr0, p);
        this.instance.exports.g2_affine(this.pr0, this.pr0);
        return this.getBin(this.pr0, 192);
    }

    g1_fromMontgomery(p) {
        this.putBin(this.pr0, p);
        this.instance.exports.g1_fromMontgomery(this.pr0, this.pr0);
        return this.getBin(this.pr0, 96);
    }

    g2_fromMontgomery(p) {
        this.putBin(this.pr0, p);
        this.instance.exports.g2_fromMontgomery(this.pr0, this.pr0);
        return this.getBin(this.pr0, 192);
    }

    loadPoint1(b) {
        const p = this.alloc(96);
        this.putBin(p, b);
        this.instance.exports.f1m_one(p+64);
        return p;
    }

    loadPoint2(b) {
        const p = this.alloc(192);
        this.putBin(p, b);
        this.instance.exports.f2m_one(p+128);
        return p;
    }

    terminate() {
        for (let i=0; i<this.workers.length; i++) {
            this.workers[i].postMessage({command: "TERMINATE"});
        }
    }


    async calcH(signals, polsA, polsB, nSignals, domainSize) {
        return this.queueAction({
            command: "CALC_H",
            signals: signals,
            polsA: polsA,
            polsB: polsB,
            nSignals: nSignals,
            domainSize: domainSize
        }, [signals, polsA, polsB]);
    }

    async proof(signals, pkey) {
        const pkey32 = new Uint32Array(pkey);
        const nSignals = pkey32[0];
        const nPublic = pkey32[1];
        const domainSize = pkey32[2];
        const pPolsA = pkey32[3];
        const pPolsB = pkey32[4];
        const pPointsA = pkey32[5];
        const pPointsB1 = pkey32[6];
        const pPointsB2 = pkey32[7];
        const pPointsC = pkey32[8];
        const pHExps = pkey32[9];
        const polsA = pkey.slice(pPolsA, pPolsA + pPolsB);
        const polsB = pkey.slice(pPolsB, pPolsB + pPointsA);
        const pointsA = pkey.slice(pPointsA, pPointsA + nSignals*64);
        const pointsB1 = pkey.slice(pPointsB1, pPointsB1 + nSignals*64);
        const pointsB2 = pkey.slice(pPointsB2, pPointsB2 + nSignals*128);
        const pointsC = pkey.slice(pPointsC, pPointsC + (nSignals-nPublic-1)*64);
        const pointsHExps = pkey.slice(pHExps, pHExps + domainSize*64);

        const alfa1 = pkey.slice(10*4, 10*4 + 64);
        const beta1 = pkey.slice(10*4 + 64, 10*4 + 128);
        const delta1 = pkey.slice(10*4 + 128, 10*4 + 192);
        const beta2 = pkey.slice(10*4 + 192, 10*4 + 320);
        const delta2 = pkey.slice(10*4 + 320, 10*4 + 448);


        const pH = this.calcH(signals.slice(0), polsA, polsB, nSignals, domainSize).then( (h) => {
            /* Debug code to print the result of h
            for (let i=0; i<domainSize; i++) {
                const a = this.bin2int(h.slice(i*32, i*32+32));
                console.log(i + " -> " + a.toString());
            }
*/
            return this.g1_multiexp(h, pointsHExps);
        });

        const pA = this.g1_multiexp(signals.slice(0), pointsA);
        const pB1 = this.g1_multiexp(signals.slice(0), pointsB1);
        const pB2 = this.g2_multiexp(signals.slice(0), pointsB2);
        const pC = this.g1_multiexp(signals.slice((nPublic+1)*32), pointsC);

        const res = await Promise.all([pA, pB1, pB2, pC, pH]);

        const pi_a = this.alloc(96);
        const pi_b = this.alloc(192);
        const pi_c = this.alloc(96);
        const pib1 = this.alloc(96);


        this.putBin(pi_a, res[0]);
        this.putBin(pib1, res[1]);
        this.putBin(pi_b, res[2]);
        this.putBin(pi_c, res[3]);

        const pAlfa1 = this.loadPoint1(alfa1);
        const pBeta1 = this.loadPoint1(beta1);
        const pDelta1 = this.loadPoint1(delta1);
        const pBeta2 = this.loadPoint2(beta2);
        const pDelta2 = this.loadPoint2(delta2);


        let rnd = new Uint32Array(8);

        const aux1 = this.alloc(96);
        const aux2 = this.alloc(192);

        const pr = this.alloc(32);
        const ps = this.alloc(32);

        if (inBrowser) {
            window.crypto.getRandomValues(rnd);
            this.putBin(pr, rnd);

            window.crypto.getRandomValues(rnd);
            this.putBin(ps, rnd);
        } else {
            const br = NodeCrypto.randomBytes(32);
            this.putBin(pr, br);
            const bs = NodeCrypto.randomBytes(32);
            this.putBin(ps, bs);
        }

        /// Uncoment it to debug and check it works
        //        this.instance.exports.f1m_zero(pr);
        //        this.instance.exports.f1m_zero(ps);

        // pi_a = pi_a + Alfa1 + r*Delta1
        this.instance.exports.g1_add(pAlfa1, pi_a, pi_a);
        this.instance.exports.g1_timesScalar(pDelta1, pr, 32, aux1);
        this.instance.exports.g1_add(aux1, pi_a, pi_a);

        // pi_b = pi_b + Beta2 + s*Delta2
        this.instance.exports.g2_add(pBeta2, pi_b, pi_b);
        this.instance.exports.g2_timesScalar(pDelta2, ps, 32, aux2);
        this.instance.exports.g2_add(aux2, pi_b, pi_b);

        // pib1 = pib1 + Beta1 + s*Delta1
        this.instance.exports.g1_add(pBeta1, pib1, pib1);
        this.instance.exports.g1_timesScalar(pDelta1, ps, 32, aux1);
        this.instance.exports.g1_add(aux1, pib1, pib1);


        // pi_c = pi_c + pH
        this.putBin(aux1, res[4]);
        this.instance.exports.g1_add(aux1, pi_c, pi_c);


        // pi_c = pi_c + s*pi_a
        this.instance.exports.g1_timesScalar(pi_a, ps, 32, aux1);
        this.instance.exports.g1_add(aux1, pi_c, pi_c);

        // pi_c = pi_c + r*pib1
        this.instance.exports.g1_timesScalar(pib1, pr, 32, aux1);
        this.instance.exports.g1_add(aux1, pi_c, pi_c);

        // pi_c = pi_c - r*s*delta1
        const prs = this.alloc(64);
        this.instance.exports.int_mul(pr, ps, prs);
        this.instance.exports.g1_timesScalar(pDelta1, prs, 64, aux1);
        this.instance.exports.g1_neg(aux1, aux1);
        this.instance.exports.g1_add(aux1, pi_c, pi_c);

        this.instance.exports.g1_affine(pi_a, pi_a);
        this.instance.exports.g2_affine(pi_b, pi_b);
        this.instance.exports.g1_affine(pi_c, pi_c);

        this.instance.exports.g1_fromMontgomery(pi_a, pi_a);
        this.instance.exports.g2_fromMontgomery(pi_b, pi_b);
        this.instance.exports.g1_fromMontgomery(pi_c, pi_c);

        return {
            pi_a: this.bin2g1(this.getBin(pi_a, 96)),
            pi_b: this.bin2g2(this.getBin(pi_b, 192)),
            pi_c: this.bin2g1(this.getBin(pi_c, 96)),
        };

    }

}

module.exports = build;
