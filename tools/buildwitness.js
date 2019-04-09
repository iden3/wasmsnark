const {unstringifyBigInts} = require("./stringifybigint.js");
const fs = require("fs");
const assert = require("assert");

const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage(`node buildpkey.js -i "witness.json" -o "witness.bin"
  Default: circuit.json
        `)
    .alias("i", "input")
    .alias("o", "output")
    .help("h")
    .alias("h", "help")
    .epilogue(`Copyright (C) 2018  0kims association
    This program comes with ABSOLUTELY NO WARRANTY;
    This is free software, and you are welcome to redistribute it
    under certain conditions; see the COPYING file in the official
    repo directory at  https://github.com/iden3/circom `)
    .argv;

const inputName = (argv.input) ? argv.input : "witness.json";
const outputName = (argv.output) ? argv.output : "witness.bin";


const witness = unstringifyBigInts(JSON.parse(fs.readFileSync(inputName, "utf8")));


function writeUint32(h, val) {
    h.dataView.setUint32(h.offset, val, true);
    h.offset += 4;
}


function writeBigInt(h, bi) {
    for (let i=0; i<8; i++) {
        const v = bi.shiftRight(i*32).and(0xFFFFFFFF).toJSNumber();
        writeUint32(h, v);
    }
}


function calculateBuffLen(witness) {

    let size = 0;

    // beta2, delta2
    size += witness.length * 32;

    return size;
}


const buffLen = calculateBuffLen(witness);

const buff = new ArrayBuffer(buffLen);

const h = {
    dataView: new DataView(buff),
    offset: 0
};


// writeUint32(h, witness.length);

for (let i=0; i<witness.length; i++) {
    writeBigInt(h, witness[i]);
}

assert.equal(h.offset, buffLen);

var wstream = fs.createWriteStream(outputName);
wstream.write(Buffer.from(buff));
wstream.end();

