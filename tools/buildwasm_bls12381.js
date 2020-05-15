const ModuleBuilder = require("wasmbuilder").ModuleBuilder;
const buildBls12381 = require("../src/bls12381/build_bls12381.js");
const fs = require("fs");
const path = require("path");

function buildWasm() {
    const moduleBuilder = new ModuleBuilder();
    moduleBuilder.setMemory(1000);
    buildBls12381(moduleBuilder);

    const code = moduleBuilder.build();

    fs.writeFileSync(
        path.join( __dirname, "..", "build", "bls12381_wasm.js"),
        `
            exports.code = Buffer.from("${Buffer.from(code).toString("base64")}", "base64");
            exports.pq = ${moduleBuilder.modules.f1m.pq};
            exports.pr = ${moduleBuilder.modules.frm.pq};
            exports.pG1gen = ${moduleBuilder.modules.bls12381.pG1gen};
            exports.pG1zero = ${moduleBuilder.modules.bls12381.pG1zero};
            exports.pG2gen = ${moduleBuilder.modules.bls12381.pG2gen};
            exports.pG2zero = ${moduleBuilder.modules.bls12381.pG2zero};
            exports.pOneT = ${moduleBuilder.modules.bls12381.pOneT};
            exports.prePSize = ${moduleBuilder.modules.bls12381.prePSize};
            exports.preQSize = ${moduleBuilder.modules.bls12381.preQSize};
        `
    );
}

buildWasm();
