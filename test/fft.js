const assert = require("assert");
const refBn128 = require("snarkjs").bn128;
const refBigInt = require("snarkjs").bigInt;

const buildBn128 = require("../index.js").buildBn128;

describe("FFT tests", () => {
    it("create a basic FFT", async () => {
        const bn128 = await buildBn128();

        const N=4;

        const p = bn128.alloc(32*N);
        for (let i=0; i<N; i++) {
            bn128.putInt(p+i*32, i);
        }

        bn128.fft_toMontgomeryN(p, p, N);
        bn128.fft_fft(p, N);
        bn128.fft_ifft(p, N);
        bn128.fft_fromMontgomeryN(p, p, N);

        for (let i=0; i<N; i++) {
            const a = bn128.getInt(p+i*32);
            assert.equal(a,i);
        }
    });

    it("create a do it reverselly FFT", async () => {
        const bn128 = await buildBn128();

        const N=1024;

        const p = bn128.alloc(32*N);
        for (let i=0; i<N; i++) {
            bn128.putInt(p+i*32, i);
        }

        bn128.fft_toMontgomeryN(p, p, N);
        bn128.fft_ifft(p, N, 0);
        bn128.fft_fft(p, N, 0);
        bn128.fft_fromMontgomeryN(p, p, N);

        for (let i=0; i<N; i++) {
            const a = bn128.getInt(p+i*32);
            assert.equal(a,i);
        }
    });
    it("test with zeros", async () => {
        const bn128 = await buildBn128();

        const N=1024;

        const p = bn128.alloc(32*N);
        for (let i=0; i<N; i++) {
            bn128.putInt(p+i*32, (i%2 == 0)? 0 : 1);
        }

        bn128.fft_toMontgomeryN(p, p, N);
        bn128.fft_ifft(p, N, 0);
        bn128.fft_fft(p, N, 0);
        bn128.fft_fromMontgomeryN(p, p, N);

        for (let i=0; i<N; i++) {
            const a = bn128.getInt(p+i*32);
            assert.equal(a,(i%2 == 0)? 0 : 1);
        }
    });
    it("test interleaved", async () => {
        const bn128 = await buildBn128();

        const N=1024;

        const p = bn128.alloc(32*N);
        const pr1 = bn128.alloc(32*N*2);
        const pr2 = bn128.alloc(32*N*2);
        for (let i=0; i<N; i++) {
            bn128.putInt(p+i*32, i);
        }
        bn128.fft_toMontgomeryN(p, p, N);
        bn128.fft_fft(p, N, 0);
        bn128.fft_copyNInterleaved(p, pr1, N);

        for (let i=0; i<N; i++) {
            bn128.putInt(p+i*32, i);
        }
        bn128.fft_toMontgomeryN(p, p, N);
        bn128.fft_fft(p, N, 1);
        bn128.fft_copyNInterleaved(p, pr1+32, N);

        bn128.fft_fromMontgomeryN(pr1, pr1, N*2);

        for (let i=0; i<N; i++) {
            bn128.putInt(pr2+i*32, i);
        }
        for (let i=N; i<N*2; i++) {
            bn128.putInt(pr2+i*32, 0);
        }
        bn128.fft_toMontgomeryN(pr2, pr2, N*2);
        bn128.fft_fft(pr2, N*2, 0);
        bn128.fft_fromMontgomeryN(pr2, pr2, N*2);

        for (let i=0; i<N*2; i++) {
            const a = bn128.getInt(pr1+i*32, 1);
            const b = bn128.getInt(pr2+i*32, 1);
            assert(a.equals(b));
        }

        bn128.fft_toMontgomeryN(pr1, pr1, N*2);
        bn128.fft_ifft(pr1, N*2, 0);
        bn128.fft_fromMontgomeryN(pr1, pr1, N*2);
        for (let i=0; i<N; i++) {
            const a = bn128.getInt(pr1+i*32, 1);
            assert.equal(a,i);
        }
        for (let i=N; i<N*2; i++) {
            const a = bn128.getInt(pr1+i*32, 1);
            assert.equal(a,0);
        }

    });

});
