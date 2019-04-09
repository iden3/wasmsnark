
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

const buildGroth16 = require("../index.js").buildGroth16;

describe("Basic tests for groth16 proof generator", () => {
    it("It should do a basic point doubling G1", async () => {
        const groth16 = await buildGroth16();

        const signals = fs.readFileSync(path.join(__dirname, "data", "witness.bin"));
        const provingKey = fs.readFileSync(path.join(__dirname, "data", "proving_key.bin"));
        const proofS = await groth16.proof(signals.buffer, provingKey.buffer);

        const proof = snarkjs.unstringifyBigInts(proofS);
        const verifierKey = snarkjs.unstringifyBigInts(JSON.parse(fs.readFileSync(path.join(__dirname, "data", "verification_key.json"), "utf8")));
        const pub = snarkjs.unstringifyBigInts(JSON.parse(fs.readFileSync(path.join(__dirname, "data", "public.json"), "utf8")));

        assert(snarkjs.groth.isValid(verifierKey, proof, pub));

        groth16.terminate();
    }).timeout(10000000);
});
