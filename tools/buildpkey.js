const bigInt = require("big-integer");
const assert = require("assert");

function writeUint32(h, val) {
    h.dataView.setUint32(h.offset, val, true);
    h.offset += 4;
}

function writeUint32ToPointer(h, p, val) {
    h.dataView.setUint32(p, val, true);
}


function alloc(h, n) {
    const o = h.offset;
    h.offset += n;
    return o;
}

function writeBigInt(h, bi) {
    for (let i=0; i<8; i++) {
        const v = bi.shiftRight(i*32).and(0xFFFFFFFF).toJSNumber();
        writeUint32(h, v);
    }
}

function toMontgomeryQ(p) {
    const q = bigInt("21888242871839275222246405745257275088696311157297823662689037894645226208583");
    return p.times(bigInt.one.shiftLeft(256)).mod(q);
}

function toMontgomeryR(p) {
    const r = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    return p.times(bigInt.one.shiftLeft(256)).mod(r);
}

function writePoint(h, p) {
    writeBigInt(h, toMontgomeryQ(p[0]));
    writeBigInt(h, toMontgomeryQ(p[1]));
}

function writePoint2(h, p) {
    writeBigInt(h, toMontgomeryQ(p[0][0]));
    writeBigInt(h, toMontgomeryQ(p[0][1]));
    writeBigInt(h, toMontgomeryQ(p[1][0]));
    writeBigInt(h, toMontgomeryQ(p[1][1]));
}

function writeTransformedPolynomial(h, p) {

    const keys = Object.keys(p);

    writeUint32(h, keys.length);

    for (let i=0; i<keys.length; i++) {
        writeUint32(h, keys[i]);
        writeBigInt(h, toMontgomeryR(p[keys[i]]));
    }
}

function calculateBuffLen(provingKey) {
    function polSize(pol) {
        const l= Object.keys(pol).length;
        return 36*l + 4;
    }

    let size = 40;

    // alfa1, beta1, delta1
    size += 3 * (32*2);

    // beta2, delta2
    size += 2 * (32*4);

    for (let i=0; i<provingKey.nVars; i++) {
        size += polSize(provingKey.polsA[i]);
        size += polSize(provingKey.polsB[i]);
    }

    size += provingKey.nVars* (32*2);
    size += provingKey.nVars* (32*2);
    size += provingKey.nVars* (32*4);
    size += (provingKey.nVars - provingKey.nPublic  - 1)* (32*2);
    size += provingKey.domainSize * (32*2);

    return size;
}


function buildPKey(provingKey) {
    const buffLen = calculateBuffLen(provingKey);

    const buff = new ArrayBuffer(buffLen);

    const h = {
        dataView: new DataView(buff),
        offset: 0
    };


    writeUint32(h, provingKey.nVars);
    writeUint32(h, provingKey.nPublic);
    writeUint32(h, provingKey.domainSize);
    const pPolsA = alloc(h, 4);
    const pPolsB = alloc(h, 4);
    const pPointsA = alloc(h, 4);
    const pPointsB1 = alloc(h, 4);
    const pPointsB2 = alloc(h, 4);
    const pPointsC = alloc(h, 4);
    const pPointsHExps = alloc(h, 4);

    writePoint(h, provingKey.vk_alfa_1);
    writePoint(h, provingKey.vk_beta_1);
    writePoint(h, provingKey.vk_delta_1);
    writePoint2(h, provingKey.vk_beta_2);
    writePoint2(h, provingKey.vk_delta_2);

    writeUint32ToPointer(h, pPolsA, h.offset);
    for (let i=0; i<provingKey.nVars; i++) {
        writeTransformedPolynomial(h, provingKey.polsA[i]);
    }

    writeUint32ToPointer(h, pPolsB, h.offset);
    for (let i=0; i<provingKey.nVars; i++) {
        writeTransformedPolynomial(h, provingKey.polsB[i]);
    }

    writeUint32ToPointer(h, pPointsA, h.offset);
    for (let i=0; i<provingKey.nVars; i++) {
        writePoint(h, provingKey.A[i]);
    }

    writeUint32ToPointer(h, pPointsB1, h.offset);
    for (let i=0; i<provingKey.nVars; i++) {
        writePoint(h, provingKey.B1[i]);
    }

    writeUint32ToPointer(h, pPointsB2, h.offset);
    for (let i=0; i<provingKey.nVars; i++) {
        writePoint2(h, provingKey.B2[i]);
    }

    writeUint32ToPointer(h, pPointsC, h.offset);
    for (let i=provingKey.nPublic+1; i<provingKey.nVars; i++) {
        writePoint(h, provingKey.C[i]);
    }

    writeUint32ToPointer(h, pPointsHExps, h.offset);
    for (let i=0; i<provingKey.domainSize; i++) {
        writePoint(h, provingKey.hExps[i]);
    }

    assert.equal(h.offset, buffLen);

    return Buffer.from(buff);
}

module.exports = buildPKey;

/*
NSignals
NPublic
DomainSize (2 multiple)
pPolsA
pPolsB
pPointsA
pPointsB1
pPointsB2
pPointsC
pPointsHExps
Alfa1
Beta1
Delta1
Beta2
Delta2
    PolinomialA_0
    PolinomialA_1
    PolinomialA_2
    ...
    PolinomialA_NVars-1

    PolinomialB_0
    PolinomialB_1
    PolinomialB_2
    ...
    PolinomialB_NVars-1

    PointA_0
    PointA_1
    ...
    PointA_NVars-1

    PointB1_0
    PointB1_1
    ...
    PointB1_NVars-1

    PointB2_0
    PointB2_1
    ...
    PointB2_NVars-1

    PointC_nPublics+1
    PointC_nPublics+2
    ...
    PointC_nPublics+NVars

    PointHExp_0
    PointHExp_1
    ...
    PointHExp_DomainSize-1
*/
