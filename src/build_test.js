
function buildTest(module, fn) {
    const f = module.addFunction("test_"+fn);
    f.addParam("x", "i32");
    f.addParam("y", "i32");
    f.addParam("r", "i32");
    f.addParam("n", "i32");
    f.addLocal("i", "i32");

    const c = f.getCodeBuilder();

    f.addCode(c.setLocal("i", c.getLocal("n")));
    f.addCode(c.block(c.loop(
        c.call(fn, c.getLocal("x"),  c.getLocal("y"),  c.getLocal("r")),
        c.setLocal("i", c.i32_sub(c.getLocal("i"), c.i32_const(1))),
        c.br_if(1, c.i32_eqz ( c.getLocal("i") )),
        c.br(0)
    )));

    module.exportFunction("test_"+fn);
}

module.exports = buildTest;
