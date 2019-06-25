const assert = require("assert");
const bigInt = require("big-integer");

const buildF1 = require("../index.js").buildF1;
const buildF1m = require("../src/build_f1m");
const buildProtoboard = require("../src/protoboard.js");
const buildTest = require("../src/build_test.js");

describe("Basic tests for Zq", () => {
    it("It should do a basic addition", async () => {
        const f1 = await buildF1(101);

        const pA = f1.allocInt(3);
        const pB = f1.allocInt(4);
        const pC = f1.allocInt();
        f1.f1_add(pA, pB, pC);

        const c = f1.getInt(pC);
        assert.equal(c, 7);
    });
    it("Should add with 2 chunks", async () => {
        const f1 = await buildF1(bigInt("100000000000000000001", 16));

        const pA = f1.allocInt(bigInt("FFFFFFFFFFFFFFFF", 16));
        const pB = f1.allocInt(1);
        const pC = f1.allocInt();

        f1.f1_add(pA, pB, pC);
        const c = f1.getInt(pC);

        assert(c.equals(bigInt("10000000000000000", 16)));
    });
    it("Should add with 2 chunks overflow", async () => {
        const q = bigInt("10000000000000001", 16);
        const f1 = await buildF1(q);

        const pA = f1.allocInt(bigInt("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", 16).mod(q));
        const pB = f1.allocInt(1);
        const pC = f1.allocInt();

        f1.f1_add(pA, pB, pC);
        const c = f1.getInt(pC);

        assert(c.equals(1));
    });
    it("Should add with double overflow", async () => {
        const q = bigInt(1).shiftLeft(255).add(1);
        const a = bigInt(1).shiftLeft(256).minus(1).mod(q);
        const f1 = await buildF1(q);

        const pA = f1.allocInt(a);
        const pC = f1.allocInt();

        f1.f1_add(pA, pA, pC);

        const c = f1.getInt(pC);
        assert(c.equals(a.add(a).mod(q)));
    });
    it("It should do a basic substraction", async () => {
        const f1 = await buildF1(101);

        const pA = f1.allocInt(5);
        const pB = f1.allocInt(3);
        const pC = f1.allocInt();

        f1.f1_sub(pA, pB, pC);
        const c = f1.getInt(pC);

        assert.equal(c, 2);
    });
    it("It should do a basic substraction with negative result", async () => {
        const f1 = await buildF1(101);

        const pA = f1.allocInt(3);
        const pB = f1.allocInt(5);
        const pC = f1.allocInt();

        f1.f1_sub(pA, pB, pC);
        const c = f1.getInt(pC);

        assert.equal(c.mod(101), 99);
    });
    it("Should substract with 2 chunks overflow", async () => {
        const q = bigInt("10000000000000001", 16);
        const a = bigInt("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", 16).mod(q);
        const f1 = await buildF1(q);

        const pA = f1.allocInt(1);
        const pB = f1.allocInt(a);
        const pC = f1.allocInt();

        f1.f1_sub(pA, pB, pC);
        const c = f1.getInt(pC);

        let d = bigInt.one.minus(a).mod(q);
        if (d.isNegative()) d = d.add(q);

        assert(c.equals(d));
    });
    it("It should Substract a big number", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const f1 = await buildF1(q);

        const a = bigInt("10000242871839275222246405745257275088548364400416034343698204186575808495617");
        const b = bigInt("10000242871839275222246405745257275088548364400416034343698204186575808234523");

        const pA = f1.allocInt(a);
        const pB = f1.allocInt(b);
        const pC = f1.allocInt();

        f1.f1_sub(pA, pB, pC);
        const c = f1.getInt(pC);

        let cc = a.minus(b).mod(q);
        if (cc.isNegative()) cc = cc.add(q);
        assert(cc.equals(c.mod(q)));


        const pAA = f1.allocInt(b);
        const pBB = f1.allocInt(a);
        const pCC = f1.allocInt();

        f1.f1_sub(pAA, pBB, pCC);
        const d = f1.getInt(pCC);

        let dd = b.minus(a).mod(q);
        if (dd.isNegative()) dd = dd.add(q);
        assert(dd.equals(d.mod(q)));
    });

    it("It should do a basic multiplication", async () => {
        const f1 = await buildF1(101);

        const pA = f1.allocInt(3);
        const pB = f1.allocInt(4);
        const pC = f1.allocInt2();

        f1.int_mul(pA, pB, pC);
        const c = f1.getInt2(pC);

        assert.equal(c, 12);
    });

    it("It should do a basic division", async () => {
        const f1 = await buildF1(101);

        const pA = f1.allocInt(12);
        const pB = f1.allocInt(6);
        const pC = f1.allocInt();
        f1.int_div(pA, pB, pC);

        const c = f1.getInt(pC);
        assert.equal(c, 2);
    });
    it("It should do a more complex division", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const f1 = await buildF1(q);

        const pA = f1.allocInt(bigInt("FFFF00000000", 16));
        const pB = f1.allocInt(bigInt("100000000", 16));
        const pC = f1.allocInt();
        f1.int_div(pA, pB, pC);

        const c = f1.getInt(pC);
        assert(c.equals(bigInt("FFFF", 16)));
    });
    it("It should do a division by zero", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const f1 = await buildF1(q);

        const pA = f1.allocInt(bigInt("FFFF00000000", 16));
        const pB = f1.allocInt(0);
        const pC = f1.allocInt();
        try {
            f1.int_div(pA, pB, pC);
            assert(false, "Didn't throw...");
        } catch (err) {
            assert.equal(err.toString(), "RuntimeError: divide by zero");
        }
    });

    it("It should do a various division", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const f1 = await buildF1(q);


        const v= [
            bigInt.zero,
            q.minus(1),
            q.minus(2),
            q.minus(1).shiftRight(1),
            q.minus(1).shiftRight(1).add(1),
            q.minus(1).shiftRight(1).add(2),
            q.minus(1).shiftRight(1).minus(1),
            q.minus(1).shiftRight(1).minus(2),
            bigInt(bigInt("F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0", 16)),
            bigInt(bigInt("10101010101010101010101010101010", 16)),
            bigInt(bigInt("FF00FF00FF00FF00FF00FF00FF00FF00", 16)),
            bigInt(bigInt("11001100110011001100110011001100", 16)),
            bigInt(bigInt("F0F0F0F0F0F0F0F0", 16)),
            bigInt(bigInt("1010101010101010", 16)),
            bigInt(bigInt("FF00FF00FF00FF00", 16)),
            bigInt(bigInt("1100110011001100", 16)),
            bigInt(2),
            bigInt.one,
        ];

        const pA = f1.allocInt();
        const pB = f1.allocInt();
        const pC = f1.allocInt();
        const pR = f1.allocInt();
        for (let i=0; i<v.length; i++) {
            for (let j=1; j<v.length; j++) {
                const expected_c = v[i].divide(v[j]);
                const expected_r = v[i].mod(v[j]);

                f1.putInt(pA, v[i]);
                f1.putInt(pB, v[j]);

                f1.int_div(pA, pB, pC, pR);

                const c = f1.getInt(pC);
                const r = f1.getInt(pR);

                assert(expected_r.equals(r));
                assert(expected_c.equals(c));
            }
        }

    });

    it("It should do a basic reduction 1", async () => {
        const f1 = await buildF1(bigInt("FFFFFFFFFFFFFFFF",16));

        const pA = f1.allocInt2(bigInt(0x10000000000000000));
        const pC = f1.allocInt();

        f1.f1m_mReduct(pA, pC);

        const c = f1.getInt(pC);

        assert.equal(c, 1);
    });
    it("It should do a basic reduction 2", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const f1 = await buildF1(q);

        const a = bigInt("10000242871839275222246405745257275088548364400416034343698204186575808495617");
        const b = bigInt("10000242871839275222246405745257275088548364400416034343698204186575808234523");

        const pA = f1.allocInt(a);
        const pB = f1.allocInt(b);
        const pC = f1.allocInt2();
        const pD = f1.allocInt();

        f1.int_mul(pA, pB, pC);
        const c = f1.getInt2(pC);

        f1.f1m_mReduct(pC, pD);
        const d = f1.getInt(pD);

        const r = bigInt.one.shiftLeft(256).mod(q);
        const r2 = r.times(r).mod(q);

        const pR2 = f1.allocInt(r2);


        const pE = f1.allocInt2();
        f1.int_mul(pD, pR2, pE);

        const pF = f1.allocInt();
        f1.f1m_mReduct(pE, pF);

        const f = f1.getInt2(pF);

        assert(a.times(b).mod(q).equals(f.mod(q)));
    });
    it("It should do a basic reduction 3", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const f1 = await buildF1(q);

        const a = bigInt("10000242871839275222246405745257275088548364400416034343698204186575808495617");
        const b = bigInt("10000242871839275222246405745257275088548364400416034343698204186575808234523");

        const pA = f1.allocInt(a);
        const pB = f1.allocInt(b);
        const pC = f1.allocInt();

        f1.f1_mul(pA, pB, pC);

        const c = f1.getInt2(pC);
        assert(a.times(b).mod(q).equals(c.mod(q)));
    });
    it("It should do various test in zq Snarks modules", async () => {
        const q = bigInt("21888242871839275222246405745257275088696311157297823662689037894645226208583");
        const f1 = await buildF1(q);
        const v= [
            q.minus(1),
            q.minus(2),
            q.minus(1).shiftRight(1),
            q.minus(1).shiftRight(1).add(1),
            q.minus(1).shiftRight(1).add(2),
            q.minus(1).shiftRight(1).minus(1),
            q.minus(1).shiftRight(1).minus(2),
            bigInt(2),
            bigInt.one,
            bigInt.zero
        ];

        const pA = f1.allocInt();
        const pB = f1.allocInt();
        const pC = f1.allocInt();
        let c;

        for (let i=0; i<v.length; i++) {
            for (let j=0; j<5; j++) {

                f1.putInt(pA, v[i]);
                f1.putInt(pB, v[j]);

                // eq
                assert.equal( f1.int_eq(pA,pB), (i==j));

                // add
                f1.f1_add(pA, pB, pC);
                c = f1.getInt2(pC);
                assert(c.equals(v[i].add(v[j]).mod(q)));

                // sub
                f1.f1_sub(pA, pB, pC);
                c = f1.getInt2(pC);

                let s = v[i].minus(v[j]).mod(q);
                if (s.isNegative()) s=s.add(q);
                assert(c.equals(s));

                // mul
                f1.f1_mul(pA, pB, pC);
                c = f1.getInt2(pC);
                assert(c.equals(v[i].times(v[j]).mod(q)));
            }
        }
    });
    it("It should do a test", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const f1 = await buildF1(q);

        const t = f1.test_F1(1000000);

        console.log(t);

    }).timeout(10000000);
    it("Should test to montgomery", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const f1 = await buildF1(q);

        const r = bigInt(11);

        const pR = f1.allocInt(r);
        const pRes = f1.allocInt();
        const pRes2 = f1.allocInt();

        f1.f1m_toMontgomery(pR, pRes);
        const res = f1.getInt(pRes);

        f1.f1m_fromMontgomery(pRes, pRes2);
        const res2 = f1.getInt(pRes2);

        assert(res.equals(r.times( bigInt.one.shiftLeft(256)).mod(q)));
        assert(res2.equals(r));
    });
    it("Should convert back and forth montgomery", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const v= [
            q.minus(1),
            q.minus(2),
            q.minus(1).shiftRight(1),
            q.minus(1).shiftRight(1).add(1),
            q.minus(1).shiftRight(1).add(2),
            q.minus(1).shiftRight(1).minus(1),
            q.minus(1).shiftRight(1).minus(2),
            bigInt(2),
            bigInt.one,
            bigInt.zero
        ];
        const f1 = await buildF1(q);

        const pA = f1.allocInt();

        for (let i=0; i<v.length; i++) {
            f1.putInt(pA, v[i]);

            f1.f1m_toMontgomery(pA, pA);
            f1.f1m_fromMontgomery(pA, pA);

            const a = f1.getInt(pA);
            assert(v[i].equals(a));
        }
    });
    it("Should do inverse", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const v= [
            bigInt.one,
            q.minus(1),
            q.minus(2),
            q.minus(1).shiftRight(1),
            q.minus(1).shiftRight(1).add(1),
            q.minus(1).shiftRight(1).add(2),
            q.minus(1).shiftRight(1).minus(1),
            q.minus(1).shiftRight(1).minus(2),
            bigInt(2),
        ];
        const f1 = await buildF1(q);

        const pA = f1.allocInt();
        const pB = f1.allocInt();
        const pQ = f1.allocInt();

        f1.putInt(pQ, q);

        for (let i=0; i<v.length; i++) {
            f1.putInt(pA, v[i]);

            f1.int_inverseMod(pA, pQ, pB);

            const b = f1.getInt(pB);
            assert(b.equals(v[i].modInv(q)));
        }
    });
    it("Should do inverse in montgomery", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const v= [
            bigInt.one,
            q.minus(1),
            q.minus(2),
            q.minus(1).shiftRight(1),
            q.minus(1).shiftRight(1).add(1),
            q.minus(1).shiftRight(1).add(2),
            q.minus(1).shiftRight(1).minus(1),
            q.minus(1).shiftRight(1).minus(2),
            bigInt(2),
        ];
        const f1 = await buildF1(q);

        const pA = f1.allocInt();
        const pB = f1.allocInt();
        const pC = f1.allocInt();

        for (let i=0; i<v.length; i++) {
            f1.putInt(pA, v[i]);

            f1.f1m_toMontgomery(pA, pA);
            f1.f1m_inverse(pA, pB);
            f1.f1m_mul(pA, pB, pC);
            f1.f1m_fromMontgomery(pC, pC);

            const c = f1.getInt(pC);
            assert(c.equals(1));
        }
    });
    it("Test Neg", async () => {
        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const v= [
            bigInt.one,
            q.minus(1),
            q.minus(2),
            q.minus(1).shiftRight(1),
            q.minus(1).shiftRight(1).add(1),
            q.minus(1).shiftRight(1).add(2),
            q.minus(1).shiftRight(1).minus(1),
            q.minus(1).shiftRight(1).minus(2),
            bigInt(2),
        ];
        const f1 = await buildF1(q);

        const pA = f1.allocInt();

        for (let i=0; i<v.length; i++) {
            f1.putInt(pA, v[i]);

            f1.f1m_neg(pA);
            f1.f1m_neg(pA);

            const a = f1.getInt(pA);
            assert(a.equals(v[i]));
        }
    });


    it("It should profile int", async () => {

        let start,end,time;

        const q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const A=q.minus(1);
        const B=q.minus(1).shiftRight(1);

        const pbF1m = await buildProtoboard((module) => {
            buildF1m(module, q);
            buildTest(module, "f1m_mul");
            buildTest(module, "f1m_mulOld");
        }, 32);

        const pA = pbF1m.alloc();
        const pB = pbF1m.alloc();
        const pC = pbF1m.alloc();

        pbF1m.set(pA, A);
        pbF1m.f1m_toMontgomery(pA, pA);
        pbF1m.set(pB, B);
        pbF1m.f1m_toMontgomery(pB, pB);


        start = new Date().getTime();
        pbF1m.test_f1m_mul(pA, pB, pC, 50000000);
        end = new Date().getTime();
        time = end - start;

        pbF1m.f1m_fromMontgomery(pC, pC);

        const c1 = pbF1m.get(pC, 1, 32);
        assert(c1.equals(A.times(B).mod(q)));

        console.log("Mul Time (ms): " + time);

        start = new Date().getTime();
        pbF1m.test_f1m_mulOld(pA, pB, pC, 50000000);
        end = new Date().getTime();
        time = end - start;


        pbF1m.f1m_fromMontgomery(pC, pC);

        const c2 = pbF1m    .get(pC, 1, 32);
        assert(c2.equals(A.times(B).mod(q)));

        console.log("Mul Old Time (ms): " + time);

    }).timeout(10000000);

});
