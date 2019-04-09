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

const bigInt = require("big-integer");
const utils = require("./utils.js");

module.exports = function buildFFT(module, prefix, f1mPrefix) {

    const n64 = module.modules[f1mPrefix].n64;
    const n8 = n64*8;
    const q = module.modules[f1mPrefix].q;

    let rem = q.minus(bigInt(1));
    let maxBits = 0;
    while (!rem.isOdd()) {
        maxBits ++;
        rem = rem.shiftRight(1);
    }

    let nr = bigInt(2);

    while ( nr.modPow(q.shiftRight(1), q).equals(1) ) nr = nr.add(1);

    const w = new Array(maxBits+1);
    w[maxBits] = nr.modPow(rem, q);

    let n=maxBits-1;
    while (n>=0) {
        w[n] = w[n+1].modPow(2, q);
        n--;
    }

    const bytes = [];
    const R = bigInt(1).shiftLeft(n8*8).mod(q);

    for (let i=0; i<w.length; i++) {
        const m = w[i].times(R).mod(q);
        bytes.push(...utils.bigInt2BytesLE(m, n8));
    }

    const ROOTs = module.alloc(bytes);

    const i2 = new Array(maxBits+1);
    i2[0] = bigInt(1);

    for (let i=1; i<=maxBits; i++) {
        i2[i] = i2[i-1].times(2);
    }

    const bytesi2 =[];
    for (let i=0; i<=maxBits; i++) {
        const m = i2[i].modInv(q).times(R).mod(q);
        bytesi2.push(...utils.bigInt2BytesLE(m, n8));
    }

    const INV2 = module.alloc(bytesi2);

    function rev(x) {
        let r=0;
        for (let i=0; i<8; i++) {
            if (x & (1 << i)) {
                r = r | (0x80 >> i);
            }
        }
        return r;
    }

    const rtable = Array(256);
    for (let i=0; i<256; i++) {
        rtable[i] = rev(i);
    }

    const REVTABLE = module.alloc(rtable);


    function buildLog2() {
        const f = module.addFunction(prefix+"__log2");
        f.addParam("n", "i32");
        f.setReturnType("i32");
        f.addLocal("bits", "i32");
        f.addLocal("aux", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.setLocal(
                "aux",
                c.i32_shr_u(
                    c.getLocal("n"),
                    c.i32_const(1)
                )
            )
        );
        f.addCode(c.setLocal("bits", c.i32_const(0)));

        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.i32_eqz(c.getLocal("aux"))
            ),

            c.setLocal(
                "aux",
                c.i32_shr_u(
                    c.getLocal("aux"),
                    c.i32_const(1)
                )
            ),

            c.setLocal(
                "bits",
                c.i32_add(
                    c.getLocal("bits"),
                    c.i32_const(1)
                )
            ),

            c.br(0)
        )));

        f.addCode(c.if(
            c.i32_ne(
                c.getLocal("n"),
                c.i32_shl(
                    c.i32_const(1),
                    c.getLocal("bits")
                )
            ),
            c.unreachable()
        ));

        f.addCode(c.if(
            c.i32_gt_u(
                c.getLocal("bits"),
                c.i32_const(maxBits)
            ),
            c.unreachable()
        ));

        f.addCode(c.getLocal("bits"));
    }

    function buildFFT() {
        const f = module.addFunction(prefix+"_fft");
        f.addParam("px", "i32");
        f.addParam("n", "i32");
        f.addParam("odd", "i32");

        f.addLocal("bits", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.setLocal(
                "bits",
                c.call(
                    prefix + "__log2",
                    c.getLocal("n")
                )
            )
        );


        f.addCode(c.call(
            prefix+"__rawfft",
            c.getLocal("px"),
            c.getLocal("bits"),
            c.getLocal("odd"),
        ));

    }

    function buildIFFT() {
        const f = module.addFunction(prefix+"_ifft");
        f.addParam("px", "i32");
        f.addParam("n", "i32");
        f.addParam("odd", "i32");
        f.addLocal("bits", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.setLocal(
                "bits",
                c.call(
                    prefix + "__log2",
                    c.getLocal("n")
                )
            )
        );

        f.addCode(c.call(
            prefix+"__rawfft",
            c.getLocal("px"),
            c.getLocal("bits"),
            c.getLocal("odd")
        ));

        f.addCode(c.call(
            prefix+"__finalInverse",
            c.getLocal("px"),
            c.getLocal("bits"),
        ));

    }

    function buildRawFFT() {
        const f = module.addFunction(prefix+"__rawfft");
        f.addParam("px", "i32");
        f.addParam("bits", "i32");
        f.addParam("odd", "i32");
        f.addLocal("s", "i32");
        f.addLocal("k", "i32");
        f.addLocal("j", "i32");
        f.addLocal("m", "i32");
        f.addLocal("mdiv2", "i32");
        f.addLocal("n", "i32");
        f.addLocal("pwm", "i32");
        f.addLocal("idx1", "i32");
        f.addLocal("idx2", "i32");

        const c = f.getCodeBuilder();

        const W = c.i32_const(module.alloc(n8));
        const T = c.i32_const(module.alloc(n8));
        const U = c.i32_const(module.alloc(n8));

        f.addCode(
            c.call(prefix + "__reversePermutation", c.getLocal("px"), c.getLocal("bits")),
            c.setLocal("n", c.i32_shl(c.i32_const(1), c.getLocal("bits"))),
            c.setLocal("s", c.i32_const(1)),
            c.block(c.loop(
                c.br_if(
                    1,
                    c.i32_gt_u(
                        c.getLocal("s"),
                        c.getLocal("bits")
                    )
                ),
                c.setLocal("m", c.i32_shl(c.i32_const(1), c.getLocal("s"))),
                c.setLocal("pwm",
                    c.i32_add(
                        c.i32_const(ROOTs),
                        c.i32_mul(
                            c.getLocal("s"),
                            c.i32_const(n8)
                        )
                    )
                ),
                c.setLocal("k", c.i32_const(0)),
                c.block(c.loop(
                    c.br_if(
                        1,
                        c.i32_ge_u(
                            c.getLocal("k"),
                            c.getLocal("n")
                        )
                    ),

                    c.if(
                        c.getLocal("odd"),
                        c.call(
                            f1mPrefix + "_copy",
                            c.i32_add(
                                c.getLocal("pwm"),
                                c.i32_const(n8)
                            ),
                            W
                        ),
                        c.call(f1mPrefix + "_one", W)
                    ),


                    c.setLocal("mdiv2", c.i32_shr_u(c.getLocal("m"), c.i32_const(1)) ),
                    c.setLocal("j", c.i32_const(0)),
                    c.block(c.loop(
                        c.br_if(
                            1,
                            c.i32_ge_u(
                                c.getLocal("j"),
                                c.getLocal("mdiv2")
                            )
                        ),

                        c.setLocal(
                            "idx1",
                            c.i32_add(
                                c.getLocal("px"),
                                c.i32_mul(
                                    c.i32_add(
                                        c.getLocal("k"),
                                        c.getLocal("j")
                                    ),
                                    c.i32_const(n8)
                                )
                            )
                        ),

                        c.setLocal(
                            "idx2",
                            c.i32_add(
                                c.getLocal("idx1"),
                                c.i32_mul(
                                    c.getLocal("mdiv2"),
                                    c.i32_const(n8)
                                )
                            )
                        ),

                        c.call(
                            f1mPrefix + "_mul",
                            W,
                            c.getLocal("idx2"),
                            T
                        ),

                        c.call(
                            f1mPrefix + "_copy",
                            c.getLocal("idx1"),
                            U
                        ),

                        c.call(
                            f1mPrefix + "_add",
                            U,
                            T,
                            c.getLocal("idx1"),
                        ),

                        c.call(
                            f1mPrefix + "_sub",
                            U,
                            T,
                            c.getLocal("idx2"),
                        ),

                        c.call(
                            f1mPrefix + "_mul",
                            W,
                            c.getLocal("pwm"),
                            W,
                        ),

                        c.setLocal("j", c.i32_add(c.getLocal("j"), c.i32_const(1))),
                        c.br(0)
                    )),

                    c.setLocal("k", c.i32_add(c.getLocal("k"), c.getLocal("m"))),
                    c.br(0)
                )),

                c.setLocal("s", c.i32_add(c.getLocal("s"), c.i32_const(1))),
                c.br(0)
            ))
        );
    }

    function buildCopyInterleaved() {
        const f = module.addFunction(prefix+"_copyNInterleaved");
        f.addParam("ps", "i32");
        f.addParam("pd", "i32");
        f.addParam("n", "i32");
        f.addLocal("pi", "i32");
        f.addLocal("po", "i32");
        f.addLocal("pn", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.setLocal("pi", c.getLocal("ps")),
            c.setLocal("po", c.getLocal("pd")),
            c.setLocal(
                "pn",
                c.i32_add(
                    c.getLocal("ps"),
                    c.i32_mul(
                        c.getLocal("n"),
                        c.i32_const(n8)
                    )
                )
            ),
            c.block(c.loop(
                c.br_if(
                    1,
                    c.i32_eq(
                        c.getLocal("pi"),
                        c.getLocal("pn")
                    )
                ),

                c.call(f1mPrefix + "_copy", c.getLocal("pi"), c.getLocal("po")),

                c.setLocal("pi", c.i32_add(c.getLocal("pi"), c.i32_const(n8))),
                c.setLocal("po", c.i32_add(c.getLocal("po"), c.i32_const(n8*2))),
                c.br(0)
            ))
        );
    }



    function buildToMontgomery() {
        const f = module.addFunction(prefix+"_toMontgomeryN");
        f.addParam("ps", "i32");
        f.addParam("pd", "i32");
        f.addParam("n", "i32");
        f.addLocal("pi", "i32");
        f.addLocal("po", "i32");
        f.addLocal("pn", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.setLocal("pi", c.getLocal("ps")),
            c.setLocal("po", c.getLocal("pd")),
            c.setLocal(
                "pn",
                c.i32_add(
                    c.getLocal("ps"),
                    c.i32_mul(
                        c.getLocal("n"),
                        c.i32_const(n8)
                    )
                )
            ),
            c.block(c.loop(
                c.br_if(
                    1,
                    c.i32_eq(
                        c.getLocal("pi"),
                        c.getLocal("pn")
                    )
                ),

                c.call(f1mPrefix + "_toMontgomery", c.getLocal("pi"), c.getLocal("po")),

                c.setLocal("pi", c.i32_add(c.getLocal("pi"), c.i32_const(n8))),
                c.setLocal("po", c.i32_add(c.getLocal("po"), c.i32_const(n8))),
                c.br(0)
            ))
        );
    }


    function buildMulN() {
        const f = module.addFunction(prefix+"_mulN");
        f.addParam("px", "i32");
        f.addParam("py", "i32");
        f.addParam("n", "i32");
        f.addParam("pd", "i32");
        f.addLocal("pix", "i32");
        f.addLocal("piy", "i32");
        f.addLocal("po", "i32");
        f.addLocal("lastpix", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.setLocal("pix", c.getLocal("px")),
            c.setLocal("piy", c.getLocal("py")),
            c.setLocal("po", c.getLocal("pd")),
            c.setLocal(
                "lastpix",
                c.i32_add(
                    c.getLocal("px"),
                    c.i32_mul(
                        c.getLocal("n"),
                        c.i32_const(n8)
                    )
                )
            ),
            c.block(c.loop(
                c.br_if(
                    1,
                    c.i32_eq(
                        c.getLocal("pix"),
                        c.getLocal("lastpix")
                    )
                ),

                c.call(f1mPrefix + "_mul", c.getLocal("pix"), c.getLocal("piy"), c.getLocal("po")),

                c.setLocal("pix", c.i32_add(c.getLocal("pix"), c.i32_const(n8))),
                c.setLocal("piy", c.i32_add(c.getLocal("piy"), c.i32_const(n8))),
                c.setLocal("po", c.i32_add(c.getLocal("po"), c.i32_const(n8))),
                c.br(0)
            ))
        );
    }

    function buildFromMontgomery() {
        const f = module.addFunction(prefix+"_fromMontgomeryN");
        f.addParam("ps", "i32");
        f.addParam("pd", "i32");
        f.addParam("n", "i32");
        f.addLocal("pi", "i32");
        f.addLocal("po", "i32");
        f.addLocal("pn", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.setLocal("pi", c.getLocal("ps")),
            c.setLocal("po", c.getLocal("pd")),
            c.setLocal(
                "pn",
                c.i32_add(
                    c.getLocal("ps"),
                    c.i32_mul(
                        c.getLocal("n"),
                        c.i32_const(n8)
                    )
                )
            ),
            c.block(c.loop(
                c.br_if(
                    1,
                    c.i32_eq(
                        c.getLocal("pi"),
                        c.getLocal("pn")
                    )
                ),

                c.call(f1mPrefix + "_fromMontgomery", c.getLocal("pi"), c.getLocal("po")),

                c.setLocal("pi", c.i32_add(c.getLocal("pi"), c.i32_const(n8))),
                c.setLocal("po", c.i32_add(c.getLocal("po"), c.i32_const(n8))),
                c.br(0)
            ))
        );
    }


    function buildFinalInverse() {
        const f = module.addFunction(prefix+"__finalInverse");
        f.addParam("px", "i32");
        f.addParam("bits", "i32");
        f.addLocal("n", "i32");
        f.addLocal("ndiv2", "i32");
        f.addLocal("pInv2", "i32");
        f.addLocal("i", "i32");
        f.addLocal("mask", "i32");
        f.addLocal("idx1", "i32");
        f.addLocal("idx2", "i32");

        const c = f.getCodeBuilder();

        const T = c.i32_const(module.alloc(n8));

        f.addCode(
            c.setLocal("n", c.i32_shl( c.i32_const(1), c.getLocal("bits"))),

            c.setLocal(
                "pInv2",
                c.i32_add(
                    c.i32_const(INV2),
                    c.i32_mul(
                        c.getLocal("bits"),
                        c.i32_const(n8)
                    )
                )
            ),

            c.setLocal("mask", c.i32_sub( c.getLocal("n") , c.i32_const(1))),
            c.setLocal("i", c.i32_const(1)),
            c.setLocal(
                "ndiv2",
                c.i32_shr_u(
                    c.getLocal("n"),
                    c.i32_const(1)
                )
            ),
            c.block(c.loop(
                c.br_if(
                    1,
                    c.i32_eq(
                        c.getLocal("i"),
                        c.getLocal("ndiv2")
                    )
                ),

                c.setLocal("idx1",
                    c.i32_add(
                        c.getLocal("px"),
                        c.i32_mul(
                            c.getLocal("i"),
                            c.i32_const(n8)
                        )
                    )
                ),

                c.setLocal("idx2",
                    c.i32_add(
                        c.getLocal("px"),
                        c.i32_mul(
                            c.i32_sub(
                                c.getLocal("n"),
                                c.getLocal("i")
                            ),
                            c.i32_const(n8)
                        )
                    )
                ),

                c.call(f1mPrefix + "_copy", c.getLocal("idx1"), T),
                c.call(f1mPrefix + "_mul", c.getLocal("idx2") , c.getLocal("pInv2"), c.getLocal("idx1") ),
                c.call(f1mPrefix + "_mul", T , c.getLocal("pInv2"), c.getLocal("idx2")),

//                c.call(f1mPrefix + "_mul", c.getLocal("idx1") , c.getLocal("pInv2"), c.getLocal("idx1") ),
//                c.call(f1mPrefix + "_mul", c.getLocal("idx2") , c.getLocal("pInv2"), c.getLocal("idx1") ),

                c.setLocal("i", c.i32_add(c.getLocal("i"), c.i32_const(1))),

                c.br(0)
            )),

            c.call(f1mPrefix + "_mul", c.getLocal("px") , c.getLocal("pInv2"), c.getLocal("px")),

            c.setLocal("idx2",
                c.i32_add(
                    c.getLocal("px"),
                    c.i32_mul(
                        c.getLocal("ndiv2"),
                        c.i32_const(n8)
                    )
                )
            ),

            c.call(f1mPrefix + "_mul", c.getLocal("idx2"),c.getLocal("pInv2"), c.getLocal("idx2"))

        );
    }

    function buildReversePermutation() {
        const f = module.addFunction(prefix+"__reversePermutation");
        f.addParam("px", "i32");
        f.addParam("bits", "i32");
        f.addLocal("n", "i32");
        f.addLocal("i", "i32");
        f.addLocal("ri", "i32");
        f.addLocal("idx1", "i32");
        f.addLocal("idx2", "i32");

        const c = f.getCodeBuilder();

        const T = c.i32_const(module.alloc(n8));

        f.addCode(
            c.setLocal("n", c.i32_shl( c.i32_const(1), c.getLocal("bits"))),
            c.setLocal("i", c.i32_const(0)),
            c.block(c.loop(
                c.br_if(
                    1,
                    c.i32_eq(
                        c.getLocal("i"),
                        c.getLocal("n")
                    )
                ),

                c.setLocal("idx1",
                    c.i32_add(
                        c.getLocal("px"),
                        c.i32_mul(
                            c.getLocal("i"),
                            c.i32_const(n8)
                        )
                    )
                ),

                c.setLocal("ri", c.call(prefix + "__rev", c.getLocal("i"), c.getLocal("bits"))),

                c.setLocal("idx2",
                    c.i32_add(
                        c.getLocal("px"),
                        c.i32_mul(
                            c.getLocal("ri"),
                            c.i32_const(n8)
                        )
                    )
                ),

                c.if(
                    c.i32_lt_u(
                        c.getLocal("i"),
                        c.getLocal("ri")
                    ),
                    [
                        ...c.call(f1mPrefix + "_copy", c.getLocal("idx1"), T),
                        ...c.call(f1mPrefix + "_copy", c.getLocal("idx2") , c.getLocal("idx1")),
                        ...c.call(f1mPrefix + "_copy", T , c.getLocal("idx2"))
                    ]
                ),

                c.setLocal("i", c.i32_add(c.getLocal("i"), c.i32_const(1))),

                c.br(0)
            ))
        );
    }

    function buildRev() {
        const f = module.addFunction(prefix+"__rev");
        f.addParam("x", "i32");
        f.addParam("bits", "i32");
        f.setReturnType("i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.i32_rotl(
                c.i32_add(
                    c.i32_add(
                        c.i32_shl(
                            c.i32_load8_u(
                                c.i32_and(
                                    c.getLocal("x"),
                                    c.i32_const(0xFF)
                                ),
                                REVTABLE,
                                0
                            ),
                            c.i32_const(24)
                        ),
                        c.i32_shl(
                            c.i32_load8_u(
                                c.i32_and(
                                    c.i32_shr_u(
                                        c.getLocal("x"),
                                        c.i32_const(8)
                                    ),
                                    c.i32_const(0xFF)
                                ),
                                REVTABLE,
                                0
                            ),
                            c.i32_const(16)
                        ),
                    ),
                    c.i32_add(
                        c.i32_shl(
                            c.i32_load8_u(
                                c.i32_and(
                                    c.i32_shr_u(
                                        c.getLocal("x"),
                                        c.i32_const(16)
                                    ),
                                    c.i32_const(0xFF)
                                ),
                                REVTABLE,
                                0
                            ),
                            c.i32_const(8)
                        ),
                        c.i32_load8_u(
                            c.i32_and(
                                c.i32_shr_u(
                                    c.getLocal("x"),
                                    c.i32_const(24)
                                ),
                                c.i32_const(0xFF)
                            ),
                            REVTABLE,
                            0
                        ),
                    )
                ),
                c.getLocal("bits")
            )
        );
    }


    buildRev();
    buildReversePermutation();
    buildRawFFT();
    buildCopyInterleaved();
    buildFromMontgomery();
    buildToMontgomery();
    buildFinalInverse();
    buildLog2();
    buildFFT();
    buildIFFT();
    buildMulN();

    module.exportFunction(prefix+"_fft");
    module.exportFunction(prefix+"_ifft");
    module.exportFunction(prefix+"_toMontgomeryN");
    module.exportFunction(prefix+"_fromMontgomeryN");
    module.exportFunction(prefix+"_copyNInterleaved");
    module.exportFunction(prefix+"_mulN");

};
