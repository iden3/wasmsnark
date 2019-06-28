
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

const buildBn128 = require("../index.js").buildBn128;

describe("Basic tests for bn128 proof generator", () => {
    it("should do basic multiexponentiation", async () => {
        const bn128 = await buildBn128();

        const signalsAll = fs.readFileSync(path.join(__dirname, "data", "witness.bin"));
        const provingKey = fs.readFileSync(path.join(__dirname, "data", "proving_key.bin"));

        const nSignals = 1;

        const pkey32 = new Uint32Array(provingKey);
        const pPointsA = pkey32[5];

        const points = provingKey.slice(pPointsA, pPointsA + nSignals*64);
        const signals = signalsAll.slice(0, nSignals*32);

        const pr1 = bn128.alloc(96);
        const pPoints = bn128.alloc(points.byteLength);
        bn128.putBin(pPoints, points);

        const pSignals = bn128.alloc(signals.byteLength);
        bn128.putBin(pSignals, signals);

        bn128.instance.exports.g1m_zero(pr1);
        bn128.instance.exports.g1m_multiexp(pSignals, pPoints, nSignals, 1, pr1);
        bn128.instance.exports.g1m_affine(pr1, pr1);
        bn128.instance.exports.g1m_fromMontgomery(pr1, pr1);

        const r1 = bn128.bin2g1(bn128.getBin(pr1, 96));

        bn128.instance.exports.g1m_zero(pr1);
        bn128.instance.exports.g1m_multiexp2(pSignals, pPoints, nSignals, 1, pr1);
        bn128.instance.exports.g1m_affine(pr1, pr1);
        bn128.instance.exports.g1m_fromMontgomery(pr1, pr1);

        const r2 = bn128.bin2g1(bn128.getBin(pr1, 96));

        assert.equal(r1[0],r2[0]);
        assert.equal(r1[1],r2[1]);

        bn128.terminate();

    });

    it("It should do a zkSnark test", async () => {
        const bn128 = await buildBn128();

        const signals = fs.readFileSync(path.join(__dirname, "data", "witness.bin"));
        const provingKey = fs.readFileSync(path.join(__dirname, "data", "proving_key.bin"));
        const proofS = await bn128.proof(signals.buffer, provingKey.buffer);

        const proof = snarkjs.unstringifyBigInts(proofS);
        const verifierKey = snarkjs.unstringifyBigInts(JSON.parse(fs.readFileSync(path.join(__dirname, "data", "verification_key.json"), "utf8")));
        const pub = snarkjs.unstringifyBigInts(JSON.parse(fs.readFileSync(path.join(__dirname, "data", "public.json"), "utf8")));

        assert(snarkjs.groth.isValid(verifierKey, proof, pub));

        bn128.terminate();
    }).timeout(10000000);

});
