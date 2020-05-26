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

module.exports = function buildMultiexp(module, prefix, curvePrefix, pointFieldPrefix, scalarPrefix) {

    const pointFieldN64 = module.modules[pointFieldPrefix].n64;
    const pointFieldN8 = pointFieldN64*8;
    const pointN64 = module.modules[curvePrefix].n64;
    const pointN8 = pointN64*8;
    const scalarN64 = module.modules[scalarPrefix].n64;
    const scalarN8 = scalarN64*8;


    function buildPackBits() {
        const f = module.addFunction(prefix+"__packbits");
        f.addParam("pscalars", "i32");
        f.addParam("w", "i32");  // 8 max
        f.addParam("pr", "i32");  // P to result scalarN8*8 bytes
        f.addLocal("i", "i32");
        f.addLocal("j", "i32");
        f.addLocal("w1", "i64");
        f.addLocal("w2", "i64");

        const c = f.getCodeBuilder();

        f.addCode(c.setLocal("i", c.i32_const(0)));
        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.i32_eq(
                    c.getLocal("i"),
                    c.i32_const(scalarN8)
                )
            ),

            c.setLocal("w2", c.i64_const(0)),

            c.setLocal("j", c.i32_const(0)),

            c.block(c.loop(
                c.br_if(
                    1,
                    c.i32_eq(
                        c.getLocal("j"),
                        c.getLocal("w")
                    )
                ),

                c.setLocal(
                    "w1",
                    c.i64_load8_u(
                        c.i32_add(
                            c.getLocal("pscalars"),
                            c.i32_add(
                                c.i32_mul(
                                    c.getLocal("j"),
                                    c.i32_const(scalarN8)
                                ),
                                c.getLocal("i")
                            )
                        )
                    )
                ),

                c.setLocal(
                    "w1",
                    c.i64_and(
                        c.i64_or(
                            c.getLocal("w1"),
                            c.i64_shl(
                                c.getLocal("w1"),
                                c.i64_const(28)
                            )
                        ),
                        c.i64_const("0x0000000F0000000F")
                    )
                ),

                c.setLocal(
                    "w1",
                    c.i64_and(
                        c.i64_or(
                            c.getLocal("w1"),
                            c.i64_shl(
                                c.getLocal("w1"),
                                c.i64_const(14)
                            )
                        ),
                        c.i64_const("0x0003000300030003")
                    )
                ),

                c.setLocal(
                    "w1",
                    c.i64_and(
                        c.i64_or(
                            c.getLocal("w1"),
                            c.i64_shl(
                                c.getLocal("w1"),
                                c.i64_const(7)
                            )
                        ),
                        c.i64_const("0x0101010101010101")
                    )
                ),

                c.setLocal(
                    "w2",
                    c.i64_or(
                        c.getLocal("w2"),
                        c.i64_shl(
                            c.getLocal("w1"),
                            c.i64_extend_i32_u(c.getLocal("j"))
                        )
                    )
                ),


                c.setLocal("j", c.i32_add(c.getLocal("j"), c.i32_const(1))),
                c.br(0)
            )),

            c.i64_store(
                c.i32_add(
                    c.getLocal("pr"),
                    c.i32_mul(
                        c.getLocal("i"),
                        c.i32_const(8)
                    )
                ),
                c.getLocal("w2")
            ),

            c.setLocal("i", c.i32_add(c.getLocal("i"), c.i32_const(1))),
            c.br(0)
        )));


    }

    const c1 = [];
    const c2 = [];

    function nbits(_b) {
        let c=0;
        let r=_b;
        while(r) {
            if (r&1) c++;
            r = r>>1;
        }
        return c;
    }

    function split(_b) {
        const nb1 = nbits(_b) >> 1;
        let r = _b;
        let c = 0;
        if (nb1 == 0) return null;
        let mask = 0xFFFFFFFF;
        while (c<nb1) {
            if (r&1) c++;
            mask = mask << 1;
            r = r>>1;
        }
        return [(_b & mask), (_b & (~mask))];
    }

    for (let i=0; i<256; i++) {
        const a = split(i);
        if (a) {
            c1[i] = a[0];
            c2[i] = a[1];
        } else {
            c1[i] = 0;
            c2[i] = 0;
        }
    }

    const ptable = module.alloc(pointN8*256);
    const pset = module.alloc(32);
    const composite1 = module.alloc(256, c1);
    const composite2 = module.alloc(256, c2);


    function buildSetSet() {
        const f = module.addFunction(prefix+"__set_set");
        f.addParam("idx", "i32");
        f.addLocal("word", "i32");
        f.addLocal("mask", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.setLocal(
                "word",
                c.i32_shl(
                    c.i32_shr_u(
                        c.getLocal("idx"),
                        c.i32_const(5)
                    ),
                    c.i32_const(2)
                )
            )
        );
        f.addCode(
            c.setLocal(
                "mask",
                c.i32_shl(
                    c.i32_const(1),
                    c.i32_and(
                        c.getLocal("idx"),
                        c.i32_const("0x1F")
                    )
                )
            )
        );
        f.addCode(
            c.i32_store(
                c.getLocal("word"),
                pset,
                c.i32_or(
                    c.i32_load(
                        c.getLocal("word"),
                        pset
                    ),
                    c.getLocal("mask")
                )
            )
        );
    }

    function buildSetIsSet() {
        const f = module.addFunction(prefix+"__set_isSet");
        f.addParam("idx", "i32");
        f.setReturnType("i32");
        f.addLocal("word", "i32");
        f.addLocal("mask", "i32");

        const c = f.getCodeBuilder();


        f.addCode(
            c.setLocal(
                "word",
                c.i32_shl(
                    c.i32_shr_u(
                        c.getLocal("idx"),
                        c.i32_const(5)
                    ),
                    c.i32_const(2)
                )
            )
        );
        f.addCode(
            c.setLocal(
                "mask",
                c.i32_shl(
                    c.i32_const(1),
                    c.i32_and(
                        c.getLocal("idx"),
                        c.i32_const("0x1F")
                    )
                )
            )
        );

        f.addCode(
            c.i32_and(
                c.i32_load(
                    c.getLocal("word"),
                    pset
                ),
                c.getLocal("mask")
            )
        );
    }


    function buildPTableReset() {
        const f = module.addFunction(prefix+"__ptable_reset");
        f.addParam("ppoints", "i32");
        f.addParam("w", "i32");  // Window size Max 8
        f.addLocal("ps", "i32");
        f.addLocal("pd", "i32");
        f.addLocal("i", "i32");
        f.addLocal("isZero", "i32");

        const c = f.getCodeBuilder();

        f.addCode(c.setLocal("ps", c.getLocal("ppoints")));

        f.addCode(c.call( curvePrefix + "_zero", c.i32_const(ptable) ));

        f.addCode(c.setLocal("i", c.i32_const(0)));
        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.i32_eq(
                    c.getLocal("i"),
                    c.getLocal("w")
                )
            ),

            c.setLocal(
                "pd",
                c.i32_add(
                    c.i32_const(ptable),
                    c.i32_mul(
                        c.i32_shl(
                            c.i32_const(1),
                            c.getLocal("i")
                        ),
                        c.i32_const(pointN8)
                    )
                )
            ),


            c.setLocal("isZero", c.call(pointFieldPrefix + "_isZero", c.getLocal("ps"))),

            c.call( pointFieldPrefix + "_copy", c.getLocal("ps"), c.getLocal("pd")),
            c.setLocal("ps", c.i32_add(c.getLocal("ps"), c.i32_const(pointFieldN8))),
            c.setLocal("pd", c.i32_add(c.getLocal("pd"), c.i32_const(pointFieldN8))),

            c.call( pointFieldPrefix + "_copy", c.getLocal("ps"), c.getLocal("pd")),
            c.setLocal("ps", c.i32_add(c.getLocal("ps"), c.i32_const(pointFieldN8))),
            c.setLocal("pd", c.i32_add(c.getLocal("pd"), c.i32_const(pointFieldN8))),

            c.if(
                c.getLocal("isZero"),
                c.call( pointFieldPrefix + "_zero", c.getLocal("pd")),
                c.call( pointFieldPrefix + "_one", c.getLocal("pd")),
            ),

            c.setLocal("i", c.i32_add(c.getLocal("i"), c.i32_const(1))),
            c.br(0)
        )));

        // Reset the set
        f.addCode(c.i64_store( c.i32_const(pset   ),c.i64_const("0x0000000100010117")));
        f.addCode(c.i64_store( c.i32_const(pset+ 8),c.i64_const("0x0000000000000001")));
        f.addCode(c.i64_store( c.i32_const(pset+16),c.i64_const("0x0000000000000001")));
        f.addCode(c.i64_store( c.i32_const(pset+24),c.i64_const("0x0000000000000000")));


    }

    function buildPTableGet() {
        const f = module.addFunction(prefix+"__ptable_get");
        f.addParam("idx", "i32");
        f.setReturnType("i32");
        f.addLocal("pr", "i32");
        f.addLocal("p1", "i32");
        f.addLocal("p2", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.setLocal(
                "pr",
                c.i32_add(
                    c.i32_const(ptable),
                    c.i32_mul(
                        c.getLocal("idx"),
                        c.i32_const(pointN8)
                    )
                )
            )
        );

        f.addCode(c.if(
            c.i32_eqz(
                c.call(
                    prefix + "__set_isSet",
                    c.getLocal("idx")
                ),
            ),
            [
                ...c.setLocal(
                    "p1",
                    c.call(
                        prefix + "__ptable_get",
                        c.i32_load8_u(
                            c.getLocal("idx"),
                            composite1
                        )
                    )
                ),
                ...c.setLocal(
                    "p2",
                    c.call(
                        prefix + "__ptable_get",
                        c.i32_load8_u(
                            c.getLocal("idx"),
                            composite2
                        )
                    )
                ),
                ...c.call(
                    curvePrefix + "_add",
                    c.getLocal("p1"),
                    c.getLocal("p2"),
                    c.getLocal("pr")
                ),
                ...c.call(
                    prefix + "__set_set",
                    c.getLocal("idx")
                )
            ]
        ));

        f.addCode(c.getLocal("pr"));
    }


    function buildMulw() {
        const f = module.addFunction(prefix+"__mulw");
        f.addParam("pscalars", "i32");
        f.addParam("ppoints", "i32");
        f.addParam("w", "i32");  // Window size Max 8
        f.addParam("pr", "i32");
        f.addLocal("i", "i32");

        const c = f.getCodeBuilder();

        const psels = module.alloc(scalarN8 * 8);

        f.addCode(c.call(
            prefix + "__packbits",
            c.getLocal("pscalars"),
            c.getLocal("w"),
            c.i32_const(psels)
        ));

        f.addCode(c.call(
            curvePrefix + "_zero",
            c.getLocal("pr"),
        ));

        f.addCode(c.call(
            prefix + "__ptable_reset",
            c.getLocal("ppoints"),
            c.getLocal("w")
        ));


        f.addCode(c.setLocal("i", c.i32_const(0)));
        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.i32_eq(
                    c.getLocal("i"),
                    c.i32_const(scalarN8 * 8)
                )
            ),

            c.call(curvePrefix + "_double",
                c.getLocal("pr"),
                c.getLocal("pr"),
            ),
            c.call(curvePrefix + "_add",
                c.getLocal("pr"),
                c.call(
                    prefix + "__ptable_get",
                    c.i32_load8_u(
                        c.i32_sub(
                            c.i32_const(psels + scalarN8 * 8 -1),
                            c.getLocal("i")
                        )
                    )
                ),
                c.getLocal("pr"),
            ),

            c.setLocal("i", c.i32_add(c.getLocal("i"), c.i32_const(1))),
            c.br(0)
        )));

    }


    function buildMultiexp() {
        const f = module.addFunction(prefix+"_multiexp");
        f.addParam("pscalars", "i32");
        f.addParam("ppoints", "i32");
        f.addParam("n", "i32");  // Number of points
        f.addParam("w", "i32");  // Window size Max 8
        f.addParam("pr", "i32");
        f.addLocal("ps", "i32");
        f.addLocal("pp", "i32");
        f.addLocal("wf", "i32");
        f.addLocal("lastps", "i32");

        const c = f.getCodeBuilder();

        const aux = c.i32_const(module.alloc(pointN8));

        f.addCode(c.setLocal("ps", c.getLocal("pscalars")));
        f.addCode(c.setLocal("pp", c.getLocal("ppoints")));

        f.addCode(c.setLocal(
            "lastps",
            c.i32_add(
                c.getLocal("ps"),
                c.i32_mul(
                    c.i32_mul(
                        c.i32_div_u(
                            c.getLocal("n"),
                            c.getLocal("w")
                        ),
                        c.getLocal("w")
                    ),
                    c.i32_const(scalarN8)
                )
            )
        ));

        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.i32_eq(
                    c.getLocal("ps"),
                    c.getLocal("lastps")
                )
            ),

            c.call(prefix + "__mulw", c.getLocal("ps"), c.getLocal("pp"), c.getLocal("w"), aux),
            c.call(curvePrefix + "_add", aux, c.getLocal("pr"), c.getLocal("pr")),

            c.setLocal(
                "ps",
                c.i32_add(
                    c.getLocal("ps"),
                    c.i32_mul(
                        c.i32_const(scalarN8),
                        c.getLocal("w")
                    )
                )
            ),

            c.setLocal(
                "pp",
                c.i32_add(
                    c.getLocal("pp"),
                    c.i32_mul(
                        c.i32_const(pointFieldN8*2),
                        c.getLocal("w")
                    )
                )
            ),

            c.br(0)
        )));

        f.addCode(c.setLocal("wf", c.i32_rem_u(c.getLocal("n"), c.getLocal("w"))));

        f.addCode(c.if(
            c.getLocal("wf"),
            [
                ...c.call(prefix + "__mulw", c.getLocal("ps"), c.getLocal("pp"), c.getLocal("wf"), aux),
                ...c.call(curvePrefix + "_add", aux, c.getLocal("pr"), c.getLocal("pr")),
            ]
        ));
    }


    function buildMulw2() {
        const f = module.addFunction(prefix+"__mulw2");
        f.addParam("pscalars", "i32");
        f.addParam("ppoints", "i32");
        f.addParam("w", "i32");  // Window size Max 8
        f.addParam("pr", "i32");
        f.addLocal("i", "i32");
        f.addLocal("pd", "i32");

        const c = f.getCodeBuilder();

        const psels = module.alloc(scalarN8 * 8);

        f.addCode(c.call(
            prefix + "__packbits",
            c.getLocal("pscalars"),
            c.getLocal("w"),
            c.i32_const(psels)
        ));

        f.addCode(c.call(
            prefix + "__ptable_reset",
            c.getLocal("ppoints"),
            c.getLocal("w")
        ));


        f.addCode(c.setLocal("i", c.i32_const(0)));
        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.i32_eq(
                    c.getLocal("i"),
                    c.i32_const(scalarN8 * 8)
                )
            ),

            c.setLocal(
                "pd",
                c.i32_add(
                    c.getLocal("pr"),
                    c.i32_mul(
                        c.getLocal("i"),
                        c.i32_const(pointN8)
                    )
                )
            ),

            c.call(curvePrefix + "_add",
                c.getLocal("pd"),
                c.call(
                    prefix + "__ptable_get",
                    c.i32_load8_u(
                        c.i32_sub(
                            c.i32_const(psels + scalarN8 * 8 -1),
                            c.getLocal("i")
                        )
                    )
                ),
                c.getLocal("pd")
            ),

            c.setLocal("i", c.i32_add(c.getLocal("i"), c.i32_const(1))),
            c.br(0)
        )));

    }

    function buildMultiexp2() {
        const f = module.addFunction(prefix+"_multiexp2");
        f.addParam("pscalars", "i32");
        f.addParam("ppoints", "i32");
        f.addParam("n", "i32");  // Number of points
        f.addParam("w", "i32");  // Window size Max 8
        f.addParam("pr", "i32");
        f.addLocal("ps", "i32");
        f.addLocal("pp", "i32");
        f.addLocal("wf", "i32");
        f.addLocal("lastps", "i32");

        const c = f.getCodeBuilder();

        const accumulators = c.i32_const(module.alloc(pointN8*scalarN8*8));
        const aux = c.i32_const(module.alloc(pointN8));

        f.addCode(c.call(prefix + "__resetAccumulators", accumulators, c.i32_const(scalarN8*8)));

        f.addCode(c.setLocal("ps", c.getLocal("pscalars")));
        f.addCode(c.setLocal("pp", c.getLocal("ppoints")));

        f.addCode(c.setLocal(
            "lastps",
            c.i32_add(
                c.getLocal("ps"),
                c.i32_mul(
                    c.i32_mul(
                        c.i32_div_u(
                            c.getLocal("n"),
                            c.getLocal("w")
                        ),
                        c.getLocal("w")
                    ),
                    c.i32_const(scalarN8)
                )
            )
        ));

        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.i32_eq(
                    c.getLocal("ps"),
                    c.getLocal("lastps")
                )
            ),

            c.call(prefix + "__mulw2", c.getLocal("ps"), c.getLocal("pp"), c.getLocal("w"), accumulators),

            c.setLocal(
                "ps",
                c.i32_add(
                    c.getLocal("ps"),
                    c.i32_mul(
                        c.i32_const(scalarN8),
                        c.getLocal("w")
                    )
                )
            ),

            c.setLocal(
                "pp",
                c.i32_add(
                    c.getLocal("pp"),
                    c.i32_mul(
                        c.i32_const(pointFieldN8*2),
                        c.getLocal("w")
                    )
                )
            ),

            c.br(0)
        )));

        f.addCode(c.setLocal("wf", c.i32_rem_u(c.getLocal("n"), c.getLocal("w"))));

        f.addCode(c.if(
            c.getLocal("wf"),
            [
                ...c.call(prefix + "__mulw2", c.getLocal("ps"), c.getLocal("pp"), c.getLocal("wf"), accumulators),
            ]
        ));

        f.addCode(c.call(
            prefix + "__addAccumulators",
            accumulators,
            c.i32_const(scalarN8*8),
            aux
        ));

        f.addCode(c.call(curvePrefix + "_add", aux, c.getLocal("pr"), c.getLocal("pr")));

    }

    function buildResetAccumulators() {
        const f = module.addFunction(prefix+"__resetAccumulators");
        f.addParam("paccumulators", "i32");
        f.addParam("n", "i32");  // Number of points
        f.addLocal("i", "i32");

        const c = f.getCodeBuilder();

        f.addCode(c.setLocal("i", c.i32_const(0)));
        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.i32_eq(
                    c.getLocal("i"),
                    c.getLocal("n")
                )
            ),

            c.call(
                curvePrefix + "_zero",
                c.i32_add(
                    c.getLocal("paccumulators"),
                    c.i32_mul(
                        c.getLocal("i"),
                        c.i32_const(pointN8)
                    )
                )
            ),

            c.setLocal("i", c.i32_add(c.getLocal("i"), c.i32_const(1))),
            c.br(0)

        )));
    }

    function buildAddAccumulators() {
        const f = module.addFunction(prefix+"__addAccumulators");
        f.addParam("paccumulators", "i32");
        f.addParam("n", "i32");  // Number of points
        f.addParam("pr", "i32");
        f.addLocal("i", "i32");
        f.addLocal("p", "i32");

        const c = f.getCodeBuilder();

/*
        f.addCode(c.setLocal(
            "p",
            c.i32_add(
                c.getLocal("paccumulators"),
                c.i32_sub(
                    c.i32_mul(
                        c.getLocal("n"),
                        c.i32_const(pointN8)
                    ),
                    c.i32_const(pointN8)
                )
            )
        ));
*/
        f.addCode(c.setLocal("p",c.getLocal("paccumulators")));

        f.addCode(c.call(curvePrefix + "_copy", c.getLocal("p"), c.getLocal("pr")));
        f.addCode(c.setLocal("p", c.i32_add(c.getLocal("p"), c.i32_const(pointN8))));

        f.addCode(c.setLocal("i", c.i32_const(1)));
        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.i32_eq(
                    c.getLocal("i"),
                    c.getLocal("n")
                )
            ),

            c.call(
                curvePrefix + "_double",
                c.getLocal("pr"),
                c.getLocal("pr")
            ),

            c.call(
                curvePrefix + "_add",
                c.getLocal("p"),
                c.getLocal("pr"),
                c.getLocal("pr")
            ),

            c.setLocal("p", c.i32_add(c.getLocal("p"), c.i32_const(pointN8))),
            c.setLocal("i", c.i32_add(c.getLocal("i"), c.i32_const(1))),
            c.br(0)
        )));
    }

    buildSetSet();
    buildSetIsSet();
    buildPTableReset();
    buildPTableGet();
    buildPackBits();
    buildMulw();
    buildMultiexp();

    buildMulw2();
    buildResetAccumulators();
    buildAddAccumulators();
    buildMultiexp2();

    module.exportFunction(prefix+"_multiexp");
    module.exportFunction(prefix+"_multiexp2");


};
