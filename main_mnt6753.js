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

const buildMnt6753 = require("./src/mnt6753.js");

buildMnt6753().then( (mnt6753) => {
    window.mnt6753 = mnt6753;
    window.boweGabizonVerifier = function(verificationKey, input, proof) {

        return mnt6753.verifySync(verificationKey, input, proof);
    };
    window.boweGabizonVerifierFusedAsync = function(verificationKey, input, proof, cb) {

        const p = mnt6753.verifyFused(verificationKey, input, proof);

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

    window.boweGabizonVerifierAsync = function(verificationKey, input, proof, cb) {

        const p = mnt6753.verify(verificationKey, input, proof);

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



