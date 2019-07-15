/*
    Copyright 2018 0kims association.

    This file is part of snarkjs.

    snarkjs is a free software: you can redistribute it and/or
    modify it under the terms of the GNU General Public License as published by the
    Free Software Foundation, either version 3 of the License, or (at your option)
    any later version.

    snarkjs is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
    more details.

    You should have received a copy of the GNU General Public License along with
    snarkjs. If not, see <https://www.gnu.org/licenses/>.
*/

const bigInt = require("big-integer");

module.exports.stringifyBigInts = stringifyBigInts;
module.exports.unstringifyBigInts = unstringifyBigInts;
module.exports.hexifyBigInts = hexifyBigInts;
module.exports.unhexifyBigInts = unhexifyBigInts;

function stringifyBigInts(o) {
    if ((typeof(o) == "bigint") || (o instanceof bigInt))  {
        return o.toString(10);
    } else if (Array.isArray(o)) {
        return o.map(stringifyBigInts);
    } else if (typeof o == "object") {
        const res = {};
        for (let k in o) {
            res[k] = stringifyBigInts(o[k]);
        }
        return res;
    } else {
        return o;
    }
}

function unstringifyBigInts(o) {
    if ((typeof(o) == "string") && (/^[0-9]+$/.test(o) ))  {
        return bigInt(o);
    } else if (Array.isArray(o)) {
        return o.map(unstringifyBigInts);
    } else if (typeof o == "object" && !(o instanceof bigInt)) {
        const res = {};
        for (let k in o) {
            res[k] = unstringifyBigInts(o[k]);
        }
        return res;
    } else {
        return o;
    }
}

function hexifyBigInts(o) {
    if (typeof (o) === "bigInt" || (o instanceof bigInt)) {
        let str = o.toString(16);
        while (str.length < 64) str = "0" + str;
        str = "0x" + str;
        return str;
    } else if (Array.isArray(o)) {
        return o.map(hexifyBigInts);
    } else if (typeof o == "object") {
        const res = {};
        for (let k in o) {
            res[k] = hexifyBigInts(o[k]);
        }
        return res;
    } else {
        return o;
    }
}

function unhexifyBigInts(o) {
    if ((typeof(o) == "string") && (/^0x[0-9a-fA-F]+$/.test(o)))  {
        return bigInt(o);
    } else if (Array.isArray(o)) {
        return o.map(unhexifyBigInts);
    } else if (typeof o == "object") {
        const res = {};
        for (let k in o) {
            res[k] = unhexifyBigInts(o[k]);
        }
        return res;
    } else {
        return o;
    }
}
