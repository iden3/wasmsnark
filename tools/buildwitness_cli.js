const {unstringifyBigInts} = require("./stringifybigint.js");
const buildWitness = require("./buildwitness.js");
const fs = require("fs");

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

const bin = buildWitness(witness);

var wstream = fs.createWriteStream(outputName);
wstream.write(bin);
wstream.end();

