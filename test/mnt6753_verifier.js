const assert = require("assert");

const buildMnt6753 = require("../index.js").buildMnt6753;
const testVector1 = require("./data/mnt6753verifier_testvector.json");
const testVector2 = require("./data/mnt6753verifier_testvector2.json");

describe("Basic verification for MNT6753", function () {

    let mnt6753;

    this.timeout(10000000);

    before(async () => {
        mnt6753 = await buildMnt6753();
    });

    after( async() => {
        mnt6753.terminate();
    });

    it("It should validate a test vector 1", async () => {

        const valid = mnt6753.verifySync(testVector1.verificationKey, testVector1.input, testVector1.proof);

        assert.equal(valid , true);
    });

    it("It should validate a test vector 2", async () => {

        const valid = mnt6753.verifySync(testVector2.verificationKey, testVector2.input, testVector2.proof);

        assert.equal(valid , true);
    });

    it("It should validate a test vector 2", async () => {

        const valid = await mnt6753.verify(testVector2.verificationKey, testVector2.input, testVector2.proof);

        assert.equal(valid , true);
    });
    it("It should validate a test vector 1 Sync", async () => {

        const valid = await mnt6753.verify(testVector1.verificationKey, testVector1.input, testVector1.proof);

        assert.equal(valid , true);
    });

});

