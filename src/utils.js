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

const bigInt = require("big-integer");
const Circuit = require("snarkjs/src/circuit");
const bigInt2 = require("snarkjs/src/bigint");
const hexifyBigInts = require("../tools/stringifybigint").hexifyBigInts;
const unhexifyBigInts = require("../tools/stringifybigint").unhexifyBigInts;
const stringifyBigInts = require("../tools/stringifybigint").stringifyBigInts;
const unstringifyBigInts = require("../tools/stringifybigint").unstringifyBigInts;
const stringifyBigInts2 = require("snarkjs/src/stringifybigint").stringifyBigInts;
const unstringifyBigInts2 = require("snarkjs/src/stringifybigint").unstringifyBigInts;

function bigInt2BytesLE(_a, len) {
    const b = Array(len);
    let v = bigInt(_a);
    for (let i=0; i<len; i++) {
        b[i] = v.and(0xFF).toJSNumber();
        v = v.shiftRight(8);
    }
    return b;
}

function bigInt2U32LE(_a, len) {
    const b = Array(len);
    let v = bigInt(_a);
    for (let i=0; i<len; i++) {
        b[i] = v.and(0xFFFFFFFF).toJSNumber();
        v = v.shiftRight(32);
    }
    return b;
}

function convertWitness(witness) {
    const buffLen = witness.length * 32;
    const buff = new ArrayBuffer(buffLen);
    const h = {
        dataView: new DataView(buff),
        offset: 0
    };
    const mask = bigInt2(0xFFFFFFFF);
    for (let i = 0; i < witness.length; i++) {
        for (let j = 0; j < 8; j++) {
            const v = Number(witness[i].shr(j * 32).and(mask));
            h.dataView.setUint32(h.offset, v, true);
            h.offset += 4;
        }
    }
    return buff;
}

function toHex32(number) {
    let str = number.toString(16);
    while (str.length < 64) str = "0" + str;
    return str;
}

function toSolidityInput(proof) {
    const flatProof = unstringifyBigInts([
        proof.pi_a[0], proof.pi_a[1],
        proof.pi_b[0][1], proof.pi_b[0][0],
        proof.pi_b[1][1], proof.pi_b[1][0],
        proof.pi_c[0], proof.pi_c[1],
    ]);
    const result = {
        proof: "0x" + flatProof.map(x => toHex32(x)).join("")
    };
    if (proof.publicSignals) {
        result.publicSignals = hexifyBigInts(unstringifyBigInts(proof.publicSignals));
    }
    return result;
}

function  genWitness(input, circuitJson) {
    const circuit = new Circuit(unstringifyBigInts2(circuitJson));
    const witness = circuit.calculateWitness(unstringifyBigInts2(input));
    const publicSignals = witness.slice(1, circuit.nPubInputs + circuit.nOutputs + 1);
    return {witness, publicSignals};
}

async function genWitnessAndProve(groth16, input, circuitJson, provingKey) {
    const witnessData = genWitness(input, circuitJson);
    const witnessBin = convertWitness(witnessData.witness);
    const result = await groth16.proof(witnessBin, provingKey);
    result.publicSignals = stringifyBigInts2(witnessData.publicSignals);
    return result;
}

module.exports = {bigInt2BytesLE, bigInt2U32LE, toSolidityInput, genWitnessAndProve};