const bigInt = require("big-integer");
const ModuleBuilder = require("wasmbuilder").ModuleBuilder;
const buildBn128 = require("../src/bn128/build_bn128.js");
const fs = require("fs");
const path = require("path");

function buildWasm() {
    const moduleBuilder = new ModuleBuilder();
    moduleBuilder.setMemory(1000);
    buildBn128(moduleBuilder);

    const code = moduleBuilder.build();

    fs.writeFileSync(
        path.join( __dirname, "..", "build", "bn128_wasm.js"),
        `
            exports.code = Buffer.from("${Buffer.from(code).toString("base64")}", "base64");
            exports.pq = ${moduleBuilder.modules.f1m.pq};
            exports.pr = ${moduleBuilder.modules.frm.pq};
            exports.pG1gen = ${moduleBuilder.modules.bn128.pG1gen};
            exports.pG1zero = ${moduleBuilder.modules.bn128.pG1zero};
            exports.pG2gen = ${moduleBuilder.modules.bn128.pG2gen};
            exports.pG2zero = ${moduleBuilder.modules.bn128.pG2zero};
            exports.pOneT = ${moduleBuilder.modules.bn128.pOneT};
            exports.prePSize = ${moduleBuilder.modules.bn128.prePSize};
            exports.preQSize = ${moduleBuilder.modules.bn128.preQSize};
        `
    );
}

buildWasm();
