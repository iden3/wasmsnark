const bigInt = require("big-integer");
const ModuleBuilder = require("wasmbuilder");
const buildF1m = require("../src/build_f1m.js");
const buildF2m = require("../src/build_f2m.js");
const buildF1 = require("../src/build_f1.js");
const buildCurve = require("../src/build_curve.js");
const buildFFT = require("../src/build_fft");
const buildMultiexp = require("../src/build_multiexp");
const buildPol = require("../src/build_pol");
const buildTest = require("../src/build_test");
const utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

function buildWasm() {

    const q = bigInt("21888242871839275222246405745257275088696311157297823662689037894645226208583");
    const r = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

    const moduleBuilder = new ModuleBuilder();
    moduleBuilder.setMemory(1000);
    buildF1m(moduleBuilder, q, "f1m");
    buildF1(moduleBuilder, r, "fr", "frm");
    buildCurve(moduleBuilder, "g1", "f1m");
    buildMultiexp(moduleBuilder, "g1", "g1", "f1m", "fr");
    buildFFT(moduleBuilder, "fft", "frm");
    buildPol(moduleBuilder, "pol", "frm");

    const pNonResidueF2 =  moduleBuilder.alloc(
        utils.bigInt2BytesLE(
            bigInt("15537367993719455909907449462855742678907882278146377936676643359958227611562"), // -1 in montgomery
            32
        )
    );

    buildF2m(moduleBuilder, pNonResidueF2, "f2m", "f1m");
    buildCurve(moduleBuilder, "g2", "f2m");
    buildMultiexp(moduleBuilder, "g2", "g2", "f2m", "fr");

    buildTest(moduleBuilder, "f1m_mul");
    buildTest(moduleBuilder, "f1m_mulOld");

    const code = moduleBuilder.build();

    fs.writeFileSync(
        path.join( __dirname, "..", "build", "groth16_wasm.js"),
        `
            exports.code = new Buffer("${Buffer.from(code).toString("base64")}", "base64");
            exports.pq = ${moduleBuilder.modules.f1m.pq};
            exports.pr = ${moduleBuilder.modules.frm.pq};
        `
    );
}

buildWasm();
