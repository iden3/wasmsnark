const assert = require("assert");
const bigInt = require("big-integer");

const buildProtoboard = require("wasmbuilder").buildProtoboard;
const buildTomCook = require("../src/build_tomcook.js");
const buildInt = require("../src/build_int.js");
const buildTest2 = require("../src/build_test.js").buildTest2;

const helpers = require("./helpers/helpers.js");



describe("Basic tests for Tom Cook Multiplication Strategy", () => {
    let pbTC;
    let pbInt;

    before(async () => {
        pbTC = await buildProtoboard((module) => {
            buildTomCook(module);
            buildTest2(module, "tomcook_mul9");
        }, 12, 29);
        pbInt = await buildProtoboard((module) => {
            buildInt(module, 4);
            buildTest2(module, "int_mul");
        }, 32);
    });

    it("It should divide by 3 (6)", async () => {
        let c;
        const pA = pbTC.alloc(6*4);

        const values = helpers.genValues(6, true, 29);

        for (let i=0; i<values.length; i++) {
            pbTC.set(pA, values[i], 24);
            pbTC.tomcook_divshort6(pA, 3, pA);
            c = pbTC.get(pA, 1, 24);
            assert(c.equals(values[i].divide(3)));
        }
    });

    it("It should doubling (6)", async () => {
        let c;
        const pA = pbTC.alloc(6*4);

        const values = helpers.genValues(6, true, 29);

        for (let i=0; i<values.length; i++) {
            pbTC.set(pA, values[i], 24);
            pbTC.tomcook_mulshort6(pA, 2, pA);
            c = pbTC.get(pA, 1, 24);
            assert(c.equals(values[i].times(2)));
        }
    });


    it("It should halving (6)", async () => {
        let c;
        const pA = pbTC.alloc(6*4);

        const values = helpers.genValues(6, true, 29);

        for (let i=0; i<values.length; i++) {
            // console.log(values[i].toString(16));
            pbTC.set(pA, values[i], 24);
            pbTC.tomcook_divshort6(pA, 2, pA);
            c = pbTC.get(pA, 1, 24);
            assert(c.equals(values[i].divide(2)));
        }
    });


    it("It should do a basic multiplication 3", async () => {
        let c;
        const pA = pbTC.alloc();
        const pB = pbTC.alloc();
        const pC = pbTC.alloc(24);

        const values = helpers.genValues(3, true, 29);

        for (let i=0; i<values.length; i++) {
            for (let j=0; j<values.length; j++) {
                pbTC.set(pA, values[i]);
                pbTC.set(pB, values[j]);


                // pbTC.tomcook_mul1(pA, pB, pC);
                // c = pbTC.get(pC, 1, 24);
                // assert(c.equals(values[i].times(values[j])));


                pbTC.tomcook_mul3(pA, pB, pC);
                c = pbTC.get(pC, 1, 24);
                assert(c.equals(values[i].times(values[j])));
            }
        }
    });
    it("It should do a basic multiplication 9", async () => {
        let c;
        const pA = pbTC.alloc(9*4);
        const pB = pbTC.alloc(9*4);
        const pC = pbTC.alloc(9*4*2);

//        const A=bigInt(0).add(bigInt(0).shiftLeft(29*3).add(bigInt(bigInt("7FFFFFFFFFFFFFFFFFFFFF", 16)).shiftLeft(29*6)));
//        const B=bigInt(0).add(bigInt(0).shiftLeft(29*3).add(bigInt(bigInt("7FFFFFFFFFFFFFFFFFFFFF", 16)).shiftLeft(29*6)));

        const A = bigInt("3fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",16);
        const B = bigInt("3fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",16);

        pbTC.set(pA, A, 9*4);
        pbTC.set(pB, B, 9*4);

        console.log(A.toString(16));
        console.log(B.toString(16));
        pbTC.tomcook_mul9(pA, pB, pC);
        c = pbTC.get(pC, 1, 72);
        console.log("Result: " + c.toString(16));
        console.log("Refere: " + A.times(B).toString(16));
        assert(c.equals(A.times(B)));
    });


    it("It should do a basic multiplication Multi values (9)", async () => {
        let c;
        const pA = pbTC.alloc(9*4);
        const pB = pbTC.alloc(9*4);
        const pC = pbTC.alloc(9*4*2);

        const values = helpers.genValues(9, false, 29);

        for (let i=0; i<values.length; i++) {
            for (let j=0; j<values.length; j++) {
                pbTC.set(pA, values[i], 9*4);
                pbTC.set(pB, values[j], 9*4);

                // pbTC.tomcook_mul1(pA, pB, pC);
                // c = pbTC.get(pC, 1, 24);
                // assert(c.equals(values[i].times(values[j])));

//                console.log(values[i].toString(16));
//                console.log(values[j].toString(16));
                pbTC.tomcook_mul9(pA, pB, pC);
                c = pbTC.get(pC, 1, 72);
//                console.log("Result: " + c.toString(16));
//                console.log("Refere: " + values[i].times(values[j]).toString(16));
                assert(c.equals(values[i].times(values[j])));
            }
        }
    });


    it("It should profile school", async () => {
        const A = bigInt.one.shiftLeft(254).minus(1);
        const B = bigInt.one.shiftLeft(254).minus(1);

        const pA = pbInt.set(pbInt.alloc(32), A, 32);
        const pB = pbInt.set(pbInt.alloc(32), B, 32);
        const pC = pbInt.alloc(64);

        const start = new Date().getTime();
        pbInt.test_int_mul(pA, pB, pC, 10000000);
        const end = new Date().getTime();
        const time = end - start;

        const c = pbInt.get(pC, 1, 64);
        console.log("Result: " + c.toString(16));
        console.log("Refere: " + A.times(B).toString(16));

        console.log("Tom School (ms): " + time);
    }).timeout(10000000);
    it("It should profile tomCook", async () => {
        let start, end, time;
//        const A = bigInt.one.shiftLeft(29*3).minus(1);
        const A = bigInt.one.shiftLeft(254).minus(1);
        const B = bigInt.one.shiftLeft(254).minus(1);

        console.log(A.toString(16));
//        const B = bigInt.zero.minus(bigInt.one.shiftLeft(29*3).minus(1));

        const pA = pbTC.set(pbTC.alloc(9*4), A, 9*4);
        const pB = pbTC.set(pbTC.alloc(9*4), B, 9*4);
        const pC = pbTC.alloc(9*4*2);

        // start = new Date().getTime();
        // pbTC.test_tomcook_mul1(pA, pB, pC, 100000000);
        // end = new Date().getTime();
        // time = end - start;
        // console.log("Mul1 Tom Cook Time (ms): " + time);

        start = new Date().getTime();
        pbTC.test_tomcook_mul9(pA, pB, pC, 10000000);
        end = new Date().getTime();
        time = end - start;

        const c = pbTC.get(pC, 1, 9*4*2);
        console.log("Result: " + c.toString(16));
        console.log("Refere: " + A.times(B).toString(16));

        console.log("Mul9 Tom Cook Time (ms): " + time);
    }).timeout(10000000);

});
