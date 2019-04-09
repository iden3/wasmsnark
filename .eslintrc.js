module.exports = {
    "plugins": [
        "mocha",
        "webassembly"
    ],
    "env": {
        "es6": true,
        "node": true,
        "mocha": true
    },
    "globals": {
        "WebAssembly": true
    },
    "parserOptions": {
        "ecmaVersion": 2017
    },
    "extends": "eslint:recommended",
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "error",
            "always"
        ],
        "mocha/no-exclusive-tests": "error"
    }
};
