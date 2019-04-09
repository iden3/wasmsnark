/*
    Copyright 2019 0KIMS association.

    This file is part of websnark (Web Assembly zkSnark Prover).

    websnark is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    websnark is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with websnark. If not, see <https://www.gnu.org/licenses/>.
*/

module.exports = function buildF2m(module, pNonResidue, prefix, f1mPrefix) {

    if (module.modules[prefix]) return prefix;  // already builded

    const f1n8 = module.modules[f1mPrefix].n64*8;
    module.modules[prefix] = {
        n64: module.modules[f1mPrefix].n64*2
    };

    function buildAdd() {
        const f = module.addFunction(prefix+"_add");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));
        const y0 = c.getLocal("y");
        const y1 = c.i32_add(c.getLocal("y"), c.i32_const(f1n8));
        const r0 = c.getLocal("r");
        const r1 = c.i32_add(c.getLocal("r"), c.i32_const(f1n8));

        f.addCode(
            c.call(f1mPrefix+"_add", x0, y0, r0),
            c.call(f1mPrefix+"_add", x1, y1, r1),
        );
    }

    function buildSub() {
        const f = module.addFunction(prefix+"_sub");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));
        const y0 = c.getLocal("y");
        const y1 = c.i32_add(c.getLocal("y"), c.i32_const(f1n8));
        const r0 = c.getLocal("r");
        const r1 = c.i32_add(c.getLocal("r"), c.i32_const(f1n8));

        f.addCode(
            c.call(f1mPrefix+"_sub", x0, y0, r0),
            c.call(f1mPrefix+"_sub", x1, y1, r1),
        );
    }

    function buildNeg() {
        const f = module.addFunction(prefix+"_neg");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));
        const r0 = c.getLocal("r");
        const r1 = c.i32_add(c.getLocal("r"), c.i32_const(f1n8));

        f.addCode(
            c.call(f1mPrefix+"_neg", x0, r0),
            c.call(f1mPrefix+"_neg", x1, r1),
        );
    }

    function buildMul() {
        const f = module.addFunction(prefix+"_mul");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));
        const y0 = c.getLocal("y");
        const y1 = c.i32_add(c.getLocal("y"), c.i32_const(f1n8));
        const r0 = c.getLocal("r");
        const r1 = c.i32_add(c.getLocal("r"), c.i32_const(f1n8));

        const A = c.i32_const(module.alloc(f1n8));
        const B = c.i32_const(module.alloc(f1n8));
        const C = c.i32_const(module.alloc(f1n8));
        const D = c.i32_const(module.alloc(f1n8));


        f.addCode(
            c.call(f1mPrefix + "_mul", x0, y0, A),             // A = x0*y0
            c.call(f1mPrefix + "_mul", x1, y1, B),             // B = x1*y1

            c.call(f1mPrefix + "_add", x0, x1, C),             // C = x0 + x1
            c.call(f1mPrefix + "_add", y0, y1, D),             // D = y0 + y1
            c.call(f1mPrefix + "_mul", C, D, C),               // C = (x0 + x1)*(y0 + y1) = x0*y0+x0*y1+x1*y0+x1*y1

            c.call(f1mPrefix + "_mul", B, c.i32_const(pNonResidue), r0),  // r0 = nr*(x1*y1)
            c.call(f1mPrefix + "_add", A, r0, r0),             // r0 = x0*y0 + nr*(x1*y1)
            c.call(f1mPrefix + "_add", A, B, r1),             // r1 = x0*y0+x1*y1
            c.call(f1mPrefix + "_sub", C, r1, r1)              // r1 = x0*y0+x0*y1+x1*y0+x1*y1 - x0*y0+x1*y1 = x0*y1+x1*y0
        );

    }


    function buildToMontgomery() {
        const f = module.addFunction(prefix+"_toMontgomery");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));
        const r0 = c.getLocal("r");
        const r1 = c.i32_add(c.getLocal("r"), c.i32_const(f1n8));

        f.addCode(
            c.call(f1mPrefix+"_toMontgomery", x0, r0),
            c.call(f1mPrefix+"_toMontgomery", x1, r1)
        );
    }

    function buildFromMontgomery() {
        const f = module.addFunction(prefix+"_fromMontgomery");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));
        const r0 = c.getLocal("r");
        const r1 = c.i32_add(c.getLocal("r"), c.i32_const(f1n8));

        f.addCode(
            c.call(f1mPrefix+"_fromMontgomery", x0, r0),
            c.call(f1mPrefix+"_fromMontgomery", x1, r1)
        );
    }

    function buildCopy() {
        const f = module.addFunction(prefix+"_copy");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));
        const r0 = c.getLocal("r");
        const r1 = c.i32_add(c.getLocal("r"), c.i32_const(f1n8));

        f.addCode(
            c.call(f1mPrefix+"_copy", x0, r0),
            c.call(f1mPrefix+"_copy", x1, r1)
        );
    }

    function buildZero() {
        const f = module.addFunction(prefix+"_zero");
        f.addParam("x", "i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));

        f.addCode(
            c.call(f1mPrefix+"_zero", x0),
            c.call(f1mPrefix+"_zero", x1)
        );
    }

    function buildOne() {
        const f = module.addFunction(prefix+"_one");
        f.addParam("x", "i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));

        f.addCode(
            c.call(f1mPrefix+"_one", x0),
            c.call(f1mPrefix+"_zero", x1)
        );
    }

    function buildEq() {
        const f = module.addFunction(prefix+"_eq");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.setReturnType("i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));
        const y0 = c.getLocal("y");
        const y1 = c.i32_add(c.getLocal("y"), c.i32_const(f1n8));

        f.addCode(
            c.i32_and(
                c.call(f1mPrefix+"_eq", x0, y0),
                c.call(f1mPrefix+"_eq", x1, y1)
            )
        );
    }

    function buildIsZero() {
        const f = module.addFunction(prefix+"_isZero");
        f.addParam("x", "i32");
        f.setReturnType("i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));

        f.addCode(
            c.i32_and(
                c.call(f1mPrefix+"_isZero", x0),
                c.call(f1mPrefix+"_isZero", x1)
            )
        );
    }

    function buildInverse() {
        const f = module.addFunction(prefix+"_inverse");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1n8));
        const r0 = c.getLocal("r");
        const r1 = c.i32_add(c.getLocal("r"), c.i32_const(f1n8));

        const t0 = c.i32_const(module.alloc(f1n8));
        const t1 = c.i32_const(module.alloc(f1n8));
        const t2 = c.i32_const(module.alloc(f1n8));
        const t3 = c.i32_const(module.alloc(f1n8));

        f.addCode(
            c.call(f1mPrefix+"_mul", x0, x0, t0),
            c.call(f1mPrefix+"_mul", x1, x1, t1),
            c.call(f1mPrefix+"_mul", t1, c.i32_const(pNonResidue), t2),
            c.call(f1mPrefix+"_sub", t0, t2, t2),
            c.call(f1mPrefix+"_inverse", t2, t3),

            c.call(f1mPrefix+"_mul", x0, t3, r0),
            c.call(f1mPrefix+"_mul", x1, t3, r1),
            c.call(f1mPrefix+"_neg", r1, r1),
        );
    }

    buildIsZero();
    buildZero();
    buildOne();
    buildCopy();
    buildMul();
    buildAdd();
    buildSub();
    buildNeg();
    buildToMontgomery();
    buildFromMontgomery();
    buildEq();
    buildInverse();

    module.exportFunction(prefix + "_isZero");
    module.exportFunction(prefix + "_zero");
    module.exportFunction(prefix + "_one");
    module.exportFunction(prefix + "_copy");
    module.exportFunction(prefix + "_mul");
    module.exportFunction(prefix + "_add");
    module.exportFunction(prefix + "_sub");
    module.exportFunction(prefix + "_neg");
    module.exportFunction(prefix + "_fromMontgomery");
    module.exportFunction(prefix + "_toMontgomery");
    module.exportFunction(prefix + "_eq");
    module.exportFunction(prefix + "_inverse");

    return prefix;
};
