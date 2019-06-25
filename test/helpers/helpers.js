const bigInt = require("big-integer");

function genValues(n, neg, bitsPerWord) {
    bitsPerWord = bitsPerWord || 32;
    const res = [];
    res.push(bigInt.zero);
    for (let i=0; i<n; i++) {
        if (i>0) {
            res.push( bigInt.one.shiftLeft(bitsPerWord*i).minus(1));
        }
        if (i<n-1) {
            res.push( bigInt.one.shiftLeft(bitsPerWord*i));
            res.push( bigInt.one.shiftLeft(bitsPerWord*i).add(1));
        }
    }

    if (neg) {
        const nt= res.length;
        for (let i=0; i<nt; i++) res.push(bigInt.zero.minus(res[i]));
    }

    return res;
}

module.exports.genValues = genValues;
