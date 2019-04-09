const assert = require("assert");
const refBn128 = require("snarkjs").bn128;
const refBigInt = require("snarkjs").bigInt;

const buildBn128 = require("../index.js").buildBn128;

describe("Basic tests for g1 in bn128", () => {
    it("It should do a basic point doubling G1", async () => {
        const bn128 = await buildBn128();
        const refD = refBn128.G1.double(refBn128.g1);

        const p1 = bn128.g1_allocPoint(refBn128.g1);
        bn128.g1_toMontgomery(p1, p1);
        bn128.g1_double(p1, p1);
        bn128.g1_fromMontgomery(p1, p1);
        const d = bn128.g1_getPoint(p1);

        for (let i=0; i<3; i++) {
            d[i] = refBigInt(d[i].toString());
        }

        assert(refBn128.G1.equals(d, refD));
    });
    it("It should add two points G1", async () => {
        const bn128 = await buildBn128();
        const refD = refBn128.G1.affine(refBn128.G1.mulScalar(refBn128.g1, 3));

        const p1 = bn128.g1_allocPoint(refBn128.g1);
        bn128.g1_toMontgomery(p1, p1);
        bn128.g1_double(p1, p1);
        const p2 = bn128.g1_allocPoint(refBn128.g1);
        bn128.g1_toMontgomery(p2, p2);
        bn128.g1_add(p1, p2, p2);
        bn128.g1_affine(p2, p2);
        bn128.g1_fromMontgomery(p2, p2);
        const d = bn128.g1_getPoint(p2);

        d[0] = refBigInt(d[0].toString());
        d[1] = refBigInt(d[1].toString());
        d[2] = refBigInt(d[2].toString());


        assert(d[0].equals(refD[0]));
        assert(d[1].equals(refD[1]));
        assert(d[2].equals(1));

        assert(refBn128.G1.equals(d, refD));
    });
    it("It should timesScalar G1", async () => {
        const bn128 = await buildBn128();
        const refD = refBn128.G1.mulScalar(refBn128.g1, 55);

        const p1 = bn128.g1_allocPoint(refBn128.g1);
        bn128.g1_toMontgomery(p1, p1);

        const s = bn128.allocInt(55);
        bn128.g1_timesScalar(p1, s, 32, p1);

        bn128.g1_fromMontgomery(p1, p1);
        const d = bn128.g1_getPoint(p1);

        for (let i=0; i<3; i++) {
            d[i] = refBigInt(d[i].toString());
        }

        assert(refBn128.G1.equals(d, refD));
    });
    it("G1n == 0", async () => {
        const bn128 = await buildBn128();

        const p1 = bn128.g1_allocPoint(refBn128.g1);
        bn128.g1_toMontgomery(p1, p1);

        const s = bn128.allocInt(bn128.r);
        bn128.g1_timesScalar(p1, s, 32, p1);

        bn128.g1_fromMontgomery(p1, p1);

        assert(bn128.g1_isZero(p1));
    });
    it("It should do a test", async () => {
        const bn128 = await buildBn128();

        const t = bn128.test_AddG1(100000);

        console.log(t);
    }).timeout(10000000);
    it("It should validate the test", async () => {
        const bn128 = await buildBn128();
        const refD = refBn128.G1.mulScalar(refBn128.g1, 100000);

        const p1 = bn128.g1_allocPoint(refBn128.g1);
        bn128.g1_toMontgomery(p1, p1);
        const p2 = bn128.g1_allocPoint();
        bn128.testAddG1(100000, p1, p2);
        bn128.g1_fromMontgomery(p2, p2);
        const d = bn128.g1_getPoint(p2);

        for (let i=0; i<3; i++) {
            d[i] = refBigInt(d[i].toString());
        }

        assert(refBn128.G1.equals(d, refD));

    }).timeout(10000000);
    it("It should do a basic point doubling in G2", async () => {
        const bn128 = await buildBn128();
        const refD = refBn128.G2.double(refBn128.g2);

        const p1 = bn128.g2_allocPoint(refBn128.g2);
        bn128.g2_toMontgomery(p1, p1);
        bn128.g2_double(p1, p1);
        bn128.g2_fromMontgomery(p1, p1);
        const d = bn128.g2_getPoint(p1);

        for (let i=0; i<3; i++) {
            for (let j=0; j<2; j++) {
                d[i][j] = refBigInt(d[i][j].toString());
            }
        }

        assert(refBn128.G2.equals(d, refD));
    });
    it("It should add two points in G2", async () => {
        const bn128 = await buildBn128();
        const refD = refBn128.G2.affine(refBn128.G2.mulScalar(refBn128.g2, 3));

        const p1 = bn128.g2_allocPoint(refBn128.g2);
        bn128.g2_toMontgomery(p1, p1);
        bn128.g2_double(p1, p1);
        const p2 = bn128.g2_allocPoint(refBn128.g2);
        bn128.g2_toMontgomery(p2, p2);
        bn128.g2_add(p1, p2, p2);
        bn128.g2_affine(p2, p2);
        bn128.g2_fromMontgomery(p2, p2);
        const d = bn128.g2_getPoint(p2);

        for (let i=0; i<3; i++) {
            for (let j=0; j<2; j++) {
                d[i][j] = refBigInt(d[i][j].toString());
                assert(d[i][j].equals(refD[i][j]));
            }
        }

        assert(refBn128.G2.equals(d, refD));
    });
});
