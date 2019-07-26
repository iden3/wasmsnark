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

/* globals window */

const buildGroth16 = require("./src/groth16");
const utils = require("./src/utils");

buildGroth16().then((groth16) => {
    window.groth16 = groth16;
    window.zkSnarkProofToSolidityInput = utils.toSolidityInput;

    window.genZKSnarkProofAndWitness = function (input, circuitJson, provingKey, cb) {
        const p = utils.genWitnessAndProve(groth16, input, circuitJson, provingKey);
        if (cb) {
            p.then((proof) => {
                cb(null, proof);
            }, (err) => {
                cb(err);
            });
        } else {
            return p;
        }
    };

    window.genZKSnarkProof = function (witness, provingKey, cb) {
        const p = groth16.proof(witness, provingKey);
        if (cb) {
            p.then((proof) => {
                cb(null, proof);
            }, (err) => {
                cb(err);
            });
        } else {
            return p;
        }
    };
});