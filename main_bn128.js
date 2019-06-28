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

const buildBn128 = require("./src/bn128.js");

buildBn128().then( (bn128) => {
    window.bn128 = bn128;
    window.groth16GenProof = function(witness, provingKey, cb) {

        const p = bn128.groth16GenProof(witness, provingKey);

        if (cb) {
            p.then( (proof) => {
                cb(null, proof);
            }, (err) => {
                cb(err);
            });
        } else {
            return p;
        }
    };

    window.groth16Verify = function(verificationKey, input, proof, cb) {

        const p = bn128.groth16Verify(verificationKey, input, proof);

        if (cb) {
            p.then( (proof) => {
                cb(null, proof);
            }, (err) => {
                cb(err);
            });
        } else {
            return p;
        }
    };
});


