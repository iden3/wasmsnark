

/*
    Copyright 2019 0KIMS association.

    This file is part of wasmsnark (Web Assembly zkSnark Prover).

    wasmsnark is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    wasmsnark is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with wasmsnark. If not, see <https://www.gnu.org/licenses/>.
*/

module.exports = function buildApplyKey(module, gPrefix, frPrefix) {

    const f = module.addFunction(gPrefix + "_batchApplyKey");
    f.addParam("pIn", "i32");
    f.addParam("n", "i32");
    f.addParam("pFirst", "i32");
    f.addParam("pInc", "i32");
    f.addParam("pOut", "i32");
    f.addLocal("pOldFree", "i32");
    f.addLocal("i", "i32");
    f.addLocal("pFrom", "i32");
    f.addLocal("pTo", "i32");

    const FrN64 = module.modules[frPrefix].n64;
    const sGOut = module.modules[gPrefix].n64*8;
    const sGIn = sGOut*2/3;

    const c = f.getCodeBuilder();

    const t = c.i32_const(module.alloc(FrN64));


    // Alloc Memory for Working Space
    f.addCode(
        c.setLocal("pOldFree", c.i32_load( c.i32_const(0) )),
        c.i32_store(
            c.i32_const(0),
            c.i32_add(
                c.getLocal( "pOldFree" ),
                c.i32_mul(c.getLocal("n"), c.i32_const(sGOut))
            )
        )
    );

    f.addCode(
        c.setLocal("pFrom", c.getLocal("pIn")),
        c.setLocal("pTo", c.getLocal("pOldFree")),
    );

    // t = first
    f.addCode(
        c.call(
            frPrefix + "_copy",
            c.getLocal("pFirst"),
            t
        )
    );
    f.addCode(
        c.setLocal("i", c.i32_const(0)),
        c.block(c.loop(
            c.br_if(1, c.i32_eq ( c.getLocal("i"), c.getLocal("n") )),

            c.call( frPrefix + "_fromMontgomery", t, t),
            c.call(
                gPrefix + "_timesScalarAffine",
                c.getLocal("pFrom"),
                t,
                c.i32_const(FrN64*8),
                c.getLocal("pTo")
            ),
            c.call( frPrefix + "_toMontgomery", t, t),

            c.setLocal("pFrom", c.i32_add(c.getLocal("pFrom"), c.i32_const(sGIn))),
            c.setLocal("pTo", c.i32_add(c.getLocal("pTo"), c.i32_const(sGOut))),

            // t = t* inc
            c.call(
                frPrefix + "_mul",
                t,
                c.getLocal("pInc"),
                t
            ),
            c.setLocal("i", c.i32_add(c.getLocal("i"), c.i32_const(1))),
            c.br(0)
        ))
    );
    f.addCode(
        c.call(
            gPrefix + "_batchToAffine",
            c.getLocal("pOldFree"),
            c.getLocal("n"),
            c.getLocal("pOut")
        )
    );

    // Recover Old memory
    f.addCode(
        c.i32_store(
            c.i32_const(0),
            c.getLocal("pOldFree")
        )
    );


};
