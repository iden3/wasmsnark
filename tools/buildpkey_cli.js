const {unstringifyBigInts} = require("./stringifybigint.js");
const buildPKey = require("./buildpkey.js");
const fs = require("fs");

const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage(`node buildpkey.js -i "proving_key.json" -o "proving_key.bin"
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

const inputName = (argv.input) ? argv.input : "proving_key.json";
const outputName = (argv.output) ? argv.output : "proving_key.bin";


const provingKey = unstringifyBigInts(JSON.parse(fs.readFileSync(inputName, "utf8")));

const bin = buildPKey(provingKey);

var wstream = fs.createWriteStream(outputName);
wstream.write(bin);
wstream.end();

