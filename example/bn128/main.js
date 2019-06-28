(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports.buildF1 = require("./src/f1.js");
module.exports.buildBn128 = require("./src/bn128.js");
module.exports.buildGroth16 = require("./src/groth16.js");

},{"./src/bn128.js":3,"./src/f1.js":15,"./src/groth16.js":16}],2:[function(require,module,exports){
var bigInt = (function (undefined) {
    "use strict";

    var BASE = 1e7,
        LOG_BASE = 7,
        MAX_INT = 9007199254740992,
        MAX_INT_ARR = smallToArray(MAX_INT),
        DEFAULT_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

    var supportsNativeBigInt = typeof BigInt === "function";

    function Integer(v, radix, alphabet, caseSensitive) {
        if (typeof v === "undefined") return Integer[0];
        if (typeof radix !== "undefined") return +radix === 10 && !alphabet ? parseValue(v) : parseBase(v, radix, alphabet, caseSensitive);
        return parseValue(v);
    }

    function BigInteger(value, sign) {
        this.value = value;
        this.sign = sign;
        this.isSmall = false;
    }
    BigInteger.prototype = Object.create(Integer.prototype);

    function SmallInteger(value) {
        this.value = value;
        this.sign = value < 0;
        this.isSmall = true;
    }
    SmallInteger.prototype = Object.create(Integer.prototype);

    function NativeBigInt(value) {
        this.value = value;
    }
    NativeBigInt.prototype = Object.create(Integer.prototype);

    function isPrecise(n) {
        return -MAX_INT < n && n < MAX_INT;
    }

    function smallToArray(n) { // For performance reasons doesn't reference BASE, need to change this function if BASE changes
        if (n < 1e7)
            return [n];
        if (n < 1e14)
            return [n % 1e7, Math.floor(n / 1e7)];
        return [n % 1e7, Math.floor(n / 1e7) % 1e7, Math.floor(n / 1e14)];
    }

    function arrayToSmall(arr) { // If BASE changes this function may need to change
        trim(arr);
        var length = arr.length;
        if (length < 4 && compareAbs(arr, MAX_INT_ARR) < 0) {
            switch (length) {
                case 0: return 0;
                case 1: return arr[0];
                case 2: return arr[0] + arr[1] * BASE;
                default: return arr[0] + (arr[1] + arr[2] * BASE) * BASE;
            }
        }
        return arr;
    }

    function trim(v) {
        var i = v.length;
        while (v[--i] === 0);
        v.length = i + 1;
    }

    function createArray(length) { // function shamelessly stolen from Yaffle's library https://github.com/Yaffle/BigInteger
        var x = new Array(length);
        var i = -1;
        while (++i < length) {
            x[i] = 0;
        }
        return x;
    }

    function truncate(n) {
        if (n > 0) return Math.floor(n);
        return Math.ceil(n);
    }

    function add(a, b) { // assumes a and b are arrays with a.length >= b.length
        var l_a = a.length,
            l_b = b.length,
            r = new Array(l_a),
            carry = 0,
            base = BASE,
            sum, i;
        for (i = 0; i < l_b; i++) {
            sum = a[i] + b[i] + carry;
            carry = sum >= base ? 1 : 0;
            r[i] = sum - carry * base;
        }
        while (i < l_a) {
            sum = a[i] + carry;
            carry = sum === base ? 1 : 0;
            r[i++] = sum - carry * base;
        }
        if (carry > 0) r.push(carry);
        return r;
    }

    function addAny(a, b) {
        if (a.length >= b.length) return add(a, b);
        return add(b, a);
    }

    function addSmall(a, carry) { // assumes a is array, carry is number with 0 <= carry < MAX_INT
        var l = a.length,
            r = new Array(l),
            base = BASE,
            sum, i;
        for (i = 0; i < l; i++) {
            sum = a[i] - base + carry;
            carry = Math.floor(sum / base);
            r[i] = sum - carry * base;
            carry += 1;
        }
        while (carry > 0) {
            r[i++] = carry % base;
            carry = Math.floor(carry / base);
        }
        return r;
    }

    BigInteger.prototype.add = function (v) {
        var n = parseValue(v);
        if (this.sign !== n.sign) {
            return this.subtract(n.negate());
        }
        var a = this.value, b = n.value;
        if (n.isSmall) {
            return new BigInteger(addSmall(a, Math.abs(b)), this.sign);
        }
        return new BigInteger(addAny(a, b), this.sign);
    };
    BigInteger.prototype.plus = BigInteger.prototype.add;

    SmallInteger.prototype.add = function (v) {
        var n = parseValue(v);
        var a = this.value;
        if (a < 0 !== n.sign) {
            return this.subtract(n.negate());
        }
        var b = n.value;
        if (n.isSmall) {
            if (isPrecise(a + b)) return new SmallInteger(a + b);
            b = smallToArray(Math.abs(b));
        }
        return new BigInteger(addSmall(b, Math.abs(a)), a < 0);
    };
    SmallInteger.prototype.plus = SmallInteger.prototype.add;

    NativeBigInt.prototype.add = function (v) {
        return new NativeBigInt(this.value + parseValue(v).value);
    }
    NativeBigInt.prototype.plus = NativeBigInt.prototype.add;

    function subtract(a, b) { // assumes a and b are arrays with a >= b
        var a_l = a.length,
            b_l = b.length,
            r = new Array(a_l),
            borrow = 0,
            base = BASE,
            i, difference;
        for (i = 0; i < b_l; i++) {
            difference = a[i] - borrow - b[i];
            if (difference < 0) {
                difference += base;
                borrow = 1;
            } else borrow = 0;
            r[i] = difference;
        }
        for (i = b_l; i < a_l; i++) {
            difference = a[i] - borrow;
            if (difference < 0) difference += base;
            else {
                r[i++] = difference;
                break;
            }
            r[i] = difference;
        }
        for (; i < a_l; i++) {
            r[i] = a[i];
        }
        trim(r);
        return r;
    }

    function subtractAny(a, b, sign) {
        var value;
        if (compareAbs(a, b) >= 0) {
            value = subtract(a, b);
        } else {
            value = subtract(b, a);
            sign = !sign;
        }
        value = arrayToSmall(value);
        if (typeof value === "number") {
            if (sign) value = -value;
            return new SmallInteger(value);
        }
        return new BigInteger(value, sign);
    }

    function subtractSmall(a, b, sign) { // assumes a is array, b is number with 0 <= b < MAX_INT
        var l = a.length,
            r = new Array(l),
            carry = -b,
            base = BASE,
            i, difference;
        for (i = 0; i < l; i++) {
            difference = a[i] + carry;
            carry = Math.floor(difference / base);
            difference %= base;
            r[i] = difference < 0 ? difference + base : difference;
        }
        r = arrayToSmall(r);
        if (typeof r === "number") {
            if (sign) r = -r;
            return new SmallInteger(r);
        } return new BigInteger(r, sign);
    }

    BigInteger.prototype.subtract = function (v) {
        var n = parseValue(v);
        if (this.sign !== n.sign) {
            return this.add(n.negate());
        }
        var a = this.value, b = n.value;
        if (n.isSmall)
            return subtractSmall(a, Math.abs(b), this.sign);
        return subtractAny(a, b, this.sign);
    };
    BigInteger.prototype.minus = BigInteger.prototype.subtract;

    SmallInteger.prototype.subtract = function (v) {
        var n = parseValue(v);
        var a = this.value;
        if (a < 0 !== n.sign) {
            return this.add(n.negate());
        }
        var b = n.value;
        if (n.isSmall) {
            return new SmallInteger(a - b);
        }
        return subtractSmall(b, Math.abs(a), a >= 0);
    };
    SmallInteger.prototype.minus = SmallInteger.prototype.subtract;

    NativeBigInt.prototype.subtract = function (v) {
        return new NativeBigInt(this.value - parseValue(v).value);
    }
    NativeBigInt.prototype.minus = NativeBigInt.prototype.subtract;

    BigInteger.prototype.negate = function () {
        return new BigInteger(this.value, !this.sign);
    };
    SmallInteger.prototype.negate = function () {
        var sign = this.sign;
        var small = new SmallInteger(-this.value);
        small.sign = !sign;
        return small;
    };
    NativeBigInt.prototype.negate = function () {
        return new NativeBigInt(-this.value);
    }

    BigInteger.prototype.abs = function () {
        return new BigInteger(this.value, false);
    };
    SmallInteger.prototype.abs = function () {
        return new SmallInteger(Math.abs(this.value));
    };
    NativeBigInt.prototype.abs = function () {
        return new NativeBigInt(this.value >= 0 ? this.value : -this.value);
    }


    function multiplyLong(a, b) {
        var a_l = a.length,
            b_l = b.length,
            l = a_l + b_l,
            r = createArray(l),
            base = BASE,
            product, carry, i, a_i, b_j;
        for (i = 0; i < a_l; ++i) {
            a_i = a[i];
            for (var j = 0; j < b_l; ++j) {
                b_j = b[j];
                product = a_i * b_j + r[i + j];
                carry = Math.floor(product / base);
                r[i + j] = product - carry * base;
                r[i + j + 1] += carry;
            }
        }
        trim(r);
        return r;
    }

    function multiplySmall(a, b) { // assumes a is array, b is number with |b| < BASE
        var l = a.length,
            r = new Array(l),
            base = BASE,
            carry = 0,
            product, i;
        for (i = 0; i < l; i++) {
            product = a[i] * b + carry;
            carry = Math.floor(product / base);
            r[i] = product - carry * base;
        }
        while (carry > 0) {
            r[i++] = carry % base;
            carry = Math.floor(carry / base);
        }
        return r;
    }

    function shiftLeft(x, n) {
        var r = [];
        while (n-- > 0) r.push(0);
        return r.concat(x);
    }

    function multiplyKaratsuba(x, y) {
        var n = Math.max(x.length, y.length);

        if (n <= 30) return multiplyLong(x, y);
        n = Math.ceil(n / 2);

        var b = x.slice(n),
            a = x.slice(0, n),
            d = y.slice(n),
            c = y.slice(0, n);

        var ac = multiplyKaratsuba(a, c),
            bd = multiplyKaratsuba(b, d),
            abcd = multiplyKaratsuba(addAny(a, b), addAny(c, d));

        var product = addAny(addAny(ac, shiftLeft(subtract(subtract(abcd, ac), bd), n)), shiftLeft(bd, 2 * n));
        trim(product);
        return product;
    }

    // The following function is derived from a surface fit of a graph plotting the performance difference
    // between long multiplication and karatsuba multiplication versus the lengths of the two arrays.
    function useKaratsuba(l1, l2) {
        return -0.012 * l1 - 0.012 * l2 + 0.000015 * l1 * l2 > 0;
    }

    BigInteger.prototype.multiply = function (v) {
        var n = parseValue(v),
            a = this.value, b = n.value,
            sign = this.sign !== n.sign,
            abs;
        if (n.isSmall) {
            if (b === 0) return Integer[0];
            if (b === 1) return this;
            if (b === -1) return this.negate();
            abs = Math.abs(b);
            if (abs < BASE) {
                return new BigInteger(multiplySmall(a, abs), sign);
            }
            b = smallToArray(abs);
        }
        if (useKaratsuba(a.length, b.length)) // Karatsuba is only faster for certain array sizes
            return new BigInteger(multiplyKaratsuba(a, b), sign);
        return new BigInteger(multiplyLong(a, b), sign);
    };

    BigInteger.prototype.times = BigInteger.prototype.multiply;

    function multiplySmallAndArray(a, b, sign) { // a >= 0
        if (a < BASE) {
            return new BigInteger(multiplySmall(b, a), sign);
        }
        return new BigInteger(multiplyLong(b, smallToArray(a)), sign);
    }
    SmallInteger.prototype._multiplyBySmall = function (a) {
        if (isPrecise(a.value * this.value)) {
            return new SmallInteger(a.value * this.value);
        }
        return multiplySmallAndArray(Math.abs(a.value), smallToArray(Math.abs(this.value)), this.sign !== a.sign);
    };
    BigInteger.prototype._multiplyBySmall = function (a) {
        if (a.value === 0) return Integer[0];
        if (a.value === 1) return this;
        if (a.value === -1) return this.negate();
        return multiplySmallAndArray(Math.abs(a.value), this.value, this.sign !== a.sign);
    };
    SmallInteger.prototype.multiply = function (v) {
        return parseValue(v)._multiplyBySmall(this);
    };
    SmallInteger.prototype.times = SmallInteger.prototype.multiply;

    NativeBigInt.prototype.multiply = function (v) {
        return new NativeBigInt(this.value * parseValue(v).value);
    }
    NativeBigInt.prototype.times = NativeBigInt.prototype.multiply;

    function square(a) {
        //console.assert(2 * BASE * BASE < MAX_INT);
        var l = a.length,
            r = createArray(l + l),
            base = BASE,
            product, carry, i, a_i, a_j;
        for (i = 0; i < l; i++) {
            a_i = a[i];
            carry = 0 - a_i * a_i;
            for (var j = i; j < l; j++) {
                a_j = a[j];
                product = 2 * (a_i * a_j) + r[i + j] + carry;
                carry = Math.floor(product / base);
                r[i + j] = product - carry * base;
            }
            r[i + l] = carry;
        }
        trim(r);
        return r;
    }

    BigInteger.prototype.square = function () {
        return new BigInteger(square(this.value), false);
    };

    SmallInteger.prototype.square = function () {
        var value = this.value * this.value;
        if (isPrecise(value)) return new SmallInteger(value);
        return new BigInteger(square(smallToArray(Math.abs(this.value))), false);
    };

    NativeBigInt.prototype.square = function (v) {
        return new NativeBigInt(this.value * this.value);
    }

    function divMod1(a, b) { // Left over from previous version. Performs faster than divMod2 on smaller input sizes.
        var a_l = a.length,
            b_l = b.length,
            base = BASE,
            result = createArray(b.length),
            divisorMostSignificantDigit = b[b_l - 1],
            // normalization
            lambda = Math.ceil(base / (2 * divisorMostSignificantDigit)),
            remainder = multiplySmall(a, lambda),
            divisor = multiplySmall(b, lambda),
            quotientDigit, shift, carry, borrow, i, l, q;
        if (remainder.length <= a_l) remainder.push(0);
        divisor.push(0);
        divisorMostSignificantDigit = divisor[b_l - 1];
        for (shift = a_l - b_l; shift >= 0; shift--) {
            quotientDigit = base - 1;
            if (remainder[shift + b_l] !== divisorMostSignificantDigit) {
                quotientDigit = Math.floor((remainder[shift + b_l] * base + remainder[shift + b_l - 1]) / divisorMostSignificantDigit);
            }
            // quotientDigit <= base - 1
            carry = 0;
            borrow = 0;
            l = divisor.length;
            for (i = 0; i < l; i++) {
                carry += quotientDigit * divisor[i];
                q = Math.floor(carry / base);
                borrow += remainder[shift + i] - (carry - q * base);
                carry = q;
                if (borrow < 0) {
                    remainder[shift + i] = borrow + base;
                    borrow = -1;
                } else {
                    remainder[shift + i] = borrow;
                    borrow = 0;
                }
            }
            while (borrow !== 0) {
                quotientDigit -= 1;
                carry = 0;
                for (i = 0; i < l; i++) {
                    carry += remainder[shift + i] - base + divisor[i];
                    if (carry < 0) {
                        remainder[shift + i] = carry + base;
                        carry = 0;
                    } else {
                        remainder[shift + i] = carry;
                        carry = 1;
                    }
                }
                borrow += carry;
            }
            result[shift] = quotientDigit;
        }
        // denormalization
        remainder = divModSmall(remainder, lambda)[0];
        return [arrayToSmall(result), arrayToSmall(remainder)];
    }

    function divMod2(a, b) { // Implementation idea shamelessly stolen from Silent Matt's library http://silentmatt.com/biginteger/
        // Performs faster than divMod1 on larger input sizes.
        var a_l = a.length,
            b_l = b.length,
            result = [],
            part = [],
            base = BASE,
            guess, xlen, highx, highy, check;
        while (a_l) {
            part.unshift(a[--a_l]);
            trim(part);
            if (compareAbs(part, b) < 0) {
                result.push(0);
                continue;
            }
            xlen = part.length;
            highx = part[xlen - 1] * base + part[xlen - 2];
            highy = b[b_l - 1] * base + b[b_l - 2];
            if (xlen > b_l) {
                highx = (highx + 1) * base;
            }
            guess = Math.ceil(highx / highy);
            do {
                check = multiplySmall(b, guess);
                if (compareAbs(check, part) <= 0) break;
                guess--;
            } while (guess);
            result.push(guess);
            part = subtract(part, check);
        }
        result.reverse();
        return [arrayToSmall(result), arrayToSmall(part)];
    }

    function divModSmall(value, lambda) {
        var length = value.length,
            quotient = createArray(length),
            base = BASE,
            i, q, remainder, divisor;
        remainder = 0;
        for (i = length - 1; i >= 0; --i) {
            divisor = remainder * base + value[i];
            q = truncate(divisor / lambda);
            remainder = divisor - q * lambda;
            quotient[i] = q | 0;
        }
        return [quotient, remainder | 0];
    }

    function divModAny(self, v) {
        var value, n = parseValue(v);
        if (supportsNativeBigInt) {
            return [new NativeBigInt(self.value / n.value), new NativeBigInt(self.value % n.value)];
        }
        var a = self.value, b = n.value;
        var quotient;
        if (b === 0) throw new Error("Cannot divide by zero");
        if (self.isSmall) {
            if (n.isSmall) {
                return [new SmallInteger(truncate(a / b)), new SmallInteger(a % b)];
            }
            return [Integer[0], self];
        }
        if (n.isSmall) {
            if (b === 1) return [self, Integer[0]];
            if (b == -1) return [self.negate(), Integer[0]];
            var abs = Math.abs(b);
            if (abs < BASE) {
                value = divModSmall(a, abs);
                quotient = arrayToSmall(value[0]);
                var remainder = value[1];
                if (self.sign) remainder = -remainder;
                if (typeof quotient === "number") {
                    if (self.sign !== n.sign) quotient = -quotient;
                    return [new SmallInteger(quotient), new SmallInteger(remainder)];
                }
                return [new BigInteger(quotient, self.sign !== n.sign), new SmallInteger(remainder)];
            }
            b = smallToArray(abs);
        }
        var comparison = compareAbs(a, b);
        if (comparison === -1) return [Integer[0], self];
        if (comparison === 0) return [Integer[self.sign === n.sign ? 1 : -1], Integer[0]];

        // divMod1 is faster on smaller input sizes
        if (a.length + b.length <= 200)
            value = divMod1(a, b);
        else value = divMod2(a, b);

        quotient = value[0];
        var qSign = self.sign !== n.sign,
            mod = value[1],
            mSign = self.sign;
        if (typeof quotient === "number") {
            if (qSign) quotient = -quotient;
            quotient = new SmallInteger(quotient);
        } else quotient = new BigInteger(quotient, qSign);
        if (typeof mod === "number") {
            if (mSign) mod = -mod;
            mod = new SmallInteger(mod);
        } else mod = new BigInteger(mod, mSign);
        return [quotient, mod];
    }

    BigInteger.prototype.divmod = function (v) {
        var result = divModAny(this, v);
        return {
            quotient: result[0],
            remainder: result[1]
        };
    };
    NativeBigInt.prototype.divmod = SmallInteger.prototype.divmod = BigInteger.prototype.divmod;


    BigInteger.prototype.divide = function (v) {
        return divModAny(this, v)[0];
    };
    NativeBigInt.prototype.over = NativeBigInt.prototype.divide = function (v) {
        return new NativeBigInt(this.value / parseValue(v).value);
    };
    SmallInteger.prototype.over = SmallInteger.prototype.divide = BigInteger.prototype.over = BigInteger.prototype.divide;

    BigInteger.prototype.mod = function (v) {
        return divModAny(this, v)[1];
    };
    NativeBigInt.prototype.mod = NativeBigInt.prototype.remainder = function (v) {
        return new NativeBigInt(this.value % parseValue(v).value);
    };
    SmallInteger.prototype.remainder = SmallInteger.prototype.mod = BigInteger.prototype.remainder = BigInteger.prototype.mod;

    BigInteger.prototype.pow = function (v) {
        var n = parseValue(v),
            a = this.value,
            b = n.value,
            value, x, y;
        if (b === 0) return Integer[1];
        if (a === 0) return Integer[0];
        if (a === 1) return Integer[1];
        if (a === -1) return n.isEven() ? Integer[1] : Integer[-1];
        if (n.sign) {
            return Integer[0];
        }
        if (!n.isSmall) throw new Error("The exponent " + n.toString() + " is too large.");
        if (this.isSmall) {
            if (isPrecise(value = Math.pow(a, b)))
                return new SmallInteger(truncate(value));
        }
        x = this;
        y = Integer[1];
        while (true) {
            if (b & 1 === 1) {
                y = y.times(x);
                --b;
            }
            if (b === 0) break;
            b /= 2;
            x = x.square();
        }
        return y;
    };
    SmallInteger.prototype.pow = BigInteger.prototype.pow;

    NativeBigInt.prototype.pow = function (v) {
        var n = parseValue(v);
        var a = this.value, b = n.value;
        var _0 = BigInt(0), _1 = BigInt(1), _2 = BigInt(2);
        if (b === _0) return Integer[1];
        if (a === _0) return Integer[0];
        if (a === _1) return Integer[1];
        if (a === BigInt(-1)) return n.isEven() ? Integer[1] : Integer[-1];
        if (n.isNegative()) return new NativeBigInt(_0);
        var x = this;
        var y = Integer[1];
        while (true) {
            if ((b & _1) === _1) {
                y = y.times(x);
                --b;
            }
            if (b === _0) break;
            b /= _2;
            x = x.square();
        }
        return y;
    }

    BigInteger.prototype.modPow = function (exp, mod) {
        exp = parseValue(exp);
        mod = parseValue(mod);
        if (mod.isZero()) throw new Error("Cannot take modPow with modulus 0");
        var r = Integer[1],
            base = this.mod(mod);
        while (exp.isPositive()) {
            if (base.isZero()) return Integer[0];
            if (exp.isOdd()) r = r.multiply(base).mod(mod);
            exp = exp.divide(2);
            base = base.square().mod(mod);
        }
        return r;
    };
    NativeBigInt.prototype.modPow = SmallInteger.prototype.modPow = BigInteger.prototype.modPow;

    function compareAbs(a, b) {
        if (a.length !== b.length) {
            return a.length > b.length ? 1 : -1;
        }
        for (var i = a.length - 1; i >= 0; i--) {
            if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
        }
        return 0;
    }

    BigInteger.prototype.compareAbs = function (v) {
        var n = parseValue(v),
            a = this.value,
            b = n.value;
        if (n.isSmall) return 1;
        return compareAbs(a, b);
    };
    SmallInteger.prototype.compareAbs = function (v) {
        var n = parseValue(v),
            a = Math.abs(this.value),
            b = n.value;
        if (n.isSmall) {
            b = Math.abs(b);
            return a === b ? 0 : a > b ? 1 : -1;
        }
        return -1;
    };
    NativeBigInt.prototype.compareAbs = function (v) {
        var a = this.value;
        var b = parseValue(v).value;
        a = a >= 0 ? a : -a;
        b = b >= 0 ? b : -b;
        return a === b ? 0 : a > b ? 1 : -1;
    }

    BigInteger.prototype.compare = function (v) {
        // See discussion about comparison with Infinity:
        // https://github.com/peterolson/BigInteger.js/issues/61
        if (v === Infinity) {
            return -1;
        }
        if (v === -Infinity) {
            return 1;
        }

        var n = parseValue(v),
            a = this.value,
            b = n.value;
        if (this.sign !== n.sign) {
            return n.sign ? 1 : -1;
        }
        if (n.isSmall) {
            return this.sign ? -1 : 1;
        }
        return compareAbs(a, b) * (this.sign ? -1 : 1);
    };
    BigInteger.prototype.compareTo = BigInteger.prototype.compare;

    SmallInteger.prototype.compare = function (v) {
        if (v === Infinity) {
            return -1;
        }
        if (v === -Infinity) {
            return 1;
        }

        var n = parseValue(v),
            a = this.value,
            b = n.value;
        if (n.isSmall) {
            return a == b ? 0 : a > b ? 1 : -1;
        }
        if (a < 0 !== n.sign) {
            return a < 0 ? -1 : 1;
        }
        return a < 0 ? 1 : -1;
    };
    SmallInteger.prototype.compareTo = SmallInteger.prototype.compare;

    NativeBigInt.prototype.compare = function (v) {
        if (v === Infinity) {
            return -1;
        }
        if (v === -Infinity) {
            return 1;
        }
        var a = this.value;
        var b = parseValue(v).value;
        return a === b ? 0 : a > b ? 1 : -1;
    }
    NativeBigInt.prototype.compareTo = NativeBigInt.prototype.compare;

    BigInteger.prototype.equals = function (v) {
        return this.compare(v) === 0;
    };
    NativeBigInt.prototype.eq = NativeBigInt.prototype.equals = SmallInteger.prototype.eq = SmallInteger.prototype.equals = BigInteger.prototype.eq = BigInteger.prototype.equals;

    BigInteger.prototype.notEquals = function (v) {
        return this.compare(v) !== 0;
    };
    NativeBigInt.prototype.neq = NativeBigInt.prototype.notEquals = SmallInteger.prototype.neq = SmallInteger.prototype.notEquals = BigInteger.prototype.neq = BigInteger.prototype.notEquals;

    BigInteger.prototype.greater = function (v) {
        return this.compare(v) > 0;
    };
    NativeBigInt.prototype.gt = NativeBigInt.prototype.greater = SmallInteger.prototype.gt = SmallInteger.prototype.greater = BigInteger.prototype.gt = BigInteger.prototype.greater;

    BigInteger.prototype.lesser = function (v) {
        return this.compare(v) < 0;
    };
    NativeBigInt.prototype.lt = NativeBigInt.prototype.lesser = SmallInteger.prototype.lt = SmallInteger.prototype.lesser = BigInteger.prototype.lt = BigInteger.prototype.lesser;

    BigInteger.prototype.greaterOrEquals = function (v) {
        return this.compare(v) >= 0;
    };
    NativeBigInt.prototype.geq = NativeBigInt.prototype.greaterOrEquals = SmallInteger.prototype.geq = SmallInteger.prototype.greaterOrEquals = BigInteger.prototype.geq = BigInteger.prototype.greaterOrEquals;

    BigInteger.prototype.lesserOrEquals = function (v) {
        return this.compare(v) <= 0;
    };
    NativeBigInt.prototype.leq = NativeBigInt.prototype.lesserOrEquals = SmallInteger.prototype.leq = SmallInteger.prototype.lesserOrEquals = BigInteger.prototype.leq = BigInteger.prototype.lesserOrEquals;

    BigInteger.prototype.isEven = function () {
        return (this.value[0] & 1) === 0;
    };
    SmallInteger.prototype.isEven = function () {
        return (this.value & 1) === 0;
    };
    NativeBigInt.prototype.isEven = function () {
        return (this.value & BigInt(1)) === BigInt(0);
    }

    BigInteger.prototype.isOdd = function () {
        return (this.value[0] & 1) === 1;
    };
    SmallInteger.prototype.isOdd = function () {
        return (this.value & 1) === 1;
    };
    NativeBigInt.prototype.isOdd = function () {
        return (this.value & BigInt(1)) === BigInt(1);
    }

    BigInteger.prototype.isPositive = function () {
        return !this.sign;
    };
    SmallInteger.prototype.isPositive = function () {
        return this.value > 0;
    };
    NativeBigInt.prototype.isPositive = SmallInteger.prototype.isPositive;

    BigInteger.prototype.isNegative = function () {
        return this.sign;
    };
    SmallInteger.prototype.isNegative = function () {
        return this.value < 0;
    };
    NativeBigInt.prototype.isNegative = SmallInteger.prototype.isNegative;

    BigInteger.prototype.isUnit = function () {
        return false;
    };
    SmallInteger.prototype.isUnit = function () {
        return Math.abs(this.value) === 1;
    };
    NativeBigInt.prototype.isUnit = function () {
        return this.abs().value === BigInt(1);
    }

    BigInteger.prototype.isZero = function () {
        return false;
    };
    SmallInteger.prototype.isZero = function () {
        return this.value === 0;
    };
    NativeBigInt.prototype.isZero = function () {
        return this.value === BigInt(0);
    }

    BigInteger.prototype.isDivisibleBy = function (v) {
        var n = parseValue(v);
        if (n.isZero()) return false;
        if (n.isUnit()) return true;
        if (n.compareAbs(2) === 0) return this.isEven();
        return this.mod(n).isZero();
    };
    NativeBigInt.prototype.isDivisibleBy = SmallInteger.prototype.isDivisibleBy = BigInteger.prototype.isDivisibleBy;

    function isBasicPrime(v) {
        var n = v.abs();
        if (n.isUnit()) return false;
        if (n.equals(2) || n.equals(3) || n.equals(5)) return true;
        if (n.isEven() || n.isDivisibleBy(3) || n.isDivisibleBy(5)) return false;
        if (n.lesser(49)) return true;
        // we don't know if it's prime: let the other functions figure it out
    }

    function millerRabinTest(n, a) {
        var nPrev = n.prev(),
            b = nPrev,
            r = 0,
            d, t, i, x;
        while (b.isEven()) b = b.divide(2), r++;
        next: for (i = 0; i < a.length; i++) {
            if (n.lesser(a[i])) continue;
            x = bigInt(a[i]).modPow(b, n);
            if (x.isUnit() || x.equals(nPrev)) continue;
            for (d = r - 1; d != 0; d--) {
                x = x.square().mod(n);
                if (x.isUnit()) return false;
                if (x.equals(nPrev)) continue next;
            }
            return false;
        }
        return true;
    }

    // Set "strict" to true to force GRH-supported lower bound of 2*log(N)^2
    BigInteger.prototype.isPrime = function (strict) {
        var isPrime = isBasicPrime(this);
        if (isPrime !== undefined) return isPrime;
        var n = this.abs();
        var bits = n.bitLength();
        if (bits <= 64)
            return millerRabinTest(n, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]);
        var logN = Math.log(2) * bits.toJSNumber();
        var t = Math.ceil((strict === true) ? (2 * Math.pow(logN, 2)) : logN);
        for (var a = [], i = 0; i < t; i++) {
            a.push(bigInt(i + 2));
        }
        return millerRabinTest(n, a);
    };
    NativeBigInt.prototype.isPrime = SmallInteger.prototype.isPrime = BigInteger.prototype.isPrime;

    BigInteger.prototype.isProbablePrime = function (iterations) {
        var isPrime = isBasicPrime(this);
        if (isPrime !== undefined) return isPrime;
        var n = this.abs();
        var t = iterations === undefined ? 5 : iterations;
        for (var a = [], i = 0; i < t; i++) {
            a.push(bigInt.randBetween(2, n.minus(2)));
        }
        return millerRabinTest(n, a);
    };
    NativeBigInt.prototype.isProbablePrime = SmallInteger.prototype.isProbablePrime = BigInteger.prototype.isProbablePrime;

    BigInteger.prototype.modInv = function (n) {
        var t = bigInt.zero, newT = bigInt.one, r = parseValue(n), newR = this.abs(), q, lastT, lastR;
        while (!newR.isZero()) {
            q = r.divide(newR);
            lastT = t;
            lastR = r;
            t = newT;
            r = newR;
            newT = lastT.subtract(q.multiply(newT));
            newR = lastR.subtract(q.multiply(newR));
        }
        if (!r.isUnit()) throw new Error(this.toString() + " and " + n.toString() + " are not co-prime");
        if (t.compare(0) === -1) {
            t = t.add(n);
        }
        if (this.isNegative()) {
            return t.negate();
        }
        return t;
    };

    NativeBigInt.prototype.modInv = SmallInteger.prototype.modInv = BigInteger.prototype.modInv;

    BigInteger.prototype.next = function () {
        var value = this.value;
        if (this.sign) {
            return subtractSmall(value, 1, this.sign);
        }
        return new BigInteger(addSmall(value, 1), this.sign);
    };
    SmallInteger.prototype.next = function () {
        var value = this.value;
        if (value + 1 < MAX_INT) return new SmallInteger(value + 1);
        return new BigInteger(MAX_INT_ARR, false);
    };
    NativeBigInt.prototype.next = function () {
        return new NativeBigInt(this.value + BigInt(1));
    }

    BigInteger.prototype.prev = function () {
        var value = this.value;
        if (this.sign) {
            return new BigInteger(addSmall(value, 1), true);
        }
        return subtractSmall(value, 1, this.sign);
    };
    SmallInteger.prototype.prev = function () {
        var value = this.value;
        if (value - 1 > -MAX_INT) return new SmallInteger(value - 1);
        return new BigInteger(MAX_INT_ARR, true);
    };
    NativeBigInt.prototype.prev = function () {
        return new NativeBigInt(this.value - BigInt(1));
    }

    var powersOfTwo = [1];
    while (2 * powersOfTwo[powersOfTwo.length - 1] <= BASE) powersOfTwo.push(2 * powersOfTwo[powersOfTwo.length - 1]);
    var powers2Length = powersOfTwo.length, highestPower2 = powersOfTwo[powers2Length - 1];

    function shift_isSmall(n) {
        return Math.abs(n) <= BASE;
    }

    BigInteger.prototype.shiftLeft = function (v) {
        var n = parseValue(v).toJSNumber();
        if (!shift_isSmall(n)) {
            throw new Error(String(n) + " is too large for shifting.");
        }
        if (n < 0) return this.shiftRight(-n);
        var result = this;
        if (result.isZero()) return result;
        while (n >= powers2Length) {
            result = result.multiply(highestPower2);
            n -= powers2Length - 1;
        }
        return result.multiply(powersOfTwo[n]);
    };
    NativeBigInt.prototype.shiftLeft = SmallInteger.prototype.shiftLeft = BigInteger.prototype.shiftLeft;

    BigInteger.prototype.shiftRight = function (v) {
        var remQuo;
        var n = parseValue(v).toJSNumber();
        if (!shift_isSmall(n)) {
            throw new Error(String(n) + " is too large for shifting.");
        }
        if (n < 0) return this.shiftLeft(-n);
        var result = this;
        while (n >= powers2Length) {
            if (result.isZero() || (result.isNegative() && result.isUnit())) return result;
            remQuo = divModAny(result, highestPower2);
            result = remQuo[1].isNegative() ? remQuo[0].prev() : remQuo[0];
            n -= powers2Length - 1;
        }
        remQuo = divModAny(result, powersOfTwo[n]);
        return remQuo[1].isNegative() ? remQuo[0].prev() : remQuo[0];
    };
    NativeBigInt.prototype.shiftRight = SmallInteger.prototype.shiftRight = BigInteger.prototype.shiftRight;

    function bitwise(x, y, fn) {
        y = parseValue(y);
        var xSign = x.isNegative(), ySign = y.isNegative();
        var xRem = xSign ? x.not() : x,
            yRem = ySign ? y.not() : y;
        var xDigit = 0, yDigit = 0;
        var xDivMod = null, yDivMod = null;
        var result = [];
        while (!xRem.isZero() || !yRem.isZero()) {
            xDivMod = divModAny(xRem, highestPower2);
            xDigit = xDivMod[1].toJSNumber();
            if (xSign) {
                xDigit = highestPower2 - 1 - xDigit; // two's complement for negative numbers
            }

            yDivMod = divModAny(yRem, highestPower2);
            yDigit = yDivMod[1].toJSNumber();
            if (ySign) {
                yDigit = highestPower2 - 1 - yDigit; // two's complement for negative numbers
            }

            xRem = xDivMod[0];
            yRem = yDivMod[0];
            result.push(fn(xDigit, yDigit));
        }
        var sum = fn(xSign ? 1 : 0, ySign ? 1 : 0) !== 0 ? bigInt(-1) : bigInt(0);
        for (var i = result.length - 1; i >= 0; i -= 1) {
            sum = sum.multiply(highestPower2).add(bigInt(result[i]));
        }
        return sum;
    }

    BigInteger.prototype.not = function () {
        return this.negate().prev();
    };
    NativeBigInt.prototype.not = SmallInteger.prototype.not = BigInteger.prototype.not;

    BigInteger.prototype.and = function (n) {
        return bitwise(this, n, function (a, b) { return a & b; });
    };
    NativeBigInt.prototype.and = SmallInteger.prototype.and = BigInteger.prototype.and;

    BigInteger.prototype.or = function (n) {
        return bitwise(this, n, function (a, b) { return a | b; });
    };
    NativeBigInt.prototype.or = SmallInteger.prototype.or = BigInteger.prototype.or;

    BigInteger.prototype.xor = function (n) {
        return bitwise(this, n, function (a, b) { return a ^ b; });
    };
    NativeBigInt.prototype.xor = SmallInteger.prototype.xor = BigInteger.prototype.xor;

    var LOBMASK_I = 1 << 30, LOBMASK_BI = (BASE & -BASE) * (BASE & -BASE) | LOBMASK_I;
    function roughLOB(n) { // get lowestOneBit (rough)
        // SmallInteger: return Min(lowestOneBit(n), 1 << 30)
        // BigInteger: return Min(lowestOneBit(n), 1 << 14) [BASE=1e7]
        var v = n.value,
            x = typeof v === "number" ? v | LOBMASK_I :
                typeof v === "bigint" ? v | BigInt(LOBMASK_I) :
                    v[0] + v[1] * BASE | LOBMASK_BI;
        return x & -x;
    }

    function integerLogarithm(value, base) {
        if (base.compareTo(value) <= 0) {
            var tmp = integerLogarithm(value, base.square(base));
            var p = tmp.p;
            var e = tmp.e;
            var t = p.multiply(base);
            return t.compareTo(value) <= 0 ? { p: t, e: e * 2 + 1 } : { p: p, e: e * 2 };
        }
        return { p: bigInt(1), e: 0 };
    }

    BigInteger.prototype.bitLength = function () {
        var n = this;
        if (n.compareTo(bigInt(0)) < 0) {
            n = n.negate().subtract(bigInt(1));
        }
        if (n.compareTo(bigInt(0)) === 0) {
            return bigInt(0);
        }
        return bigInt(integerLogarithm(n, bigInt(2)).e).add(bigInt(1));
    }
    NativeBigInt.prototype.bitLength = SmallInteger.prototype.bitLength = BigInteger.prototype.bitLength;

    function max(a, b) {
        a = parseValue(a);
        b = parseValue(b);
        return a.greater(b) ? a : b;
    }
    function min(a, b) {
        a = parseValue(a);
        b = parseValue(b);
        return a.lesser(b) ? a : b;
    }
    function gcd(a, b) {
        a = parseValue(a).abs();
        b = parseValue(b).abs();
        if (a.equals(b)) return a;
        if (a.isZero()) return b;
        if (b.isZero()) return a;
        var c = Integer[1], d, t;
        while (a.isEven() && b.isEven()) {
            d = min(roughLOB(a), roughLOB(b));
            a = a.divide(d);
            b = b.divide(d);
            c = c.multiply(d);
        }
        while (a.isEven()) {
            a = a.divide(roughLOB(a));
        }
        do {
            while (b.isEven()) {
                b = b.divide(roughLOB(b));
            }
            if (a.greater(b)) {
                t = b; b = a; a = t;
            }
            b = b.subtract(a);
        } while (!b.isZero());
        return c.isUnit() ? a : a.multiply(c);
    }
    function lcm(a, b) {
        a = parseValue(a).abs();
        b = parseValue(b).abs();
        return a.divide(gcd(a, b)).multiply(b);
    }
    function randBetween(a, b) {
        a = parseValue(a);
        b = parseValue(b);
        var low = min(a, b), high = max(a, b);
        var range = high.subtract(low).add(1);
        if (range.isSmall) return low.add(Math.floor(Math.random() * range));
        var digits = toBase(range, BASE).value;
        var result = [], restricted = true;
        for (var i = 0; i < digits.length; i++) {
            var top = restricted ? digits[i] : BASE;
            var digit = truncate(Math.random() * top);
            result.push(digit);
            if (digit < top) restricted = false;
        }
        return low.add(Integer.fromArray(result, BASE, false));
    }

    var parseBase = function (text, base, alphabet, caseSensitive) {
        alphabet = alphabet || DEFAULT_ALPHABET;
        text = String(text);
        if (!caseSensitive) {
            text = text.toLowerCase();
            alphabet = alphabet.toLowerCase();
        }
        var length = text.length;
        var i;
        var absBase = Math.abs(base);
        var alphabetValues = {};
        for (i = 0; i < alphabet.length; i++) {
            alphabetValues[alphabet[i]] = i;
        }
        for (i = 0; i < length; i++) {
            var c = text[i];
            if (c === "-") continue;
            if (c in alphabetValues) {
                if (alphabetValues[c] >= absBase) {
                    if (c === "1" && absBase === 1) continue;
                    throw new Error(c + " is not a valid digit in base " + base + ".");
                }
            }
        }
        base = parseValue(base);
        var digits = [];
        var isNegative = text[0] === "-";
        for (i = isNegative ? 1 : 0; i < text.length; i++) {
            var c = text[i];
            if (c in alphabetValues) digits.push(parseValue(alphabetValues[c]));
            else if (c === "<") {
                var start = i;
                do { i++; } while (text[i] !== ">" && i < text.length);
                digits.push(parseValue(text.slice(start + 1, i)));
            }
            else throw new Error(c + " is not a valid character");
        }
        return parseBaseFromArray(digits, base, isNegative);
    };

    function parseBaseFromArray(digits, base, isNegative) {
        var val = Integer[0], pow = Integer[1], i;
        for (i = digits.length - 1; i >= 0; i--) {
            val = val.add(digits[i].times(pow));
            pow = pow.times(base);
        }
        return isNegative ? val.negate() : val;
    }

    function stringify(digit, alphabet) {
        alphabet = alphabet || DEFAULT_ALPHABET;
        if (digit < alphabet.length) {
            return alphabet[digit];
        }
        return "<" + digit + ">";
    }

    function toBase(n, base) {
        base = bigInt(base);
        if (base.isZero()) {
            if (n.isZero()) return { value: [0], isNegative: false };
            throw new Error("Cannot convert nonzero numbers to base 0.");
        }
        if (base.equals(-1)) {
            if (n.isZero()) return { value: [0], isNegative: false };
            if (n.isNegative())
                return {
                    value: [].concat.apply([], Array.apply(null, Array(-n.toJSNumber()))
                        .map(Array.prototype.valueOf, [1, 0])
                    ),
                    isNegative: false
                };

            var arr = Array.apply(null, Array(n.toJSNumber() - 1))
                .map(Array.prototype.valueOf, [0, 1]);
            arr.unshift([1]);
            return {
                value: [].concat.apply([], arr),
                isNegative: false
            };
        }

        var neg = false;
        if (n.isNegative() && base.isPositive()) {
            neg = true;
            n = n.abs();
        }
        if (base.isUnit()) {
            if (n.isZero()) return { value: [0], isNegative: false };

            return {
                value: Array.apply(null, Array(n.toJSNumber()))
                    .map(Number.prototype.valueOf, 1),
                isNegative: neg
            };
        }
        var out = [];
        var left = n, divmod;
        while (left.isNegative() || left.compareAbs(base) >= 0) {
            divmod = left.divmod(base);
            left = divmod.quotient;
            var digit = divmod.remainder;
            if (digit.isNegative()) {
                digit = base.minus(digit).abs();
                left = left.next();
            }
            out.push(digit.toJSNumber());
        }
        out.push(left.toJSNumber());
        return { value: out.reverse(), isNegative: neg };
    }

    function toBaseString(n, base, alphabet) {
        var arr = toBase(n, base);
        return (arr.isNegative ? "-" : "") + arr.value.map(function (x) {
            return stringify(x, alphabet);
        }).join('');
    }

    BigInteger.prototype.toArray = function (radix) {
        return toBase(this, radix);
    };

    SmallInteger.prototype.toArray = function (radix) {
        return toBase(this, radix);
    };

    NativeBigInt.prototype.toArray = function (radix) {
        return toBase(this, radix);
    };

    BigInteger.prototype.toString = function (radix, alphabet) {
        if (radix === undefined) radix = 10;
        if (radix !== 10) return toBaseString(this, radix, alphabet);
        var v = this.value, l = v.length, str = String(v[--l]), zeros = "0000000", digit;
        while (--l >= 0) {
            digit = String(v[l]);
            str += zeros.slice(digit.length) + digit;
        }
        var sign = this.sign ? "-" : "";
        return sign + str;
    };

    SmallInteger.prototype.toString = function (radix, alphabet) {
        if (radix === undefined) radix = 10;
        if (radix != 10) return toBaseString(this, radix, alphabet);
        return String(this.value);
    };

    NativeBigInt.prototype.toString = SmallInteger.prototype.toString;

    NativeBigInt.prototype.toJSON = BigInteger.prototype.toJSON = SmallInteger.prototype.toJSON = function () { return this.toString(); }

    BigInteger.prototype.valueOf = function () {
        return parseInt(this.toString(), 10);
    };
    BigInteger.prototype.toJSNumber = BigInteger.prototype.valueOf;

    SmallInteger.prototype.valueOf = function () {
        return this.value;
    };
    SmallInteger.prototype.toJSNumber = SmallInteger.prototype.valueOf;
    NativeBigInt.prototype.valueOf = NativeBigInt.prototype.toJSNumber = function () {
        return parseInt(this.toString(), 10);
    }

    function parseStringValue(v) {
        if (isPrecise(+v)) {
            var x = +v;
            if (x === truncate(x))
                return supportsNativeBigInt ? new NativeBigInt(BigInt(x)) : new SmallInteger(x);
            throw new Error("Invalid integer: " + v);
        }
        var sign = v[0] === "-";
        if (sign) v = v.slice(1);
        var split = v.split(/e/i);
        if (split.length > 2) throw new Error("Invalid integer: " + split.join("e"));
        if (split.length === 2) {
            var exp = split[1];
            if (exp[0] === "+") exp = exp.slice(1);
            exp = +exp;
            if (exp !== truncate(exp) || !isPrecise(exp)) throw new Error("Invalid integer: " + exp + " is not a valid exponent.");
            var text = split[0];
            var decimalPlace = text.indexOf(".");
            if (decimalPlace >= 0) {
                exp -= text.length - decimalPlace - 1;
                text = text.slice(0, decimalPlace) + text.slice(decimalPlace + 1);
            }
            if (exp < 0) throw new Error("Cannot include negative exponent part for integers");
            text += (new Array(exp + 1)).join("0");
            v = text;
        }
        var isValid = /^([0-9][0-9]*)$/.test(v);
        if (!isValid) throw new Error("Invalid integer: " + v);
        if (supportsNativeBigInt) {
            return new NativeBigInt(BigInt(sign ? "-" + v : v));
        }
        var r = [], max = v.length, l = LOG_BASE, min = max - l;
        while (max > 0) {
            r.push(+v.slice(min, max));
            min -= l;
            if (min < 0) min = 0;
            max -= l;
        }
        trim(r);
        return new BigInteger(r, sign);
    }

    function parseNumberValue(v) {
        if (supportsNativeBigInt) {
            return new NativeBigInt(BigInt(v));
        }
        if (isPrecise(v)) {
            if (v !== truncate(v)) throw new Error(v + " is not an integer.");
            return new SmallInteger(v);
        }
        return parseStringValue(v.toString());
    }

    function parseValue(v) {
        if (typeof v === "number") {
            return parseNumberValue(v);
        }
        if (typeof v === "string") {
            return parseStringValue(v);
        }
        if (typeof v === "bigint") {
            return new NativeBigInt(v);
        }
        return v;
    }
    // Pre-define numbers in range [-999,999]
    for (var i = 0; i < 1000; i++) {
        Integer[i] = parseValue(i);
        if (i > 0) Integer[-i] = parseValue(-i);
    }
    // Backwards compatibility
    Integer.one = Integer[1];
    Integer.zero = Integer[0];
    Integer.minusOne = Integer[-1];
    Integer.max = max;
    Integer.min = min;
    Integer.gcd = gcd;
    Integer.lcm = lcm;
    Integer.isInstance = function (x) { return x instanceof BigInteger || x instanceof SmallInteger || x instanceof NativeBigInt; };
    Integer.randBetween = randBetween;

    Integer.fromArray = function (digits, base, isNegative) {
        return parseBaseFromArray(digits.map(parseValue), parseValue(base || 10), isNegative);
    };

    return Integer;
})();

// Node.js check
if (typeof module !== "undefined" && module.hasOwnProperty("exports")) {
    module.exports = bigInt;
}

//amd check
if (typeof define === "function" && define.amd) {
    define("big-integer", [], function () {
        return bigInt;
    });
}

},{}],3:[function(require,module,exports){
/* globals WebAssembly */
const bigInt = require("big-integer");
const ModuleBuilder = require("./wasmbuilder/index.js");
const buildF1m = require("./build_f1m.js");
const buildF2m = require("./build_f2m.js");
const buildF1 = require("./build_f1.js");
const buildCurve = require("./build_curve.js");
const buildTest = require("./build_testg1");
const buildFFT = require("./build_fft");
const buildMultiexp = require("./build_multiexp");
const buildPol = require("./build_pol");
const utils = require("./utils");

async function build() {
    const bn128 = new Bn128();

    bn128.q = bigInt("21888242871839275222246405745257275088696311157297823662689037894645226208583");
    bn128.r = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    bn128.n64 = Math.floor((bn128.q.minus(1).bitLength() - 1)/64) +1;
    bn128.n32 = bn128.n64*2;
    bn128.n8 = bn128.n64*8;

    bn128.memory = new WebAssembly.Memory({initial:10000});
    bn128.i32 = new Uint32Array(bn128.memory.buffer);

    const moduleBuilder = new ModuleBuilder();
    moduleBuilder.setMemory(10000);
    buildF1m(moduleBuilder, bn128.q, "f1m");
    buildF1(moduleBuilder, bn128.r, "fr", "frm");
    buildCurve(moduleBuilder, "g1", "f1m");
    buildMultiexp(moduleBuilder, "g1", "g1", "f1m", "fr");
    buildFFT(moduleBuilder, "fft", "frm");
    buildPol(moduleBuilder, "pol", "frm");

    const pNonResidueF2 =  moduleBuilder.alloc(
        utils.bigInt2BytesLE(
            bigInt("15537367993719455909907449462855742678907882278146377936676643359958227611562"), // -1 in montgomery
            bn128.n8
        )
    );

    buildF2m(moduleBuilder, pNonResidueF2, "f2m", "f1m");
    buildCurve(moduleBuilder, "g2", "f2m");
    buildMultiexp(moduleBuilder, "g2", "g2", "f2m", "fr");

    buildTest(moduleBuilder);

    const code = moduleBuilder.build();

    const wasmModule = await WebAssembly.compile(code);

    bn128.instance = await WebAssembly.instantiate(wasmModule, {
        env: {
            "memory": bn128.memory
        }
    });

    bn128.pq = moduleBuilder.modules.f1m.pq;
    bn128.pr = moduleBuilder.modules.frm.pq;

    bn128.pg1 = bn128.g1_allocPoint([bigInt(1), bigInt(2), bigInt(1)]);

    Object.assign(bn128, bn128.instance.exports);

    return bn128;
}

class Bn128 {

    constructor() {

    }

    alloc(length) {
        while (this.i32[0] & 3) this.i32[0]++;  // Return always aligned pointers
        const res = this.i32[0];
        this.i32[0] += length;
        return res;
    }

    putInt(pos, _a) {
        const a = bigInt(_a);
        if (pos & 0x7) throw new Error("Pointer must be aligned");
        if (a.bitLength > this.n64*64) {
            return this.putInt(a.mod(this.q));
        }
        for (let i=0; i<this.n32; i++) {
            this.i32[(pos>>2)+i] = a.shiftRight(i*32).and(0xFFFFFFFF).toJSNumber();
        }
    }

    getInt(pos) {
        if (pos & 0x7) throw new Error("Pointer must be aligned");
        let acc = bigInt(this.i32[(pos>>2)+this.n32-1]);
        for (let i=this.n32-2; i>=0; i--) {
            acc = acc.shiftLeft(32);
            acc = acc.add(this.i32[(pos>>2)+i]);
        }
        return acc;
    }

    allocInt(_a) {
        const p = this.alloc(this.n8);
        if (_a) this.putInt(p, _a);
        return p;
    }

    putIntF2(pos, a) {
        this.putInt(pos, a[0]);
        this.putInt(pos+this.n8, a[1]);
    }

    getIntF2(pos) {
        const p = Array(2);
        p[0] = this.getInt(pos);
        p[1] = this.getInt(pos+this.n8);
        return p;
    }

    allocIntF2(a) {
        const pP = this.alloc(this.n8*2);
        if (a) {
            this.putIntF2(pP, a);
        }
        return pP;
    }

    g1_putPoint(pos, p) {
        this.putInt(pos, p[0]);
        this.putInt(pos+this.n8, p[1]);
        if (p.length == 3) {
            this.putInt(pos+this.n8*2, p[2]);
        } else {
            this.putInt(pos+this.n8*2, 1);
        }
    }

    g1_getPoint(pos) {
        const p = Array(3);
        p[0] = this.getInt(pos);
        p[1] = this.getInt(pos+this.n8);
        p[2] = this.getInt(pos+this.n8*2);
        return p;
    }

    g1_allocPoint(p) {
        const pP = this.alloc(this.n8*3);
        if (p) {
            this.g1_putPoint(pP, p);
        }
        return pP;
    }


    g2_putPoint(pos, p) {
        this.putIntF2(pos, p[0]);
        this.putIntF2(pos+this.n8*2, p[1]);
        if (p.length == 3) {
            this.putIntF2(pos+this.n8*4, p[2]);
        } else {
            this.putIntF2(pos+this.n8*4, 1);
        }
    }

    g2_getPoint(pos) {
        const p = Array(3);
        p[0] = this.getIntF2(pos);
        p[1] = this.getIntF2(pos+this.n8*2);
        p[2] = this.getIntF2(pos+this.n8*4);
        return p;
    }

    g2_allocPoint(p) {
        const pP = this.alloc(this.n8*6);
        if (p) {
            this.g2_putPoint(pP, p);
        }
        return pP;
    }

    putBin(b) {
        const p = this.alloc(b.byteLength);
        const s32 = new Uint32Array(b);
        this.i32.set(s32, p/4);
        return p;
    }

    test_AddG1(n) {
        const start = new Date().getTime();

        const pg = this.g1_allocPoint([bigInt(1), bigInt(2), bigInt(1)]);
        this.g1_toMontgomery(pg,pg);
        const p2 = this.g1_allocPoint();
        this.instance.exports.testAddG1(n, pg, p2);
        this.g1_fromMontgomery(p2,p2);

        const end = new Date().getTime();
        const time = end - start;

        return time;
    }

    test_fft(n) {

        const N=n;

        const p = this.i32[0];
        for (let i=0; i<N; i++) {
            this.putInt(p+i*32, i);
        }

        const start = new Date().getTime();
        this.fft_ifft(p, N);
        const end = new Date().getTime();
        const time = end - start;

        return time;
    }

}

module.exports = build;

},{"./build_curve.js":4,"./build_f1.js":5,"./build_f1m.js":6,"./build_f2m.js":7,"./build_fft":8,"./build_multiexp":10,"./build_pol":11,"./build_testg1":13,"./utils":17,"./wasmbuilder/index.js":20,"big-integer":2}],4:[function(require,module,exports){

const buildTimesScalar = require("./build_timesscalar");

module.exports = function buildCurve(module, prefix, prefixField) {


    const n64 = module.modules[prefixField].n64;
    const n8 = n64*8;

    if (module.modules[prefix]) return prefix;  // already builded
    module.modules[prefix] = {
        n64: n64*3
    };

    function buildIsZero() {
        const f = module.addFunction(prefix + "_isZero");
        f.addParam("p1", "i32");
        f.setReturnType("i32");

        const c = f.getCodeBuilder();

        f.addCode(c.call(
            prefixField + "_isZero",
            c.i32_add(
                c.getLocal("p1"),
                c.i32_const(n8*2)
            )
        ));
    }

    function buildCopy() {
        const f = module.addFunction(prefix + "_copy");
        f.addParam("p1", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        f.addCode(c.call(
            prefixField + "_copy",
            c.getLocal("p1"),
            c.getLocal("pr")
        ));

        f.addCode(c.call(
            prefixField + "_copy",
            c.i32_add(
                c.getLocal("p1"),
                c.i32_const(n8)
            ),
            c.i32_add(
                c.getLocal("pr"),
                c.i32_const(n8)
            )
        ));

        f.addCode(c.call(
            prefixField + "_copy",
            c.i32_add(
                c.getLocal("p1"),
                c.i32_const(n8*2)
            ),
            c.i32_add(
                c.getLocal("pr"),
                c.i32_const(n8*2)
            )
        ));
    }

    function buildZero() {
        const f = module.addFunction(prefix + "_zero");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        f.addCode(c.call(
            prefixField + "_zero",
            c.getLocal("pr")
        ));

        f.addCode(c.call(
            prefixField + "_one",
            c.i32_add(
                c.getLocal("pr"),
                c.i32_const(n8)
            )
        ));

        f.addCode(c.call(
            prefixField + "_zero",
            c.i32_add(
                c.getLocal("pr"),
                c.i32_const(n8*2)
            )
        ));
    }

    function buildDouble() {
        const f = module.addFunction(prefix + "_double");
        f.addParam("p1", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        const x = c.getLocal("p1");
        const y = c.i32_add(c.getLocal("p1"), c.i32_const(n8));
        const z = c.i32_add(c.getLocal("p1"), c.i32_const(n8*2));
        const x3 = c.getLocal("pr");
        const y3 = c.i32_add(c.getLocal("pr"), c.i32_const(n8));
        const z3 = c.i32_add(c.getLocal("pr"), c.i32_const(n8*2));

        const A = c.i32_const(module.alloc(n8));
        const B = c.i32_const(module.alloc(n8));
        const C = c.i32_const(module.alloc(n8));
        const D = c.i32_const(module.alloc(n8));
        const E = c.i32_const(module.alloc(n8));
        const F = c.i32_const(module.alloc(n8));
        const G = c.i32_const(module.alloc(n8));
        const eightC = c.i32_const(module.alloc(n8));

        f.addCode(
            c.if(
                c.call(prefix + "_isZero", c.getLocal("p1")),
                [
                    ...c.call(prefix + "_copy", c.getLocal("p1"), c.getLocal("pr")),
                    ...c.ret([])
                ]
            ),

            c.call(prefixField + "_mul", x, x, A),
            c.call(prefixField + "_mul", y, y, B),
            c.call(prefixField + "_mul", B, B, C),

            c.call(prefixField + "_add", x, B, D),
            c.call(prefixField + "_mul", D, D, D),
            c.call(prefixField + "_sub", D, A, D),
            c.call(prefixField + "_sub", D, C, D),
            c.call(prefixField + "_add", D, D, D),

            c.call(prefixField + "_add", A, A, E),
            c.call(prefixField + "_add", E, A, E),
            c.call(prefixField + "_mul", E, E, F),

            c.call(prefixField + "_mul", y, z, G),

            c.call(prefixField + "_add", D, D, x3),
            c.call(prefixField + "_sub", F, x3, x3),

            c.call(prefixField + "_add", C, C, eightC),
            c.call(prefixField + "_add", eightC, eightC, eightC),
            c.call(prefixField + "_add", eightC, eightC, eightC),

            c.call(prefixField + "_sub", D, x3, y3),
            c.call(prefixField + "_mul", y3, E, y3),
            c.call(prefixField + "_sub", y3, eightC, y3),

            c.call(prefixField + "_add", G, G, z3),
        );
    }

    function buildToMontgomery() {
        const f = module.addFunction(prefix + "_toMontgomery");
        f.addParam("p1", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        f.addCode(c.call(
            prefixField + "_toMontgomery",
            c.getLocal("p1"),
            c.getLocal("pr")
        ));
        for (let i=1; i<3; i++) {
            f.addCode(c.call(
                prefixField + "_toMontgomery",
                c.i32_add(c.getLocal("p1"), c.i32_const(i*n8)),
                c.i32_add(c.getLocal("pr"), c.i32_const(i*n8))
            ));
        }
    }

    function buildFromMontgomery() {
        const f = module.addFunction(prefix + "_fromMontgomery");
        f.addParam("p1", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        f.addCode(c.call(
            prefixField + "_fromMontgomery",
            c.getLocal("p1"),
            c.getLocal("pr")
        ));
        for (let i=1; i<3; i++) {
            f.addCode(c.call(
                prefixField + "_fromMontgomery",
                c.i32_add(c.getLocal("p1"), c.i32_const(i*n8)),
                c.i32_add(c.getLocal("pr"), c.i32_const(i*n8))
            ));
        }
    }


    function buildAdd() {

        const f = module.addFunction(prefix + "_add");
        f.addParam("p1", "i32");
        f.addParam("p2", "i32");
        f.addParam("pr", "i32");
        f.addLocal("z1", "i32");
        f.addLocal("z2", "i32");

        const c = f.getCodeBuilder();

        const x1 = c.getLocal("p1");
        const y1 = c.i32_add(c.getLocal("p1"), c.i32_const(n8));
        f.addCode(c.setLocal("z1", c.i32_add(c.getLocal("p1"), c.i32_const(n8*2))));
        const z1 = c.getLocal("z1");
        const x2 = c.getLocal("p2");
        const y2 = c.i32_add(c.getLocal("p2"), c.i32_const(n8));
        f.addCode(c.setLocal("z2", c.i32_add(c.getLocal("p2"), c.i32_const(n8*2))));
        const z2 = c.getLocal("z2");
        const x3 = c.getLocal("pr");
        const y3 = c.i32_add(c.getLocal("pr"), c.i32_const(n8));
        const z3 = c.i32_add(c.getLocal("pr"), c.i32_const(n8*2));

        const Z1Z1 = c.i32_const(module.alloc(n8));
        const Z2Z2 = c.i32_const(module.alloc(n8));
        const U1 = c.i32_const(module.alloc(n8));
        const U2 = c.i32_const(module.alloc(n8));
        const Z1_cubed = c.i32_const(module.alloc(n8));
        const Z2_cubed = c.i32_const(module.alloc(n8));
        const S1 = c.i32_const(module.alloc(n8));
        const S2 = c.i32_const(module.alloc(n8));
        const H = c.i32_const(module.alloc(n8));
        const S2_minus_S1 = c.i32_const(module.alloc(n8));
        const I = c.i32_const(module.alloc(n8));
        const J = c.i32_const(module.alloc(n8));
        const r = c.i32_const(module.alloc(n8));
        const r2 = c.i32_const(module.alloc(n8));
        const V = c.i32_const(module.alloc(n8));
        const V2 = c.i32_const(module.alloc(n8));
        const S1_J2 = c.i32_const(module.alloc(n8));

        f.addCode(
            c.if(
                c.call(prefix + "_isZero", c.getLocal("p1")),
                [
                    ...c.call(prefix + "_copy", c.getLocal("p2"), c.getLocal("pr")),
                    ...c.ret([])
                ]
            ),

            c.if(
                c.call(prefix + "_isZero", c.getLocal("p2")),
                [
                    ...c.call(prefix + "_copy", c.getLocal("p1"), c.getLocal("pr")),
                    ...c.ret([])
                ]
            ),

            c.call(prefixField + "_mul", z1, z1, Z1Z1),
            c.call(prefixField + "_mul", z2, z2, Z2Z2),
            c.call(prefixField + "_mul", x1, Z2Z2, U1),
            c.call(prefixField + "_mul", x2, Z1Z1, U2),
            c.call(prefixField + "_mul", z1, Z1Z1, Z1_cubed),
            c.call(prefixField + "_mul", z2, Z2Z2, Z2_cubed),
            c.call(prefixField + "_mul", y1, Z2_cubed, S1),
            c.call(prefixField + "_mul", y2, Z1_cubed, S2),

            c.if(
                c.call(prefixField + "_eq", U1, U2),
                c.if(
                    c.call(prefixField + "_eq", S1, S2),
                    [
                        ...c.call(prefix + "_double", c.getLocal("p1"), c.getLocal("pr")),
                        ...c.ret([])
                    ]
                )
            ),

            c.call(prefixField + "_sub", U2, U1, H),
            c.call(prefixField + "_sub", S2, S1, S2_minus_S1),
            c.call(prefixField + "_add", H, H, I),
            c.call(prefixField + "_mul", I, I, I),
            c.call(prefixField + "_mul", H, I, J),
            c.call(prefixField + "_add", S2_minus_S1, S2_minus_S1, r),
            c.call(prefixField + "_mul", U1, I, V),
            c.call(prefixField + "_mul", r, r, r2),
            c.call(prefixField + "_add", V, V, V2),

            c.call(prefixField + "_sub", r2, J, x3),
            c.call(prefixField + "_sub", x3, V2, x3),

            c.call(prefixField + "_mul", S1, J, S1_J2),
            c.call(prefixField + "_add", S1_J2, S1_J2, S1_J2),

            c.call(prefixField + "_sub", V, x3, y3),
            c.call(prefixField + "_mul", y3, r, y3),
            c.call(prefixField + "_sub", y3, S1_J2, y3),

            c.call(prefixField + "_add", z1, z2, z3),
            c.call(prefixField + "_mul", z3, z3, z3),
            c.call(prefixField + "_sub", z3, Z1Z1, z3),
            c.call(prefixField + "_sub", z3, Z2Z2, z3),
            c.call(prefixField + "_mul", z3, H, z3),
        );

    }

    function buildNeg() {
        const f = module.addFunction(prefix + "_neg");
        f.addParam("p1", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        const x = c.getLocal("p1");
        const y = c.i32_add(c.getLocal("p1"), c.i32_const(n8));
        const z = c.i32_add(c.getLocal("p1"), c.i32_const(n8*2));
        const x3 = c.getLocal("pr");
        const y3 = c.i32_add(c.getLocal("pr"), c.i32_const(n8));
        const z3 = c.i32_add(c.getLocal("pr"), c.i32_const(n8*2));

        f.addCode(
            c.call(prefixField + "_copy", x, x3),
            c.call(prefixField + "_neg", y, y3),
            c.call(prefixField + "_copy", z, z3)
        );
    }

    function buildSub() {
        const f = module.addFunction(prefix + "_sub");
        f.addParam("p1", "i32");
        f.addParam("p2", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.call(prefix + "_neg", c.getLocal("p2"), c.getLocal("pr")),
            c.call(prefix + "_add", c.getLocal("p1"), c.getLocal("pr"), c.getLocal("pr")),
        );
    }


    function buildAffine() {
        const f = module.addFunction(prefix + "_affine");
        f.addParam("p1", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        const x = c.getLocal("p1");
        const y = c.i32_add(c.getLocal("p1"), c.i32_const(n8));
        const z = c.i32_add(c.getLocal("p1"), c.i32_const(n8*2));
        const x3 = c.getLocal("pr");
        const y3 = c.i32_add(c.getLocal("pr"), c.i32_const(n8));
        const z3 = c.i32_add(c.getLocal("pr"), c.i32_const(n8*2));


        const Z_inv = c.i32_const(module.alloc(n8));
        const Z2_inv = c.i32_const(module.alloc(n8));
        const Z3_inv = c.i32_const(module.alloc(n8));

        f.addCode(
            c.if(
                c.call(prefix + "_isZero", c.getLocal("p1")),
                c.call(prefix + "_zero", c.getLocal("pr")),
                [
                    ...c.call(prefixField + "_inverse", z, Z_inv),
                    ...c.call(prefixField + "_mul", Z_inv, Z_inv, Z2_inv),
                    ...c.call(prefixField + "_mul", Z_inv, Z2_inv, Z3_inv),
                    ...c.call(prefixField + "_mul", x, Z2_inv, x3),
                    ...c.call(prefixField + "_mul", y, Z3_inv, y3),
                    ...c.call(prefixField + "_one", z3)
                ]
            )
        );
    }


    buildIsZero();
    buildZero();
    buildCopy();
    buildDouble();
    buildAdd();
    buildNeg();
    buildSub();
    buildFromMontgomery();
    buildToMontgomery();
    buildAffine();
    buildTimesScalar(
        module,
        prefix + "_timesScalar",
        n8*3,
        prefix + "_add",
        prefix + "_double",
        prefix
    );
    module.exportFunction(prefix + "_isZero");
    module.exportFunction(prefix + "_copy");
    module.exportFunction(prefix + "_zero");
    module.exportFunction(prefix + "_double");
    module.exportFunction(prefix + "_add");
    module.exportFunction(prefix + "_neg");
    module.exportFunction(prefix + "_sub");
    module.exportFunction(prefix + "_fromMontgomery");
    module.exportFunction(prefix + "_toMontgomery");
    module.exportFunction(prefix + "_affine");
    module.exportFunction(prefix + "_timesScalar");

    /*
    buildG1MulScalar(module, zq);
    module.exportFunction("g1MulScalar");
    */

    return prefix;
};

},{"./build_timesscalar":14}],5:[function(require,module,exports){

const bigInt = require("big-integer");

const buildF1m =require("./build_f1m.js");

module.exports = function buildF1(module, _q, _prefix, _f1mPrefix, _intPrefix) {

    const q = bigInt(_q);
    const n64 = Math.floor((q.minus(1).bitLength() - 1)/64) +1;
    const n8 = n64*8;

    const prefix = _prefix || "f1";
    if (module.modules[prefix]) return prefix;  // already builded
    module.modules[prefix] = {
        n64: n64
    };

    const intPrefix = _intPrefix || "int";
    const f1mPrefix = buildF1m(module, q, _f1mPrefix, intPrefix);


    const pR2 =     module.modules[f1mPrefix].pR2;
    const pq =     module.modules[f1mPrefix].pq;

    function buildMul() {
        const pAux1 = module.alloc(n8);

        const f = module.addFunction(prefix+ "_mul");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();
        f.addCode(c.call(f1mPrefix + "_mul", c.getLocal("x"), c.getLocal("y"), c.i32_const(pAux1)));
        f.addCode(c.call(f1mPrefix + "_mul", c.i32_const(pAux1), c.i32_const(pR2), c.getLocal("r")));
    }

    function buildInverse() {

        const f = module.addFunction(prefix+ "_inverse");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();
        f.addCode(c.call(intPrefix + "_inverseMod", c.getLocal("x"), c.i32_const(pq), c.getLocal("r")));
    }

    buildMul();
    buildInverse();
    module.exportFunction(f1mPrefix + "_add", prefix + "_add");
    module.exportFunction(f1mPrefix + "_sub", prefix + "_sub");
    module.exportFunction(f1mPrefix + "_neg", prefix + "_neg");
    module.exportFunction(prefix + "_mul");
    module.exportFunction(prefix + "_inverse");
    module.exportFunction(f1mPrefix + "_copy", prefix+"_copy");
    module.exportFunction(f1mPrefix + "_zero", prefix+"_zero");
    module.exportFunction(f1mPrefix + "_one", prefix+"_one");
    module.exportFunction(f1mPrefix + "_isZero", prefix+"_isZero");
    module.exportFunction(f1mPrefix + "_eq", prefix+"_eq");

    return prefix;
};

},{"./build_f1m.js":6,"big-integer":2}],6:[function(require,module,exports){
const bigInt = require("big-integer");
const buildInt = require("./build_int.js");
const utils = require("./utils.js");

module.exports = function buildF1m(module, _q, _prefix, _intPrefix) {
    const q = bigInt(_q);
    const n64 = Math.floor((q.minus(1).bitLength() - 1)/64) +1;
    const n32 = n64*2;
    const n8 = n64*8;

    const prefix = _prefix || "f1m";
    if (module.modules[prefix]) return prefix;  // already builded

    const intPrefix = buildInt(module, n64, _intPrefix);
    const pq = module.alloc(n8, utils.bigInt2BytesLE(q, n8));

    const pR2 = module.alloc(utils.bigInt2BytesLE(bigInt.one.shiftLeft(n64*64).square().mod(q), n8));
    const pOne = module.alloc(utils.bigInt2BytesLE(bigInt.one.shiftLeft(n64*64).mod(q), n8));
    const pZero = module.alloc(utils.bigInt2BytesLE(bigInt.zero, n8));
    module.modules[prefix] = {
        pq: pq,
        pR2: pR2,
        n64: n64,
        q: q,
        pOne: pOne,
        pZero: pZero
    };

    function buildOne() {
        const f = module.addFunction(prefix+"_one");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        f.addCode(c.call(prefix + "_copy", c.i32_const(pOne), c.getLocal("pr")));
    }

    function buildAdd() {
        const f = module.addFunction(prefix+"_add");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.if(
                c.call(intPrefix+"_add", c.getLocal("x"),  c.getLocal("y"), c.getLocal("r")),
                c.drop(c.call(intPrefix+"_sub", c.getLocal("r"), c.i32_const(pq), c.getLocal("r"))),
                c.if(
                    c.call(intPrefix+"_gte", c.getLocal("r"), c.i32_const(pq)  ),
                    c.drop(c.call(intPrefix+"_sub", c.getLocal("r"), c.i32_const(pq), c.getLocal("r"))),
                )
            )
        );
    }

    function buildSub() {
        const f = module.addFunction(prefix+"_sub");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.if(
                c.call(intPrefix+"_sub", c.getLocal("x"),  c.getLocal("y"), c.getLocal("r")),
                c.drop(c.call(intPrefix+"_add", c.getLocal("r"),  c.i32_const(pq), c.getLocal("r")))
            )
        );
    }

    function buildNeg() {
        const f = module.addFunction(prefix+"_neg");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.if(
                c.i32_eqz( c.call(intPrefix + "_isZero", c.getLocal("x"))),
                c.drop(c.call(intPrefix+"_sub", c.i32_const(pq),  c.getLocal("x"), c.getLocal("r"))),
            )
        );
    }


    function buildMReduct() {
        const carries = module.alloc(n32*n32*8);

        const f = module.addFunction(prefix+"_mReduct");
        f.addParam("t", "i32");
        f.addParam("r", "i32");
        f.addLocal("np32", "i64");
        f.addLocal("c", "i64");
        f.addLocal("m", "i64");

        const c = f.getCodeBuilder();

        const np32 = bigInt("100000000",16).minus( q.modInv(bigInt("100000000",16))).toJSNumber();

        f.addCode(c.setLocal("np32", c.i64_const(np32)));

        for (let i=0; i<n32; i++) {
            f.addCode(c.setLocal("c", c.i64_const(0)));

            f.addCode(
                c.setLocal(
                    "m",
                    c.i64_and(
                        c.i64_mul(
                            c.i64_load32_u(c.getLocal("t"), i*4),
                            c.getLocal("np32")
                        ),
                        c.i64_const("0xFFFFFFFF")
                    )
                )
            );

            for (let j=0; j<n32; j++) {

                f.addCode(
                    c.setLocal("c",
                        c.i64_add(
                            c.i64_add(
                                c.i64_load32_u(c.getLocal("t"), (i+j)*4),
                                c.i64_shr_u(c.getLocal("c"), c.i64_const(32))
                            ),
                            c.i64_mul(
                                c.i64_load32_u(c.i32_const(pq), j*4),
                                c.getLocal("m")
                            )
                        )
                    )
                );

                f.addCode(
                    c.i64_store32(
                        c.getLocal("t"),
                        (i+j)*4,
                        c.getLocal("c")
                    )
                );
            }

            f.addCode(
                c.i64_store32(
                    c.i32_const(carries),
                    i*4,
                    c.i64_shr_u(c.getLocal("c"), c.i64_const(32))
                )
            );
        }

        f.addCode(
            c.call(
                prefix+"_add",
                c.i32_const(carries),
                c.i32_add(
                    c.getLocal("t"),
                    c.i32_const(n32*4)
                ),
                c.getLocal("r")
            )
        );
    }


    function buildMul() {

        const pAux2 = module.alloc(n8*2);

        const f = module.addFunction(prefix+"_mul");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();
        f.addCode(c.call(intPrefix + "_mul", c.getLocal("x"), c.getLocal("y"), c.i32_const(pAux2) ));
        f.addCode(c.call(prefix + "_mReduct", c.i32_const(pAux2), c.getLocal("r")));
    }


    function buildToMontgomery() {
        const f = module.addFunction(prefix+"_toMontgomery");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();
        f.addCode(c.call(prefix+"_mul", c.getLocal("x"), c.i32_const(pR2), c.getLocal("r")));
    }

    function buildFromMontgomery() {

        const pAux2 = module.alloc(n8*2);

        const f = module.addFunction(prefix+"_fromMontgomery");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();
        f.addCode(c.call(intPrefix + "_copy", c.getLocal("x"), c.i32_const(pAux2) ));
        f.addCode(c.call(intPrefix + "_zero", c.i32_const(pAux2 + n8) ));
        f.addCode(c.call(prefix+"_mReduct", c.i32_const(pAux2), c.getLocal("r")));
    }

    function buildInverse() {

        const f = module.addFunction(prefix+ "_inverse");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();
        f.addCode(c.call(prefix + "_fromMontgomery", c.getLocal("x"), c.getLocal("r")));
        f.addCode(c.call(intPrefix + "_inverseMod", c.getLocal("r"), c.i32_const(pq), c.getLocal("r")));
        f.addCode(c.call(prefix + "_toMontgomery", c.getLocal("r"), c.getLocal("r")));
    }

    buildAdd();
    buildSub();
    buildNeg();
    buildMReduct();
    buildMul();
    buildToMontgomery();
    buildFromMontgomery();
    buildInverse();
    module.exportFunction(prefix + "_add");
    module.exportFunction(prefix + "_sub");
    module.exportFunction(prefix + "_neg");
    module.exportFunction(prefix + "_mReduct");
    module.exportFunction(prefix + "_mul");
    module.exportFunction(prefix + "_fromMontgomery");
    module.exportFunction(prefix + "_toMontgomery");
    module.exportFunction(prefix + "_inverse");
    module.exportFunction(intPrefix + "_copy", prefix+"_copy");
    module.exportFunction(intPrefix + "_zero", prefix+"_zero");
    module.exportFunction(intPrefix + "_isZero", prefix+"_isZero");
    module.exportFunction(intPrefix + "_eq", prefix+"_eq");
    buildOne();
    module.exportFunction(prefix + "_one");

    return prefix;
};

},{"./build_int.js":9,"./utils.js":17,"big-integer":2}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
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

},{"./utils.js":17,"big-integer":2}],9:[function(require,module,exports){

const utils = require("./utils.js");

module.exports = function buildInt(module, n64, _prefix) {

    const prefix = _prefix || "int";
    if (module.modules[prefix]) return prefix;  // already builded
    module.modules[prefix] = {};

    const n32 = n64*2;
    const n8 = n64*8;

    const one = module.alloc(n8, utils.bigInt2BytesLE(1, n8));

    function buildCopy() {
        const f = module.addFunction(prefix+"_copy");
        f.addParam("px", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        for (let i=0; i<n64; i++) {
            f.addCode(
                c.i64_store(
                    c.getLocal("pr"),
                    i*8,
                    c.i64_load(
                        c.getLocal("px"),
                        i*8
                    )
                )
            );
        }
    }

    function buildZero() {
        const f = module.addFunction(prefix+"_zero");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        for (let i=0; i<n64; i++) {
            f.addCode(
                c.i64_store(
                    c.getLocal("pr"),
                    i*8,
                    c.i64_const(0)
                )
            );
        }
    }

    function buildOne() {
        const f = module.addFunction(prefix+"_one");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.i64_store(
                c.getLocal("pr"),
                0,
                c.i64_const(1)
            )
        );
        for (let i=1; i<n64; i++) {
            f.addCode(
                c.i64_store(
                    c.getLocal("pr"),
                    i*8,
                    c.i64_const(0)
                )
            );
        }
    }

    function buildIsZero() {
        const f = module.addFunction(prefix+"_isZero");
        f.addParam("px", "i32");
        f.setReturnType("i32");

        const c = f.getCodeBuilder();

        function getCompCode(n) {
            if (n==0) {
                return  c.ret(c.i64_eqz(
                    c.i64_load(c.getLocal("px"))
                ));
            }
            return c.if(
                c.i64_eqz(
                    c.i64_load(c.getLocal("px"), n*8 )
                ),
                getCompCode(n-1),
                c.ret(c.i32_const(0))
            );
        }

        f.addCode(getCompCode(n64-1));
        f.addCode(c.ret(c.i32_const(0)));
    }

    function buildEq() {
        const f = module.addFunction(prefix+"_eq");
        f.addParam("px", "i32");
        f.addParam("py", "i32");
        f.setReturnType("i32");

        const c = f.getCodeBuilder();

        function getCompCode(n) {
            if (n==0) {
                return  c.ret(c.i64_eq(
                    c.i64_load(c.getLocal("px")),
                    c.i64_load(c.getLocal("py"))
                ));
            }
            return c.if(
                c.i64_eq(
                    c.i64_load(c.getLocal("px"), n*8 ),
                    c.i64_load(c.getLocal("py"), n*8 )
                ),
                getCompCode(n-1),
                c.ret(c.i32_const(0))
            );
        }

        f.addCode(getCompCode(n64-1));
        f.addCode(c.ret(c.i32_const(0)));
    }



    function buildGte() {
        const f = module.addFunction(prefix+"_gte");
        f.addParam("px", "i32");
        f.addParam("py", "i32");
        f.setReturnType("i32");

        const c = f.getCodeBuilder();

        function getCompCode(n) {
            if (n==0) {
                return  c.ret(c.i64_ge_u(
                    c.i64_load(c.getLocal("px")),
                    c.i64_load(c.getLocal("py"))
                ));
            }
            return c.if(
                c.i64_lt_u(
                    c.i64_load(c.getLocal("px"), n*8 ),
                    c.i64_load(c.getLocal("py"), n*8 )
                ),
                c.ret(c.i32_const(0)),
                c.if(
                    c.i64_gt_u(
                        c.i64_load(c.getLocal("px"), n*8 ),
                        c.i64_load(c.getLocal("py"), n*8 )
                    ),
                    c.ret(c.i32_const(1)),
                    getCompCode(n-1)
                )
            );
        }

        f.addCode(getCompCode(n64-1));
        f.addCode(c.ret(c.i32_const(0)));
    }



    function buildAdd() {

        const f = module.addFunction(prefix+"_add");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.addParam("r", "i32");
        f.setReturnType("i32");
        f.addLocal("c", "i64");

        const c = f.getCodeBuilder();

        f.addCode(c.setLocal(
            "c",
            c.i64_add(
                c.i64_load32_u(c.getLocal("x")),
                c.i64_load32_u(c.getLocal("y"))
            )
        ));

        f.addCode(c.i64_store32(
            c.getLocal("r"),
            c.getLocal("c"),
        ));

        for (let i=1; i<n32; i++) {
            f.addCode(c.setLocal( "c",
                c.i64_add(
                    c.i64_add(
                        c.i64_load32_u(c.getLocal("x"), 4*i),
                        c.i64_load32_u(c.getLocal("y"), 4*i)
                    ),
                    c.i64_shr_u (c.getLocal("c"), c.i64_const(32))
                )
            ));

            f.addCode(c.i64_store32(
                c.getLocal("r"),
                i*4,
                c.getLocal("c")
            ));
        }

        f.addCode(c.i32_wrap_i64(c.i64_shr_u (c.getLocal("c"), c.i64_const(32))));
    }


    function buildSub() {

        const f = module.addFunction(prefix+"_sub");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.addParam("r", "i32");
        f.setReturnType("i32");
        f.addLocal("c", "i64");

        const c = f.getCodeBuilder();

        f.addCode(c.setLocal(
            "c",
            c.i64_sub(
                c.i64_load32_u(c.getLocal("x")),
                c.i64_load32_u(c.getLocal("y"))
            )
        ));

        f.addCode(c.i64_store32(
            c.getLocal("r"),
            c.i64_and(
                c.getLocal("c"),
                c.i64_const("0xFFFFFFFF")
            )
        ));

        for (let i=1; i<n32; i++) {
            f.addCode(c.setLocal( "c",
                c.i64_add(
                    c.i64_sub(
                        c.i64_load32_u(c.getLocal("x"), 4*i),
                        c.i64_load32_u(c.getLocal("y"), 4*i)
                    ),
                    c.i64_shr_s (c.getLocal("c"), c.i64_const(32))
                )
            ));

            f.addCode(c.i64_store32(
                c.getLocal("r"),
                i*4,
                c.i64_and( c.getLocal("c"), c.i64_const("0xFFFFFFFF"))
            ));
        }

        f.addCode(c.i32_wrap_i64 ( c.i64_shr_s (c.getLocal("c"), c.i64_const(32))));
    }


    function buildMul() {

        const mulBuff = module.alloc(n32*n32*8);

        const f = module.addFunction(prefix+"_mul");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.addParam("r", "i32");
        f.addLocal("c", "i64");

        const c = f.getCodeBuilder();

        for (let i=0; i<n32; i++) {
            for (let j=0; j<n32; j++) {
                f.addCode(c.i64_store(
                    c.i32_const(mulBuff),
                    (i*n32+j)*8,
                    c.i64_mul(
                        c.i64_load32_u( c.getLocal("x"), i*4),
                        c.i64_load32_u( c.getLocal("y"), j*4)
                    )
                ));
            }
        }

        for (let i=0; i<n32; i++) {
            f.addCode(c.i64_shr_u(c.getLocal("c"), c.i64_const(32)));
            for (let j=0; j<i; j++) {
                f.addCode(c.i64_add(
                    [],
                    c.i64_load32_u(
                        c.i32_const(mulBuff),
                        j*(n32*8) + i*8-4 - j*8
                    )
                ));
            }
            for (let j=0; j<i+1; j++) {
                f.addCode(c.i64_add(
                    [],
                    c.i64_load32_u(
                        c.i32_const(mulBuff),
                        j*(n32*8) + i*8 - j*8
                    )
                ));
            }
            f.addCode(c.setLocal("c", []));
            f.addCode(
                c.i64_store32(
                    c.getLocal("r"),
                    i*4,
                    c.getLocal("c")
                )
            );
        }

        for (let i=0; i<n32; i++) {
            f.addCode(c.i64_shr_u(c.getLocal("c"), c.i64_const(32)));
            for (let j=i; j<n32; j++) {
                f.addCode(c.i64_add(
                    [],
                    c.i64_load32_u(
                        c.i32_const(mulBuff),
                        j*(n32*8) + n32*8-4 + i*8- j*8
                    )
                ));
            }
            for (let j=i+1; j<n32; j++) {
                f.addCode(c.i64_add(
                    [],
                    c.i64_load32_u(
                        c.i32_const(mulBuff),
                        j*(n32*8) + n32*8 + i*8 - j*8
                    )
                ));
            }
            f.addCode(c.setLocal("c", []));
            f.addCode(
                c.i64_store32(
                    c.getLocal("r"),
                    i*4 + n32*4,
                    c.getLocal("c")
                )
            );
        }
    }

    function _buildMul1() {
        const f = module.addFunction(prefix+"__mul1");
        f.addParam("px", "i32");
        f.addParam("y", "i64");
        f.addParam("pr", "i32");
        f.addLocal("c", "i64");

        const c = f.getCodeBuilder();

        f.addCode(c.setLocal(
            "c",
            c.i64_mul(
                c.i64_load32_u(c.getLocal("px"), 0, 0),
                c.getLocal("y")
            )
        ));

        f.addCode(c.i64_store32(
            c.getLocal("pr"),
            0,
            0,
            c.getLocal("c"),
        ));

        for (let i=1; i<n32; i++) {
            f.addCode(c.setLocal( "c",
                c.i64_add(
                    c.i64_mul(
                        c.i64_load32_u(c.getLocal("px"), 4*i, 0),
                        c.getLocal("y")
                    ),
                    c.i64_shr_u (c.getLocal("c"), c.i64_const(32))
                )
            ));

            f.addCode(c.i64_store32(
                c.getLocal("pr"),
                i*4,
                0,
                c.getLocal("c")
            ));
        }
    }

    function _buildAdd1() {
        const f = module.addFunction(prefix+"__add1");
        f.addParam("x", "i32");
        f.addParam("y", "i64");
        f.addLocal("c", "i64");
        f.addLocal("px", "i32");

        const c = f.getCodeBuilder();

        f.addCode(c.setLocal("px", c.getLocal("x")));

        f.addCode(c.setLocal(
            "c",
            c.i64_add(
                c.i64_load32_u(c.getLocal("px"), 0, 0),
                c.getLocal("y")
            )
        ));

        f.addCode(c.i64_store32(
            c.getLocal("px"),
            0,
            0,
            c.getLocal("c"),
        ));

        f.addCode(c.setLocal(
            "c",
            c.i64_shr_u(
                c.getLocal("c"),
                c.i64_const(32)
            )
        ));

        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.i64_eqz(c.getLocal("c"))
            ),
            c.setLocal(
                "px",
                c.i32_add(
                    c.getLocal("px"),
                    c.i32_const(4)
                )
            ),

            c.setLocal(
                "c",
                c.i64_add(
                    c.i64_load32_u(c.getLocal("px"), 0, 0),
                    c.getLocal("c")
                )
            ),

            c.i64_store32(
                c.getLocal("px"),
                0,
                0,
                c.getLocal("c"),
            ),

            c.setLocal(
                "c",
                c.i64_shr_u(
                    c.getLocal("c"),
                    c.i64_const(32)
                )
            ),

            c.br(0)
        )));
    }


    function buildDiv() {
        _buildMul1();
        _buildAdd1();

        const f = module.addFunction(prefix+"_div");
        f.addParam("x", "i32");
        f.addParam("y", "i32");
        f.addParam("c", "i32");
        f.addParam("r", "i32");
        f.addLocal("rr", "i32");
        f.addLocal("cc", "i32");
        f.addLocal("eX", "i32");
        f.addLocal("eY", "i32");
        f.addLocal("sy", "i64");
        f.addLocal("sx", "i64");
        f.addLocal("ec", "i32");

        const c = f.getCodeBuilder();

        const Y = c.i32_const(module.alloc(n8));
        const Caux = c.i32_const(module.alloc(n8));
        const Raux = c.i32_const(module.alloc(n8));
        const C = c.getLocal("cc");
        const R = c.getLocal("rr");
        const pr1 = module.alloc(n8*2);
        const R1 = c.i32_const(pr1);
        const R2 = c.i32_const(pr1+n8);

        // Ic c is 0 then store it in an auxiliary buffer
        f.addCode(c.if(
            c.getLocal("c"),
            c.setLocal("cc", c.getLocal("c")),
            c.setLocal("cc", Caux)
        ));

        // Ic r is 0 then store it in an auxiliary buffer
        f.addCode(c.if(
            c.getLocal("r"),
            c.setLocal("rr", c.getLocal("r")),
            c.setLocal("rr", Raux)
        ));

        // Copy
        f.addCode(c.call(prefix + "_copy", c.getLocal("x"), R));
        f.addCode(c.call(prefix + "_copy", c.getLocal("y"), Y));
        f.addCode(c.call(prefix + "_zero", C));
        f.addCode(c.call(prefix + "_zero", R1));


        f.addCode(c.setLocal("eX", c.i32_const(n8-1)));
        f.addCode(c.setLocal("eY", c.i32_const(n8-1)));

        // while (eY>3)&&(Y[eY]==0) ey--;
        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.i32_or(
                    c.i32_load8_u(
                        c.i32_add(Y , c.getLocal("eY")),
                        0,
                        0
                    ),
                    c.i32_eq(
                        c.getLocal("eY"),
                        c.i32_const(3)
                    )
                )
            ),
            c.setLocal("eY", c.i32_sub(c.getLocal("eY"), c.i32_const(1))),
            c.br(0)
        )));

        f.addCode(
            c.setLocal(
                "sy",
                c.i64_add(
                    c.i64_load32_u(
                        c.i32_sub(
                            c.i32_add( Y, c.getLocal("eY")),
                            c.i32_const(3)
                        ),
                        0,
                        0
                    ),
                    c.i64_const(1)
                )
            )
        );

        // Force a divide by 0 if quotien is 0
        f.addCode(
            c.if(
                c.i64_eq(
                    c.getLocal("sy"),
                    c.i64_const(1)
                ),
                c.drop(c.i64_div_u(c.i64_const(0), c.i64_const(0)))
            )
        );

        f.addCode(c.block(c.loop(

            // while (eX>7)&&(Y[eX]==0) ex--;
            c.block(c.loop(
                c.br_if(
                    1,
                    c.i32_or(
                        c.i32_load8_u(
                            c.i32_add(R , c.getLocal("eX")),
                            0,
                            0
                        ),
                        c.i32_eq(
                            c.getLocal("eX"),
                            c.i32_const(7)
                        )
                    )
                ),
                c.setLocal("eX", c.i32_sub(c.getLocal("eX"), c.i32_const(1))),
                c.br(0)
            )),

            c.setLocal(
                "sx",
                c.i64_load(
                    c.i32_sub(
                        c.i32_add( R, c.getLocal("eX")),
                        c.i32_const(7)
                    ),
                    0,
                    0
                )
            ),

            c.setLocal(
                "sx",
                c.i64_div_u(
                    c.getLocal("sx"),
                    c.getLocal("sy")
                )
            ),
            c.setLocal(
                "ec",
                c.i32_sub(
                    c.i32_sub(
                        c.getLocal("eX"),
                        c.getLocal("eY")
                    ),
                    c.i32_const(4)
                )
            ),

            // While greater than 32 bits or ec is neg, shr and inc exp
            c.block(c.loop(
                c.br_if(
                    1,
                    c.i32_and(
                        c.i64_eqz(
                            c.i64_and(
                                c.getLocal("sx"),
                                c.i64_const("0xFFFFFFFF00000000")
                            )
                        ),
                        c.i32_ge_s(
                            c.getLocal("ec"),
                            c.i32_const(0)
                        )
                    )
                ),

                c.setLocal(
                    "sx",
                    c.i64_shr_u(
                        c.getLocal("sx"),
                        c.i64_const(8)
                    )
                ),

                c.setLocal(
                    "ec",
                    c.i32_add(
                        c.getLocal("ec"),
                        c.i32_const(1)
                    )
                ),
                c.br(0)
            )),

            c.if(
                c.i64_eqz(c.getLocal("sx")),
                [
                    ...c.br_if(
                        2,
                        c.i32_eqz(c.call(prefix + "_gte", R, Y))
                    ),
                    ...c.setLocal("sx", c.i64_const(1)),
                    ...c.setLocal("ec", c.i32_const(0))
                ]
            ),

            c.call(prefix + "__mul1", Y, c.getLocal("sx"), R2),
            c.drop(c.call(
                prefix + "_sub",
                R,
                c.i32_sub(R2, c.getLocal("ec")),
                R
            )),
            c.call(
                prefix + "__add1",
                c.i32_add(C, c.getLocal("ec")),
                c.getLocal("sx")
            ),
            c.br(0)
        )));
    }

    function buildInverseMod() {

        const f = module.addFunction(prefix+"_inverseMod");
        f.addParam("px", "i32");
        f.addParam("pm", "i32");
        f.addParam("pr", "i32");
        f.addLocal("t", "i32");
        f.addLocal("newt", "i32");
        f.addLocal("r", "i32");
        f.addLocal("qq", "i32");
        f.addLocal("qr", "i32");
        f.addLocal("newr", "i32");
        f.addLocal("swp", "i32");
        f.addLocal("x", "i32");
        f.addLocal("signt", "i32");
        f.addLocal("signnewt", "i32");
        f.addLocal("signx", "i32");

        const c = f.getCodeBuilder();

        const aux1 = c.i32_const(module.alloc(n8));
        const aux2 = c.i32_const(module.alloc(n8));
        const aux3 = c.i32_const(module.alloc(n8));
        const aux4 = c.i32_const(module.alloc(n8));
        const aux5 = c.i32_const(module.alloc(n8));
        const aux6 = c.i32_const(module.alloc(n8));
        const mulBuff = c.i32_const(module.alloc(n8*2));
        const aux7 = c.i32_const(module.alloc(n8));

        f.addCode(
            c.setLocal("t", aux1),
            c.call(prefix + "_zero", aux1),
            c.setLocal("signt", c.i32_const(0)),
        );

        f.addCode(
            c.setLocal("r", aux2),
            c.call(prefix + "_copy", c.getLocal("pm"), aux2)
        );

        f.addCode(
            c.setLocal("newt", aux3),
            c.call(prefix + "_one", aux3),
            c.setLocal("signnewt", c.i32_const(0)),
        );

        f.addCode(
            c.setLocal("newr", aux4),
            c.call(prefix + "_copy", c.getLocal("px"), aux4)
        );




        f.addCode(c.setLocal("qq", aux5));
        f.addCode(c.setLocal("qr", aux6));
        f.addCode(c.setLocal("x", aux7));

        f.addCode(c.block(c.loop(
            c.br_if(
                1,
                c.call(prefix + "_isZero", c.getLocal("newr") )
            ),
            c.call(prefix + "_div", c.getLocal("r"), c.getLocal("newr"), c.getLocal("qq"), c.getLocal("qr")),

            c.call(prefix + "_mul", c.getLocal("qq"), c.getLocal("newt"), mulBuff),

            c.if(
                c.getLocal("signt"),
                c.if(
                    c.getLocal("signnewt"),
                    c.if (
                        c.call(prefix + "_gte", mulBuff, c.getLocal("t")),
                        [
                            ...c.drop(c.call(prefix + "_sub", mulBuff, c.getLocal("t"), c.getLocal("x"))),
                            ...c.setLocal("signx", c.i32_const(0))
                        ],
                        [
                            ...c.drop(c.call(prefix + "_sub", c.getLocal("t"), mulBuff, c.getLocal("x"))),
                            ...c.setLocal("signx", c.i32_const(1))
                        ],
                    ),
                    [
                        ...c.drop(c.call(prefix + "_add", mulBuff, c.getLocal("t"), c.getLocal("x"))),
                        ...c.setLocal("signx", c.i32_const(1))
                    ]
                ),
                c.if(
                    c.getLocal("signnewt"),
                    [
                        ...c.drop(c.call(prefix + "_add", mulBuff, c.getLocal("t"), c.getLocal("x"))),
                        ...c.setLocal("signx", c.i32_const(0))
                    ],
                    c.if (
                        c.call(prefix + "_gte", c.getLocal("t"), mulBuff),
                        [
                            ...c.drop(c.call(prefix + "_sub", c.getLocal("t"), mulBuff, c.getLocal("x"))),
                            ...c.setLocal("signx", c.i32_const(0))
                        ],
                        [
                            ...c.drop(c.call(prefix + "_sub", mulBuff, c.getLocal("t"), c.getLocal("x"))),
                            ...c.setLocal("signx", c.i32_const(1))
                        ]
                    )
                )
            ),

            c.setLocal("swp", c.getLocal("t")),
            c.setLocal("t", c.getLocal("newt")),
            c.setLocal("newt", c.getLocal("x")),
            c.setLocal("x", c.getLocal("swp")),

            c.setLocal("signt", c.getLocal("signnewt")),
            c.setLocal("signnewt", c.getLocal("signx")),

            c.setLocal("swp", c.getLocal("r")),
            c.setLocal("r", c.getLocal("newr")),
            c.setLocal("newr", c.getLocal("qr")),
            c.setLocal("qr", c.getLocal("swp")),

            c.br(0)
        )));

        f.addCode(c.if(
            c.getLocal("signt"),
            c.drop(c.call(prefix + "_sub", c.getLocal("pm"), c.getLocal("t"), c.getLocal("pr"))),
            c.call(prefix + "_copy", c.getLocal("t"), c.getLocal("pr"))
        ));
    }


    buildCopy();
    buildZero();
    buildIsZero();
    buildOne();
    buildEq();
    buildGte();
    buildAdd();
    buildSub();
    buildMul();
    buildDiv();
    buildInverseMod();
    module.exportFunction(prefix+"_copy");
    module.exportFunction(prefix+"_zero");
    module.exportFunction(prefix+"_one");
    module.exportFunction(prefix+"_isZero");
    module.exportFunction(prefix+"_eq");
    module.exportFunction(prefix+"_gte");
    module.exportFunction(prefix+"_add");
    module.exportFunction(prefix+"_sub");
    module.exportFunction(prefix+"_mul");
    module.exportFunction(prefix+"_div");
    module.exportFunction(prefix+"_inverseMod");

    return prefix;
};

},{"./utils.js":17}],10:[function(require,module,exports){

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

    buildSetSet();
    buildSetIsSet();
    buildPTableReset();
    buildPTableGet();
    buildPackBits();
    buildMulw();
    buildMultiexp();
    module.exportFunction(prefix+"_multiexp");


};

},{}],11:[function(require,module,exports){
module.exports = function buildPol(module, prefix, prefixField) {

    const n64 = module.modules[prefixField].n64;
    const n8 = n64*8;


    function buildZero() {
        const f = module.addFunction(prefix+"_zero");
        f.addParam("px", "i32");
        f.addParam("n", "i32");
        f.addLocal("lastp", "i32");
        f.addLocal("p", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.setLocal("p", c.getLocal("px")),
            c.setLocal(
                "lastp",
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
                        c.getLocal("p"),
                        c.getLocal("lastp")
                    )
                ),
                c.call(prefixField + "_zero", c.getLocal("p")),
                c.setLocal("p", c.i32_add(c.getLocal("p"), c.i32_const(n8))),
                c.br(0)
            ))
        );
    }

    function buildConstructLC() {
        const f = module.addFunction(prefix+"_constructLC");
        f.addParam("ppolynomials", "i32");
        f.addParam("psignals", "i32");
        f.addParam("nSignals", "i32");
        f.addParam("pres", "i32");
        f.addLocal("i", "i32");
        f.addLocal("j", "i32");
        f.addLocal("pp", "i32");
        f.addLocal("ps", "i32");
        f.addLocal("pd", "i32");
        f.addLocal("ncoefs", "i32");

        const c = f.getCodeBuilder();

        const aux = c.i32_const(module.alloc(n8));

        f.addCode(
            c.setLocal("i", c.i32_const(0)),
            c.setLocal("pp", c.getLocal("ppolynomials")),
            c.setLocal("ps", c.getLocal("psignals")),
            c.block(c.loop(
                c.br_if(
                    1,
                    c.i32_eq(
                        c.getLocal("i"),
                        c.getLocal("nSignals")
                    )
                ),

                c.setLocal("ncoefs", c.i32_load(c.getLocal("pp"))),
                c.setLocal("pp", c.i32_add(c.getLocal("pp"), c.i32_const(4))),

                c.setLocal("j", c.i32_const(0)),
                c.block(c.loop(
                    c.br_if(
                        1,
                        c.i32_eq(
                            c.getLocal("j"),
                            c.getLocal("ncoefs")
                        )
                    ),

                    c.setLocal(
                        "pd",
                        c.i32_add(
                            c.getLocal("pres"),
                            c.i32_mul(
                                c.i32_load(c.getLocal("pp")),
                                c.i32_const(n8)
                            )
                        )
                    ),

                    c.setLocal("pp", c.i32_add(c.getLocal("pp"), c.i32_const(4))),


                    c.call(
                        prefixField + "_mul",
                        c.getLocal("ps"),
                        c.getLocal("pp"),
                        aux
                    ),

                    c.call(
                        prefixField + "_add",
                        aux,
                        c.getLocal("pd"),
                        c.getLocal("pd")
                    ),

                    c.setLocal("pp", c.i32_add(c.getLocal("pp"), c.i32_const(n8))),
                    c.setLocal("j", c.i32_add(c.getLocal("j"), c.i32_const(1))),
                    c.br(0)
                )),

                c.setLocal("ps", c.i32_add(c.getLocal("ps"), c.i32_const(n8))),
                c.setLocal("i", c.i32_add(c.getLocal("i"), c.i32_const(1))),
                c.br(0)
            ))
        );

    }

    buildZero();
    buildConstructLC();


    module.exportFunction(prefix + "_zero");
    module.exportFunction(prefix + "_constructLC");

    return prefix;




};

},{}],12:[function(require,module,exports){
const bigInt = require("big-integer");
const utils = require("./utils.js");

module.exports = function buildTestF1(module) {

    const q = bigInt("21888242871839275222246405745257275088696311157297823662689037894645226208583");

    const pR2 = module.modules.f1m.pR2;
    const n8 = module.modules.f1m.n64*8;

    const pR3 = module.alloc(utils.bigInt2BytesLE(bigInt.one.shiftLeft(256).square().mod(q).shiftRight(128), n8));


    function buildTestF1() {
        const f = module.addFunction("testF1");
        f.addParam("n", "i32");
        f.addLocal("i", "i32");

        const c = f.getCodeBuilder();

        const pAux1 = module.alloc(n8);

        f.addCode(c.setLocal("i", c.getLocal("n")));
        f.addCode(c.block(c.loop(
//            c.call("f1m_add", c.i32_const(pR2), c.i32_const(pR2), c.i32_const(pAux1)),
            c.call("f1m_mul", c.i32_const(pR2), c.i32_const(pR2), c.i32_const(pAux1)),
//            c.call("int_div", c.i32_const(pR2), c.i32_const(pR3), c.i32_const(pAux1), c.i32_const(0)),
            c.setLocal("i", c.i32_sub(c.getLocal("i"), c.i32_const(1))),
            c.br_if(1, c.i32_eqz ( c.getLocal("i") )),
            c.br(0)
        )));
    }

    buildTestF1();
    module.exportFunction("testF1");
};

},{"./utils.js":17,"big-integer":2}],13:[function(require,module,exports){
const bigInt = require("big-integer");

module.exports = function buildTestAddG1(module) {

    function buildTestAddG1() {
        const f = module.addFunction("testAddG1");
        f.addParam("n", "i32");
        f.addParam("pP", "i32");
        f.addParam("pR", "i32");
        f.addLocal("i", "i32");

        const c = f.getCodeBuilder();

        f.addCode(c.call("g1_zero", c.getLocal("pR")));

        f.addCode(c.setLocal("i", c.getLocal("n")));
        f.addCode(c.block(c.loop(
            c.call("g1_add", c.getLocal("pP"), c.getLocal("pR"), c.getLocal("pR")),
            c.setLocal("i", c.i32_sub(c.getLocal("i"), c.i32_const(1))),
            c.br_if(1, c.i32_eqz ( c.getLocal("i") )),
            c.br(0)
        )));
    }

    buildTestAddG1();
    module.exportFunction("testAddG1");
};


},{"big-integer":2}],14:[function(require,module,exports){



module.exports = function buildTimesScalar(module, fnName, elementLen, opAB, opAA, fPrefix) {

    const f = module.addFunction(fnName);
    f.addParam("base", "i32");
    f.addParam("scalar", "i32");
    f.addParam("scalarLength", "i32");
    f.addParam("r", "i32");
    f.addLocal("i", "i32");
    f.addLocal("b", "i32");

    const c = f.getCodeBuilder();

    const aux = c.i32_const(module.alloc(elementLen));

    f.addCode(c.call(fPrefix + "_copy", c.getLocal("base"), aux));

    f.addCode(c.call(fPrefix + "_zero", c.getLocal("r")));

    f.addCode(c.setLocal("i", c.getLocal("scalarLength")));
    f.addCode(c.block(c.loop(
        c.setLocal("i", c.i32_sub(c.getLocal("i"), c.i32_const(1))),

        c.setLocal(
            "b",
            c.i32_load8_u(
                c.i32_add(
                    c.getLocal("scalar"),
                    c.getLocal("i")
                )
            )
        ),
        ...innerLoop(),
        c.br_if(1, c.i32_eqz ( c.getLocal("i") )),
        c.br(0)
    )));


    function innerLoop() {
        const code = [];
        for (let i=0; i<8; i++) {
            code.push(
                ...c.call(opAA, c.getLocal("r"), c.getLocal("r")),
                ...c.if(
                    c.i32_ge_u( c.getLocal("b"), c.i32_const(0x80 >> i)),
                    [
                        ...c.setLocal(
                            "b",
                            c.i32_sub(
                                c.getLocal("b"),
                                c.i32_const(0x80 >> i)
                            )
                        ),
                        ...c.call(opAB, aux, c.getLocal("r"), c.getLocal("r"))
                    ]
                )
            );
        }
        return code;
    }

};

},{}],15:[function(require,module,exports){
/* globals WebAssembly */
const bigInt = require("big-integer");
const ModuleBuilder = require("./wasmbuilder/index.js");
const buildF1 = require("./build_f1.js");
const buildTestF1 = require("./build_testf1.js");

async function build(q) {
    const f1 = new F1(q);

    f1.q = bigInt(q);
    f1.n64 = Math.floor((f1.q.minus(1).bitLength() - 1)/64) +1;
    f1.n32 = f1.n64*2;
    f1.n8 = f1.n64*8;

    f1.memory = new WebAssembly.Memory({initial:1});
    f1.i32 = new Uint32Array(f1.memory.buffer);

    const moduleBuilder = new ModuleBuilder();
    buildF1(moduleBuilder, f1.q);
    buildTestF1(moduleBuilder);

    const code = moduleBuilder.build();

    const wasmModule = await WebAssembly.compile(code);

    f1.instance = await WebAssembly.instantiate(wasmModule, {
        env: {
            "memory": f1.memory
        }
    });

    Object.assign(f1, f1.instance.exports);

    return f1;
}

class F1 {

    constructor() {

    }

    alloc(length) {
        const res = this.i32[0];
        this.i32[0] += length;
        return res;
    }

    putInt(pos, _a) {
        const a = bigInt(_a);
        if (pos & 0x7) throw new Error("Pointer must be aligned");
        if (a.bitLength > this.n64*64) {
            return this.putInt(a.mod(this.q));
        }
        for (let i=0; i<this.n32; i++) {
            this.i32[(pos>>2)+i] = a.shiftRight(i*32).and(0xFFFFFFFF).toJSNumber();
        }
    }

    allocInt(_a) {
        const p = this.alloc(this.n8);
        if (_a) this.putInt(p, _a);
        return p;
    }

    putInt2(pos, _a) {
        const a = bigInt(_a);
        if (pos & 0x7) throw new Error("Pointer must be aligned");
        if (a.bitLength > this.n64*64*2) {
            return this.putInt(a.mod(this.q));
        }
        for (let i=0; i<this.n32*2; i++) {
            this.i32[(pos>>2)+i] = a.shiftRight(i*32).and(0xFFFFFFFF).toJSNumber();
        }
    }

    getInt(pos) {
        if (pos & 0x7) throw new Error("Pointer must be aligned");
        let acc = bigInt(this.i32[(pos>>2)+this.n32-1]);
        for (let i=this.n32-2; i>=0; i--) {
            acc = acc.shiftLeft(32);
            acc = acc.add(this.i32[(pos>>2)+i]);
        }
        return acc;
    }

    getInt2(pos) {
        if (pos & 0x7) throw new Error("Pointer must be aligned");
        const last = this.n32*2-1;
        let acc = bigInt(this.i32[(pos>>2)+last]);
        for (let i=last; i>=0; i--) {
            acc = acc.shiftLeft(32);
            acc = acc.add(this.i32[(pos>>2)+i]);
        }
        return acc;
    }

    allocInt2(_a) {
        const p = this.alloc(this.n8*2);
        if (_a) this.putInt2(p, _a);
        return p;
    }

    test_F1(n) {
        const start = new Date().getTime();

        this.instance.exports.testF1(n);

        const end = new Date().getTime();
        const time = end - start;

        return time;
    }
/*
    function test(n) {

        const q = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;
        let a = (1n << 512n)%q ;
        let b = a >> 128n;

        let c;

        const start = new Date().getTime();
        for (let i=0; i<n; i++) c = a+b;

        const end = new Date().getTime();
        const time = end - start;

        console.log(time);
    }
*/
}

module.exports = build;

},{"./build_f1.js":5,"./build_testf1.js":12,"./wasmbuilder/index.js":20,"big-integer":2}],16:[function(require,module,exports){
/* globals WebAssembly, Blob, Worker, navigator, Promise, window */
const bigInt = require("big-integer");
const ModuleBuilder = require("./wasmbuilder/index.js");
const buildF1m = require("./build_f1m.js");
const buildF2m = require("./build_f2m.js");
const buildF1 = require("./build_f1.js");
const buildCurve = require("./build_curve.js");
const buildTest = require("./build_testg1");
const buildFFT = require("./build_fft");
const buildMultiexp = require("./build_multiexp");
const buildPol = require("./build_pol");
const utils = require("./utils");
const assert = require("assert");


class Deferred {
    constructor() {
        this.promise = new Promise((resolve, reject)=> {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
}

/*
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
*/

function thread(self) {
    let instance;
    let memory;
    let i32;

    async function init(data) {
        const code = new Uint8Array(data.code);
        const wasmModule = await WebAssembly.compile(code);
        memory = new WebAssembly.Memory({initial:data.init});
        i32 = new Uint32Array(memory.buffer);

        instance = await WebAssembly.instantiate(wasmModule, {
            env: {
                "memory": memory
            }
        });
    }

    function alloc(length) {
        while (i32[0] & 3) i32[0]++;  // Return always aligned pointers
        const res = i32[0];
        i32[0] += length;
        return res;
    }

    function putBin(b) {
        const p = alloc(b.byteLength);
        const s32 = new Uint32Array(b);
        i32.set(s32, p/4);
        return p;
    }

    function getBin(p, l) {
        return memory.buffer.slice(p, p+l);
    }

    self.onmessage = function(e) {
        if (e.data.command == "INIT") {
            init(e.data).then(function() {
                self.postMessage(e.data.result);
            });
        } else if (e.data.command == "G1_MULTIEXP") {

            const oldAlloc = i32[0];
            const pScalars = putBin(e.data.scalars);
            const pPoints = putBin(e.data.points);
            const pRes = alloc(96);
            instance.exports.g1_zero(pRes);
            instance.exports.g1_multiexp(pScalars, pPoints, e.data.n, 5, pRes);

            e.data.result = getBin(pRes, 96);
            i32[0] = oldAlloc;
            self.postMessage(e.data.result, [e.data.result]);
        } else if (e.data.command == "G2_MULTIEXP") {

            const oldAlloc = i32[0];
            const pScalars = putBin(e.data.scalars);
            const pPoints = putBin(e.data.points);
            const pRes = alloc(192);
            instance.exports.g2_zero(pRes);
            instance.exports.g2_multiexp(pScalars, pPoints, e.data.n, 5, pRes);

            e.data.result = getBin(pRes, 192);
            i32[0] = oldAlloc;
            self.postMessage(e.data.result, [e.data.result]);
        } else if (e.data.command == "CALC_H") {
            const oldAlloc = i32[0];
            const pSignals = putBin(e.data.signals);
            const pPolsA = putBin(e.data.polsA);
            const pPolsB = putBin(e.data.polsB);
            const nSignals = e.data.nSignals;
            const domainSize = e.data.domainSize;
            const pSignalsM = alloc(nSignals*32);
            const pPolA = alloc(domainSize*32);
            const pPolB = alloc(domainSize*32);
            const pPolA2 = alloc(domainSize*32*2);
            const pPolB2 = alloc(domainSize*32*2);

            instance.exports.fft_toMontgomeryN(pSignals, pSignalsM, nSignals);

            instance.exports.pol_zero(pPolA, domainSize);
            instance.exports.pol_zero(pPolB, domainSize);

            instance.exports.pol_constructLC(pPolsA, pSignalsM, nSignals, pPolA);
            instance.exports.pol_constructLC(pPolsB, pSignalsM, nSignals, pPolB);

            instance.exports.fft_copyNInterleaved(pPolA, pPolA2, domainSize);
            instance.exports.fft_copyNInterleaved(pPolB, pPolB2, domainSize);

            instance.exports.fft_ifft(pPolA, domainSize, 0);
            instance.exports.fft_ifft(pPolB, domainSize, 0);
            instance.exports.fft_fft(pPolA, domainSize, 1);
            instance.exports.fft_fft(pPolB, domainSize, 1);

            instance.exports.fft_copyNInterleaved(pPolA, pPolA2+32, domainSize);
            instance.exports.fft_copyNInterleaved(pPolB, pPolB2+32, domainSize);

            instance.exports.fft_mulN(pPolA2, pPolB2, domainSize*2, pPolA2);

            instance.exports.fft_ifft(pPolA2, domainSize*2, 0);

            instance.exports.fft_fromMontgomeryN(pPolA2+domainSize*32, pPolA2+domainSize*32, nSignals);

            e.data.result = getBin(pPolA2+domainSize*32, domainSize*32);
            i32[0] = oldAlloc;
            self.postMessage(e.data.result, [e.data.result]);
        }
    };
}

async function build() {

    const groth16 = new Groth16();

    groth16.q = bigInt("21888242871839275222246405745257275088696311157297823662689037894645226208583");
    groth16.r = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    groth16.n64 = Math.floor((groth16.q.minus(1).bitLength() - 1)/64) +1;
    groth16.n32 = groth16.n64*2;
    groth16.n8 = groth16.n64*8;

    groth16.memory = new WebAssembly.Memory({initial:1000});
    groth16.i32 = new Uint32Array(groth16.memory.buffer);

    const moduleBuilder = new ModuleBuilder();
    moduleBuilder.setMemory(1000);
    buildF1m(moduleBuilder, groth16.q, "f1m");
    buildF1(moduleBuilder, groth16.r, "fr", "frm");
    buildCurve(moduleBuilder, "g1", "f1m");
    buildMultiexp(moduleBuilder, "g1", "g1", "f1m", "fr");
    buildFFT(moduleBuilder, "fft", "frm");
    buildPol(moduleBuilder, "pol", "frm");

    const pNonResidueF2 =  moduleBuilder.alloc(
        utils.bigInt2BytesLE(
            bigInt("15537367993719455909907449462855742678907882278146377936676643359958227611562"), // -1 in montgomery
            groth16.n8
        )
    );

    buildF2m(moduleBuilder, pNonResidueF2, "f2m", "f1m");
    buildCurve(moduleBuilder, "g2", "f2m");
    buildMultiexp(moduleBuilder, "g2", "g2", "f2m", "fr");

    buildTest(moduleBuilder);

    const code = moduleBuilder.build();

    const wasmModule = await WebAssembly.compile(code);

    groth16.instance = await WebAssembly.instantiate(wasmModule, {
        env: {
            "memory": groth16.memory
        }
    });

    groth16.pq = moduleBuilder.modules.f1m.pq;
    groth16.pr = moduleBuilder.modules.frm.pq;

    groth16.pr0 = groth16.alloc(192);
    groth16.pr1 = groth16.alloc(192);

    groth16.workers = [];
    groth16.pendingDeferreds = [];
    groth16.working = [];

    const concurrency = navigator.hardwareConcurrency || 8;

    for (let i = 0; i<concurrency+2; i++) {

        const blob = new Blob(["(", thread.toString(), ")(self);"], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);

        groth16.workers[i] = new Worker(url);

        groth16.workers[i].onmessage = function(e) {
            groth16.working[i]=false;
            groth16.pendingDeferreds[i].resolve(e.data);
            groth16.processWorks();
        };

        groth16.working[i]=false;
    }

    const initPromises = [];
    for (let i=0; i<groth16.workers.length;i++) {
        const copyCode = code.slice(0).buffer;
        initPromises.push(groth16.postAction(i, {
            command: "INIT",
            init: 1000,
            code: copyCode

        }, [copyCode]));
    }

    await Promise.all(initPromises);

    return groth16;
}

class Groth16 {
    constructor() {
        this.actionQueue = [];
    }

    postAction(workerId, e, transfers, _deferred) {
        assert(this.working[workerId] == false);
        this.working[workerId] = true;

        this.pendingDeferreds[workerId] = _deferred ? _deferred : new Deferred();
        this.workers[workerId].postMessage(e, transfers);

        return this.pendingDeferreds[workerId].promise;
    }

    processWorks() {
        for (let i=0; (i<this.workers.length)&&(this.actionQueue.length > 0); i++) {
            if (this.working[i] == false) {
                const work = this.actionQueue.shift();
                this.postAction(i, work.data, work.transfers, work.deferred);
            }
        }
    }

    queueAction(actionData, transfers) {
        const d = new Deferred();
        this.actionQueue.push({
            data: actionData,
            transfers: transfers,
            deferred: d
        });
        this.processWorks();
        return d.promise;
    }

    alloc(length) {
        while (this.i32[0] & 3) this.i32[0]++;  // Return always aligned pointers
        const res = this.i32[0];
        this.i32[0] += length;
        return res;
    }


    putBin(p, b) {
        const s32 = new Uint32Array(b);
        this.i32.set(s32, p/4);
    }

    getBin(p, l) {
        return this.memory.buffer.slice(p, p+l);
    }

    bin2int(b) {
        const i32 = new Uint32Array(b);
        let acc = bigInt(i32[7]);
        for (let i=6; i>=0; i--) {
            acc = acc.shiftLeft(32);
            acc = acc.add(i32[i]);
        }
        return acc.toString();
    }

    bin2g1(b) {
        return [
            this.bin2int(b.slice(0,32)),
            this.bin2int(b.slice(32,64)),
            this.bin2int(b.slice(64,96)),
        ];
    }
    bin2g2(b) {
        return [
            [
                this.bin2int(b.slice(0,32)),
                this.bin2int(b.slice(32,64))
            ],
            [
                this.bin2int(b.slice(64,96)),
                this.bin2int(b.slice(96,128))
            ],
            [
                this.bin2int(b.slice(128,160)),
                this.bin2int(b.slice(160,192))
            ],
        ];
    }

    async g1_multiexp(scalars, points) {
        const nPoints = scalars.byteLength /32;
        const nPointsPerThread = Math.floor(nPoints / this.workers.length);
        const opPromises = [];
        for (let i=0; i<this.workers.length; i++) {
            const th_nPoints =
                i < this.workers.length -1 ?
                    nPointsPerThread :
                    nPoints - (nPointsPerThread * (this.workers.length -1));
            const scalars_th = scalars.slice(i*nPointsPerThread*32, i*nPointsPerThread*32 + th_nPoints*32);
            const points_th = points.slice(i*nPointsPerThread*64, i*nPointsPerThread*64 + th_nPoints*64);
            opPromises.push(
                this.queueAction({
                    command: "G1_MULTIEXP",
                    scalars: scalars_th,
                    points: points_th,
                    n: th_nPoints
                }, [scalars_th, points_th])
            );
        }

        const results = await Promise.all(opPromises);

        this.instance.exports.g1_zero(this.pr0);
        for (let i=0; i<results.length; i++) {
            this.putBin(this.pr1, results[i]);
            this.instance.exports.g1_add(this.pr0, this.pr1, this.pr0);
        }

        return this.getBin(this.pr0, 96);
    }

    async g2_multiexp(scalars, points) {
        const nPoints = scalars.byteLength /32;
        const nPointsPerThread = Math.floor(nPoints / this.workers.length);
        const opPromises = [];
        for (let i=0; i<this.workers.length; i++) {
            const th_nPoints =
                i < this.workers.length -1 ?
                    nPointsPerThread :
                    nPoints - (nPointsPerThread * (this.workers.length -1));
            const scalars_th = scalars.slice(i*nPointsPerThread*32, i*nPointsPerThread*32 + th_nPoints*32);
            const points_th = points.slice(i*nPointsPerThread*128, i*nPointsPerThread*128 + th_nPoints*128);
            opPromises.push(
                this.queueAction({
                    command: "G2_MULTIEXP",
                    scalars: scalars_th,
                    points: points_th,
                    n: th_nPoints
                }, [scalars_th, points_th])
            );
        }

        const results = await Promise.all(opPromises);

        this.instance.exports.g2_zero(this.pr0);
        for (let i=0; i<results.length; i++) {
            this.putBin(this.pr1, results[i]);
            this.instance.exports.g2_add(this.pr0, this.pr1, this.pr0);
        }

        return this.getBin(this.pr0, 192);
    }

    g1_affine(p) {
        this.putBin(this.pr0, p);
        this.instance.exports.g1_affine(this.pr0, this.pr0);
        return this.getBin(this.pr0, 96);
    }

    g2_affine(p) {
        this.putBin(this.pr0, p);
        this.instance.exports.g2_affine(this.pr0, this.pr0);
        return this.getBin(this.pr0, 192);
    }

    g1_fromMontgomery(p) {
        this.putBin(this.pr0, p);
        this.instance.exports.g1_fromMontgomery(this.pr0, this.pr0);
        return this.getBin(this.pr0, 96);
    }

    g2_fromMontgomery(p) {
        this.putBin(this.pr0, p);
        this.instance.exports.g2_fromMontgomery(this.pr0, this.pr0);
        return this.getBin(this.pr0, 192);
    }

    loadPoint1(b) {
        const p = this.alloc(96);
        this.putBin(p, b);
        this.instance.exports.f1m_one(p+64);
        return p;
    }

    loadPoint2(b) {
        const p = this.alloc(192);
        this.putBin(p, b);
        this.instance.exports.f2m_one(p+128);
        return p;
    }


    async calcH(signals, polsA, polsB, nSignals, domainSize) {
        return this.queueAction({
            command: "CALC_H",
            signals: signals,
            polsA: polsA,
            polsB: polsB,
            nSignals: nSignals,
            domainSize: domainSize
        }, [signals, polsA, polsB]);
    }

    async proof(signals, pkey) {
        const pkey32 = new Uint32Array(pkey);
        const nSignals = pkey32[0];
        const nPublic = pkey32[1];
        const domainSize = pkey32[2];
        const pPolsA = pkey32[3];
        const pPolsB = pkey32[4];
        const pPointsA = pkey32[5];
        const pPointsB1 = pkey32[6];
        const pPointsB2 = pkey32[7];
        const pPointsC = pkey32[8];
        const pHExps = pkey32[9];
        const polsA = pkey.slice(pPolsA, pPolsA + pPolsB);
        const polsB = pkey.slice(pPolsB, pPolsB + pPointsA);
        const pointsA = pkey.slice(pPointsA, pPointsA + nSignals*64);
        const pointsB1 = pkey.slice(pPointsB1, pPointsB1 + nSignals*64);
        const pointsB2 = pkey.slice(pPointsB2, pPointsB2 + nSignals*128);
        const pointsC = pkey.slice(pPointsC, pPointsC + (nSignals-nPublic-1)*64);
        const pointsHExps = pkey.slice(pHExps, pHExps + domainSize*64);

        const alfa1 = pkey.slice(10*4, 10*4 + 64);
        const beta1 = pkey.slice(10*4 + 64, 10*4 + 128);
        const delta1 = pkey.slice(10*4 + 128, 10*4 + 192);
        const beta2 = pkey.slice(10*4 + 192, 10*4 + 320);
        const delta2 = pkey.slice(10*4 + 320, 10*4 + 448);


        const pH = this.calcH(signals.slice(0), polsA, polsB, nSignals, domainSize).then( (h) => {
            return this.g1_multiexp(h, pointsHExps);
        });

        const pA = this.g1_multiexp(signals.slice(0), pointsA);
        const pB1 = this.g1_multiexp(signals.slice(0), pointsB1);
        const pB2 = this.g2_multiexp(signals.slice(0), pointsB2);
        const pC = this.g1_multiexp(signals.slice((nPublic+1)*32), pointsC);

        const res = await Promise.all([pA, pB1, pB2, pC, pH]);

        const pi_a = this.alloc(96);
        const pi_b = this.alloc(192);
        const pi_c = this.alloc(96);
        const pib1 = this.alloc(96);


        this.putBin(pi_a, res[0]);
        this.putBin(pib1, res[1]);
        this.putBin(pi_b, res[2]);
        this.putBin(pi_c, res[3]);

        const pAlfa1 = this.loadPoint1(alfa1);
        const pBeta1 = this.loadPoint1(beta1);
        const pDelta1 = this.loadPoint1(delta1);
        const pBeta2 = this.loadPoint2(beta2);
        const pDelta2 = this.loadPoint2(delta2);


        let rnd = new Uint32Array(8);

        const aux1 = this.alloc(96);
        const aux2 = this.alloc(192);

        window.crypto.getRandomValues(rnd);
        const pr = this.alloc(32);
        this.putBin(pr, rnd);
        // this.instance.exports.frm_normalize(pr);

        window.crypto.getRandomValues(rnd);
        const ps = this.alloc(32);
        this.putBin(ps, rnd);
        // this.instance.exports.frm_normalize(ps);

//this.instance.exports.frm_zero(pr);
//this.instance.exports.frm_zero(ps);


        // pi_a = pi_a + Alfa1 + r*Delta1
        this.instance.exports.g1_add(pAlfa1, pi_a, pi_a);
        // this.instance.exports.g1_mulscalar(pr, pDelta1, 1, 1, aux1);
        this.instance.exports.g1_timesScalar(pDelta1, pr, 32, aux1);
        this.instance.exports.g1_add(aux1, pi_a, pi_a);

        // pi_b = pi_b + Beta2 + s*Delta2
        this.instance.exports.g2_add(pBeta2, pi_b, pi_b);
        this.instance.exports.g2_timesScalar(pDelta2, ps, 32, aux2);
        this.instance.exports.g2_add(aux2, pi_b, pi_b);

        // pib1 = pib1 + Beta1 + s*Delta1
        this.instance.exports.g1_add(pBeta1, pib1, pib1);
        this.instance.exports.g1_timesScalar(pDelta1, ps, 32, aux1);
        this.instance.exports.g1_add(aux1, pib1, pib1);


        // pi_c = pi_c + pH
        this.putBin(aux1, res[4]);
        this.instance.exports.g1_add(aux1, pi_c, pi_c);

        // pi_c = pi_c + s*pi_a
        this.instance.exports.g1_timesScalar(pi_a, ps, 32, aux1);
        this.instance.exports.g1_add(aux1, pi_c, pi_c);

        // pi_c = pi_c + r*pib1
        this.instance.exports.g1_timesScalar(pib1, pr, 32, aux1);
        this.instance.exports.g1_add(aux1, pi_c, pi_c);

        // pi_c = pi_c - r*s*delta1
        const prs = this.alloc(64);
        this.instance.exports.int_mul(pr, ps, prs);
        this.instance.exports.g1_timesScalar(pDelta1, prs, 64, aux1);
        this.instance.exports.g1_neg(aux1, aux1);
        this.instance.exports.g1_add(aux1, pi_c, pi_c);

        this.instance.exports.g1_affine(pi_a, pi_a);
        this.instance.exports.g2_affine(pi_b, pi_b);
        this.instance.exports.g1_affine(pi_c, pi_c);

        this.instance.exports.g1_fromMontgomery(pi_a, pi_a);
        this.instance.exports.g2_fromMontgomery(pi_b, pi_b);
        this.instance.exports.g1_fromMontgomery(pi_c, pi_c);

        return {
            pi_a: this.bin2g1(this.getBin(pi_a, 96)),
            pi_b: this.bin2g2(this.getBin(pi_b, 192)),
            pi_c: this.bin2g1(this.getBin(pi_c, 96)),
        };

    }

}

module.exports = build;

},{"./build_curve.js":4,"./build_f1.js":5,"./build_f1m.js":6,"./build_f2m.js":7,"./build_fft":8,"./build_multiexp":10,"./build_pol":11,"./build_testg1":13,"./utils":17,"./wasmbuilder/index.js":20,"assert":24,"big-integer":2}],17:[function(require,module,exports){
const bigInt = require("big-integer");

exports.bigInt2BytesLE = function bigInt2BytesLE(_a, len) {
    const b = Array(len);
    let v = bigInt(_a);
    for (let i=0; i<len; i++) {
        b[i] = v.and(0xFF).toJSNumber();
        v = v.shiftRight(8);
    }
    return b;
};

exports.bigInt2U32LE = function bigInt2BytesLE(_a, len) {
    const b = Array(len);
    let v = bigInt(_a);
    for (let i=0; i<len; i++) {
        b[i] = v.and(0xFFFFFFFF).toJSNumber();
        v = v.shiftRight(32);
    }
    return b;
};

},{"big-integer":2}],18:[function(require,module,exports){
const utils = require("./utils.js");

class CodeBuilder {
    constructor(func) {
        this.func = func;
        this.functionName = func.functionName;
        this.module = func.module;
    }

    setLocal(localName, valCode) {
        const idx = this.func.localIdxByName[localName];
        if (idx === undefined)
            throw new Error(`Local Variable not defined: Function: ${this.functionName} local: ${localName} `);
        return [...valCode, 0x21, ...utils.varuint32( idx )];
    }

    teeLocal(localName, valCode) {
        const idx = this.func.localIdxByName[localName];
        if (idx === undefined)
            throw new Error(`Local Variable not defined: Function: ${this.functionName} local: ${localName} `);
        return [...valCode, 0x22, ...utils.varuint32( idx )];
    }

    getLocal(localName) {
        const idx = this.func.localIdxByName[localName];
        if (idx === undefined)
            throw new Error(`Local Variable not defined: Function: ${this.functionName} local: ${localName} `);
        return [0x20, ...utils.varuint32( idx )];
    }

    i64_load8_s(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 0 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x30, align, ...utils.varuint32(offset)];
    }

    i64_load8_u(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 0 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x31, align, ...utils.varuint32(offset)];
    }

    i64_load16_s(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 1 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x32, align, ...utils.varuint32(offset)];
    }

    i64_load16_u(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 1 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x33, align, ...utils.varuint32(offset)];
    }

    i64_load32_s(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 2 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x34, align, ...utils.varuint32(offset)];
    }

    i64_load32_u(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 2 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x35, align, ...utils.varuint32(offset)];
    }

    i64_load(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 3 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x29, align, ...utils.varuint32(offset)];
    }

    i64_store32(idxCode, _offset, _align, _codeVal) {
        let offset, align, codeVal;
        if (Array.isArray(_offset)) {
            offset = 0;
            align = 2;
            codeVal = _offset;
        } else if (Array.isArray(_align)) {
            offset = _offset;
            align = 2;
            codeVal = _align;
        } else if (Array.isArray(_codeVal)) {
            offset = _offset;
            align = _align;
            codeVal = _codeVal;
        }
        return [...idxCode, ...codeVal, 0x3e, align, ...utils.varuint32(offset)];
    }

    i64_store(idxCode, _offset, _align, _codeVal) {
        let offset, align, codeVal;
        if (Array.isArray(_offset)) {
            offset = 0;
            align = 3;
            codeVal = _offset;
        } else if (Array.isArray(_align)) {
            offset = _offset;
            align = 3;
            codeVal = _align;
        } else if (Array.isArray(_codeVal)) {
            offset = _offset;
            align = _align;
            codeVal = _codeVal;
        }
        return [...idxCode, ...codeVal, 0x37, align, ...utils.varuint32(offset)];
    }

    i32_load8_s(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 0 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x2c, align, ...utils.varuint32(offset)];
    }

    i32_load8_u(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 0 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x2d, align, ...utils.varuint32(offset)];
    }

    i32_load16_s(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 1 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x2e, align, ...utils.varuint32(offset)];
    }

    i32_load16_u(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 1 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x2f, align, ...utils.varuint32(offset)];
    }

    i32_load(idxCode, _offset, _align) {
        const offset = _offset || 0;
        const align = (_align === undefined) ? 2 : _align;  // 32 bits alignment by default
        return [...idxCode, 0x28, align, ...utils.varuint32(offset)];
    }

    i32_store(idxCode, _offset, _align, _codeVal) {
        let offset, align, codeVal;
        if (Array.isArray(_offset)) {
            offset = 0;
            align = 2;
            codeVal = _offset;
        } else if (Array.isArray(_align)) {
            offset = _offset;
            align = 2;
            codeVal = _align;
        } else if (Array.isArray(_codeVal)) {
            offset = _offset;
            align = _align;
            codeVal = _codeVal;
        }
        return [...idxCode, ...codeVal, 0x36, align, ...utils.varuint32(offset)];
    }


    call(fnName, ...args) {
        const idx = this.module.functionIdxByName[fnName];
        if (idx === undefined)
            throw new Error(`Function not defined: Function: ${fnName}`);
        return [...[].concat(...args), 0x10, ...utils.varuint32(idx)];
    }

    if(condCode, thenCode, elseCode) {
        if (elseCode) {
            return [...condCode, 0x04, 0x40, ...thenCode, 0x05, ...elseCode, 0x0b];
        } else {
            return [...condCode, 0x04, 0x40, ...thenCode, 0x0b];
        }
    }

    block(bCode) { return [0x02, 0x40, ...bCode, 0x0b]; }
    loop(...args) {
        return [0x03, 0x40, ...[].concat(...[...args]), 0x0b];
    }
    br_if(relPath, condCode) { return [...condCode, 0x0d, ...utils.varuint32(relPath)]; }
    br(relPath) { return [0x0c, ...utils.varuint32(relPath)]; }
    ret(rCode) { return [...rCode, 0x0f]; }
    drop(dCode) { return [...dCode,  0x1a]; }

    i64_const(num) { return [0x42, ...utils.varint64(num)]; }
    i32_const(num) { return [0x41, ...utils.varint32(num)]; }


    i64_eqz(opcode) { return [...opcode, 0x50]; }
    i64_eq(op1code, op2code) { return [...op1code, ...op2code, 0x51]; }
    i64_ne(op1code, op2code) { return [...op1code, ...op2code, 0x52]; }
    i64_lt_s(op1code, op2code) { return [...op1code, ...op2code, 0x53]; }
    i64_lt_u(op1code, op2code) { return [...op1code, ...op2code, 0x54]; }
    i64_gt_s(op1code, op2code) { return [...op1code, ...op2code, 0x55]; }
    i64_gt_u(op1code, op2code) { return [...op1code, ...op2code, 0x56]; }
    i64_le_s(op1code, op2code) { return [...op1code, ...op2code, 0x57]; }
    i64_le_u(op1code, op2code) { return [...op1code, ...op2code, 0x58]; }
    i64_ge_s(op1code, op2code) { return [...op1code, ...op2code, 0x59]; }
    i64_ge_u(op1code, op2code) { return [...op1code, ...op2code, 0x5a]; }
    i64_add(op1code, op2code) { return [...op1code, ...op2code, 0x7c]; }
    i64_sub(op1code, op2code) { return [...op1code, ...op2code, 0x7d]; }
    i64_mul(op1code, op2code) { return [...op1code, ...op2code, 0x7e]; }
    i64_div_u(op1code, op2code) { return [...op1code, ...op2code, 0x80]; }
    i64_and(op1code, op2code) { return [...op1code, ...op2code, 0x83]; }
    i64_or(op1code, op2code) { return [...op1code, ...op2code, 0x84]; }
    i64_shl(op1code, op2code) { return [...op1code, ...op2code, 0x86]; }
    i64_shr_s(op1code, op2code) { return [...op1code, ...op2code, 0x87]; }
    i64_shr_u(op1code, op2code) { return [...op1code, ...op2code, 0x88]; }
    i64_extend_i32_u(op1code) { return [...op1code, 0xad]; }


    i32_eqz(op1code) { return [...op1code, 0x45]; }
    i32_eq(op1code, op2code) { return [...op1code, ...op2code, 0x46]; }
    i32_ne(op1code, op2code) { return [...op1code, ...op2code, 0x47]; }
    i32_lt_s(op1code, op2code) { return [...op1code, ...op2code, 0x48]; }
    i32_lt_u(op1code, op2code) { return [...op1code, ...op2code, 0x49]; }
    i32_gt_s(op1code, op2code) { return [...op1code, ...op2code, 0x4a]; }
    i32_gt_u(op1code, op2code) { return [...op1code, ...op2code, 0x4b]; }
    i32_le_s(op1code, op2code) { return [...op1code, ...op2code, 0x4c]; }
    i32_le_u(op1code, op2code) { return [...op1code, ...op2code, 0x4d]; }
    i32_ge_s(op1code, op2code) { return [...op1code, ...op2code, 0x4e]; }
    i32_ge_u(op1code, op2code) { return [...op1code, ...op2code, 0x4f]; }
    i32_add(op1code, op2code) { return [...op1code, ...op2code, 0x6a]; }
    i32_sub(op1code, op2code) { return [...op1code, ...op2code, 0x6b]; }
    i32_mul(op1code, op2code) { return [...op1code, ...op2code, 0x6c]; }
    i32_div_s(op1code, op2code) { return [...op1code, ...op2code, 0x6d]; }
    i32_div_u(op1code, op2code) { return [...op1code, ...op2code, 0x6e]; }
    i32_rem_s(op1code, op2code) { return [...op1code, ...op2code, 0x6f]; }
    i32_rem_u(op1code, op2code) { return [...op1code, ...op2code, 0x70]; }
    i32_and(op1code, op2code) { return [...op1code, ...op2code, 0x71]; }
    i32_or(op1code, op2code) { return [...op1code, ...op2code, 0x72]; }
    i32_shl(op1code, op2code) { return [...op1code, ...op2code, 0x74]; }
    i32_shr_s(op1code, op2code) { return [...op1code, ...op2code, 0x75]; }
    i32_shr_u(op1code, op2code) { return [...op1code, ...op2code, 0x76]; }
    i32_rotl(op1code, op2code) { return [...op1code, ...op2code, 0x77]; }
    i32_rotr(op1code, op2code) { return [...op1code, ...op2code, 0x78]; }
    i32_wrap_i64(op1code) { return [...op1code, 0xa7]; }

    unreachable() { return [ 0x0 ]; }

}

module.exports = CodeBuilder;

},{"./utils.js":22}],19:[function(require,module,exports){

const CodeBuilder = require("./codebuilder.js");
const utils = require("./utils.js");

const typeCodes = {
    "i32": 0x7f,
    "i64": 0x7e,
    "f32": 0x7d,
    "f64": 0x7c,
    "anyfunc": 0x70,
    "func": 0x60,
    "emptyblock": 0x40
};


class FunctionBuilder {

    constructor (module, fnName, fnType, moduleName, fieldName) {
        if (fnType == "import") {
            this.fnType = "import";
            this.moduleName = moduleName;
            this.fieldName = fieldName;
        } else if (fnType == "internal") {
            this.fnType = "internal";
        } else {
            throw new Error("Invalid function fnType: " + fnType);
        }
        this.module = module;
        this.fnName = fnName;
        this.params = [];
        this.locals = [];
        this.localIdxByName = {};
        this.code = [];
        this.returnType = null;
        this.nextLocal =0;
    }

    addParam(paramName, paramType) {
        if (this.localIdxByName[paramName])
            throw new Error(`param already exists. Function: ${this.fnName}, Param: ${paramName} `);
        const idx = this.nextLocal++;
        this.localIdxByName[paramName] = idx;
        this.params.push({
            type: paramType
        });
    }

    addLocal(localName, localType, _length) {
        const length = _length || 1;
        if (this.localIdxByName[localName])
            throw new Error(`local already exists. Function: ${this.fnName}, Param: ${localName} `);
        const idx = this.nextLocal++;
        this.localIdxByName[localName] = idx;
        this.locals.push({
            type: localType,
            length: length
        });
    }

    setReturnType(returnType) {
        if (this.returnType)
            throw new Error(`returnType already defined. Function: ${this.fnName}`);
        this.returnType = returnType;
    }

    getSignature() {
        const params = [...utils.varuint32(this.params.length), ...this.params.map((p) => typeCodes[p.type])];
        const returns = this.returnType ? [0x01, typeCodes[this.returnType]] : [0];
        return [0x60, ...params, ...returns];
    }

    getBody() {
        const locals = this.locals.map((l) => [
            ...utils.varuint32(l.length),
            typeCodes[l.type]
        ]);

        const body = [
            ...utils.varuint32(this.locals.length),
            ...[].concat(...locals),
            ...this.code,
            0x0b
        ];
        return [
            ...utils.varuint32(body.length),
            ...body
        ];
    }

    addCode(...code) {
        this.code.push(...[].concat(...[...code]));
    }

    getCodeBuilder() {
        return new CodeBuilder(this);
    }
}

module.exports = FunctionBuilder;

},{"./codebuilder.js":18,"./utils.js":22}],20:[function(require,module,exports){
module.exports = require("./modulebuilder");

},{"./modulebuilder":21}],21:[function(require,module,exports){


const FunctionBuilder = require("./functionbuilder.js");
const utils = require("./utils.js");

class ModuleBuilder {

    constructor() {
        this.functions = [];
        this.functionIdxByName = {};
        this.nImportFunctions = 0;
        this.nInternalFunctions =0;
        this.memory = {
            pagesSize: 1,
            moduleName: "env",
            fieldName: "memory"
        };
        this.free = 8;
        this.datas = [];
        this.modules = {};
        this.exports = [];
    }

    build() {
        this._setSignatures();
        return new Uint8Array([
            ...utils.u32(0x6d736100),
            ...utils.u32(1),
            ...this._buildType(),
            ...this._buildImport(),
            ...this._buildFunctionDeclarations(),
            ...this._buildExports(),
            ...this._buildCode(),
            ...this._buildData()
        ]);
    }

    addFunction(fnName) {
        if (typeof(this.functionIdxByName[fnName]) !== "undefined")
            throw new Error(`Function already defined: ${fnName}`);

        const idx = this.functions.length;
        this.functionIdxByName[fnName] = idx;

        this.functions.push(new FunctionBuilder(this, fnName, "internal"));

        this.nInternalFunctions++;
        return this.functions[idx];
    }

    addIimportFunction(fnName, moduleName, _fieldName) {
        if (typeof(this.functionIdxByName[fnName]) !== "undefined")
            throw new Error(`Function already defined: ${fnName}`);

        if (  (this.functions.length>0)
            &&(this.functions[this.functions.length-1].type == "internal"))
            throw new Error(`Import functions must be declared before internal: ${fnName}`);

        let fieldName = _fieldName || fnName;

        const idx = this.functions.length;
        this.functionIdxByName[fnName] = idx;

        this.functions.push(new FunctionBuilder(this, fnName, "import", moduleName, fieldName));

        this.nImportFunctions ++;
        return this.functions[idx];
    }

    setMemory(pagesSize, moduleName, fieldName) {
        this.memory = {
            pagesSize: pagesSize,
            moduleName: moduleName || "env",
            fieldName: fieldName || "memory"
        };
    }

    exportFunction(fnName, _exportName) {
        const exportName = _exportName || fnName;
        if (typeof(this.functionIdxByName[fnName]) === "undefined")
            throw new Error(`Function not defined: ${fnName}`);
        const idx = this.functionIdxByName[fnName];
        if (exportName != fnName) {
            this.functionIdxByName[exportName] = idx;
        }
        this.exports.push({
            exportName: exportName,
            idx: idx
        });
    }

    addData(offset, bytes) {
        this.datas.push({
            offset: offset,
            bytes: bytes
        });
    }

    alloc(a, b) {
        let size;
        let bytes;
        if (Array.isArray(a) && (typeof(b) === "undefined")) {
            size = a.length;
            bytes = a;
        } else {
            size = a;
            bytes = b;
        }
        const p = this.free;
        this.free += size;
        if (bytes) {
            this.addData(p, bytes);
        }
        return p;
    }

    _setSignatures() {
        this.signatures = [];
        const signatureIdxByName = {};
        for (let i=0; i<this.functions.length; i++) {
            const signature = this.functions[i].getSignature();
            const signatureName = "s_"+utils.toHexString(signature);
            if (typeof(signatureIdxByName[signatureName]) === "undefined") {
                signatureIdxByName[signatureName] = this.signatures.length;
                this.signatures.push(signature);
            }

            this.functions[i].signatureIdx = signatureIdxByName[signatureName];
        }

    }

    _buildSection(sectionType, section) {
        return [sectionType, ...utils.varuint32(section.length), ...section];
    }

    _buildType() {
        return this._buildSection(
            0x01,
            [
                ...utils.varuint32(this.signatures.length),
                ...[].concat(...this.signatures)
            ]
        );
    }

    _buildImport() {
        const entries = [];
        entries.push([
            ...utils.string(this.memory.moduleName),
            ...utils.string(this.memory.fieldName),
            0x02,
            0x00,   //Flags no init valua
            ...utils.varuint32(this.memory.pagesSize)
        ]);
        for (let i=0; i< this.nImportFunctions; i++) {
            entries.push([
                ...utils.string(this.functions[i].moduleName),
                ...utils.string(this.functions[i].fieldName),
                0x00,
                ...utils.varuint32(this.functions[i].signatureIdx)
            ]);
        }
        return this._buildSection(
            0x02,
            utils.varuint32(entries.length).concat(...entries)
        );
    }

    _buildFunctionDeclarations() {
        const entries = [];
        for (let i=this.nImportFunctions; i< this.nInternalFunctions; i++) {
            entries.push(...utils.varuint32(this.functions[i].signatureIdx));
        }
        return this._buildSection(
            0x03,
            [
                ...utils.varuint32(entries.length),
                ...[...entries]
            ]
        );
    }

    _buildExports() {
        const entries = [];
        for (let i=0; i< this.exports.length; i++) {
            entries.push([
                ...utils.string(this.exports[i].exportName),
                0x00,
                ...utils.varuint32(this.exports[i].idx)
            ]);
        }
        return this._buildSection(
            0x07,
            utils.varuint32(entries.length).concat(...entries)
        );
    }

    _buildCode() {
        const entries = [];
        for (let i=this.nImportFunctions; i< this.nInternalFunctions; i++) {
            entries.push(this.functions[i].getBody());
        }
        return this._buildSection(
            0x0a,
            utils.varuint32(entries.length).concat(...entries)
        );
    }

    _buildData() {
        const entries = [];
        entries.push([
            0x00,
            0x41,
            0x00,
            0x0b,
            0x04,
            ...utils.u32(this.free)
        ]);
        for (let i=0; i< this.datas.length; i++) {
            entries.push([
                0x00,
                0x41,
                ...utils.varint32(this.datas[i].offset),
                0x0b,
                ...utils.varuint32(this.datas[i].bytes.length),
                ...this.datas[i].bytes,
            ]);
        }
        return this._buildSection(
            0x0b,
            utils.varuint32(entries.length).concat(...entries)
        );
    }

}

module.exports = ModuleBuilder;

},{"./functionbuilder.js":19,"./utils.js":22}],22:[function(require,module,exports){
var bigInt = require("big-integer");

function toNumber(n) {
    let v;
    if (typeof n=="string") {
        if (n.slice(0,2).toLowerCase() == "0x") {
            v = bigInt(n.slice(2),16);
        } else {
            v = bigInt(n);
        }
    } else {
        v = bigInt(n);
    }
    return v;
}

function u32(n) {
    const b = [];
    const v = toNumber(n);
    b.push(v.and(0xFF).toJSNumber());
    b.push(v.shiftRight(8).and(0xFF).toJSNumber());
    b.push(v.shiftRight(16).and(0xFF).toJSNumber());
    b.push(v.shiftRight(24).and(0xFF).toJSNumber());
    return b;
}

function u64(n) {
    const b = [];
    const v = toNumber(n);
    b.push(v.and(0xFF).toJSNumber());
    b.push(v.shiftRight(8).and(0xFF).toJSNumber());
    b.push(v.shiftRight(16).and(0xFF).toJSNumber());
    b.push(v.shiftRight(24).and(0xFF).toJSNumber());
    b.push(v.shiftRight(32).and(0xFF).toJSNumber());
    b.push(v.shiftRight(40).and(0xFF).toJSNumber());
    b.push(v.shiftRight(48).and(0xFF).toJSNumber());
    b.push(v.shiftRight(56).and(0xFF).toJSNumber());
    return b;
}

function toUTF8Array(str) {
    var utf8 = [];
    for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6),
                      0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12),
                      0x80 | ((charcode>>6) & 0x3f),
                      0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                      | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >>18),
                      0x80 | ((charcode>>12) & 0x3f),
                      0x80 | ((charcode>>6) & 0x3f),
                      0x80 | (charcode & 0x3f));
        }
    }
    return utf8;
}

function string(str) {
    const bytes = toUTF8Array(str);
    return [ ...varuint32(bytes.length), ...bytes ];
}

function varuint(n) {
    const code = [];
    let v = toNumber(n);
    if (v.isNegative()) throw new Error("Number cannot be negative");
    while (!v.isZero()) {
        code.push(v.and(0x7F).toJSNumber());
        v = v.shiftRight(7);
    }
    if (code.length==0) code.push(0);
    for (let i=0; i<code.length-1; i++) {
        code[i] = code[i] | 0x80;
    }
    return code;
}

function varint(_n) {
    let n, sign;
    const bits = _n.bitLength().toJSNumber();
    if (_n<0) {
        sign = true;
        n = bigInt.one.shiftLeft(bits).add(_n);
    } else {
        sign = false;
        n = toNumber(_n);
    }
    const paddingBits = 7 - (bits % 7);

    const padding = bigInt.one.shiftLeft(paddingBits).minus(1).shiftLeft(bits);
    const paddingMask = ((1 << (7 - paddingBits))-1) | 0x80;

    const code = varuint(n.add(padding));

    if (!sign) {
        code[code.length-1] = code[code.length-1] & paddingMask;
    }

    return code;
}

function varint32(n) {
    let v = toNumber(n);
    if (v.greater(bigInt("FFFFFFFF", 16))) throw new Error("Number too big");
    if (v.greater(bigInt("7FFFFFFF", 16))) v = v.minus(bigInt("100000000",16));
    if (v.lesser(bigInt("-80000000", 16))) throw new Error("Number too small");
    return varint(v);
}

function varint64(n) {
    let v = toNumber(n);
    if (v.greater(bigInt("FFFFFFFFFFFFFFFF", 16))) throw new Error("Number too big");
    if (v.greater(bigInt("7FFFFFFFFFFFFFFF", 16))) v = v.minus(bigInt("10000000000000000",16));
    if (v.lesser(bigInt("-8000000000000000", 16))) throw new Error("Number too small");
    return varint(v);
}

function varuint32(n) {
    let v = toNumber(n);
    if (v.greater(bigInt("FFFFFFFF", 16))) throw new Error("Number too big");
    return varuint(v);
}

function varuint64(n) {
    let v = toNumber(n);
    if (v.greater(bigInt("FFFFFFFFFFFFFFFF", 16))) throw new Error("Number too big");
    return varuint(v);
}

function toHexString(byteArray) {
    return Array.from(byteArray, function(byte) {
        return ("0" + (byte & 0xFF).toString(16)).slice(-2);
    }).join("");
}

module.exports.toNumber = toNumber;
module.exports.u32 = u32;
module.exports.u64 = u64;
module.exports.varuint32 = varuint32;
module.exports.varuint64 = varuint64;
module.exports.varint32 = varint32;
module.exports.varint64 = varint64;
module.exports.string = string;
module.exports.toHexString = toHexString;

},{"big-integer":2}],23:[function(require,module,exports){
/* globals window */

console.log("Loading groth16/1...");
const buildF1 = require("./index.js").buildF1;
const buildBn128 = require("./index.js").buildBn128;
const buildGroth16 = require("./index.js").buildGroth16;
const bigInt = require("big-integer");


buildGroth16().then( (_groth16) => {
    window.groth16 = _groth16;
});




window.bigInt = bigInt;
window.q = bigInt("21888242871839275222246405745257275088696311157297823662689037894645226208583");

buildF1(window.q).then( (_f1) => { window.F1 = _f1; });
buildBn128().then( (_bn128) => {
    window.bn128 = _bn128;
    window.pg = window.bn128.g1_allocPoint(
        [ bigInt(1), bigInt(2), bigInt(1)]
    );
    window.pArr = window.bn128.alloc(32*4);
    for (let i=0; i<4; i++) {
        window.bn128.putInt(window.pArr+i*32, i);
    }

    fetch("proving_key.bin").then( (response) => {
        return response.arrayBuffer();
    }).then( (b) => {
        window.provingKey = b;
        window.pProvingKey = window.bn128.putBin(b);
        window.pPointsA = window.pProvingKey + window.bn128.i32[(window.pProvingKey>>2) + 6];
        window.pPointsB2 = window.pProvingKey + window.bn128.i32[(window.pProvingKey>>2) + 7];
        window.nSignals = window.bn128.i32[(window.pProvingKey>>2)];
    });

    fetch("witness.bin").then( (response) => {
        return response.arrayBuffer();
    }).then( (b) => {
        window.signals = b;
        window.pWitness = window.bn128.putBin(b)+4;
    });

});

window.calcProof = function() {
    const signals =window.signals.slice(4, 4+window.nSignals*32);
    const start = new Date().getTime();

    window.groth16.proof(signals, window.provingKey).then((p)=> {
        const end = new Date().getTime();
        const time = end - start;
        console.log(JSON.stringify(p, null, 1));
        console.log(time);
        document.getElementById("result").innerHTML = time;
    });
};

window.calcPolA = function() {
    const signals =window.signals.slice(4, 4+window.nSignals*32);
    const pkey32 = new Uint32Array(window.provingKey);
    const nSignals = pkey32[0];
    const domainSize = pkey32[2];
    const ppPolsA = pkey32[3];
    const ppPolsB = pkey32[4];
    const ppPolsC = pkey32[5];
    const polsA = window.provingKey.slice(ppPolsA, ppPolsA + ppPolsB);
    const polsB = window.provingKey.slice(ppPolsB, ppPolsB + ppPolsC);


    const pSignals = window.groth16.alloc(signals.byteLength);
    window.groth16.putBin(pSignals, signals);
    const pPolsA = window.groth16.alloc(polsA.byteLength);
    window.groth16.putBin(pPolsA, polsA);
    const pPolsB = window.groth16.alloc(polsB.byteLength);
    window.groth16.putBin(pPolsB, polsB);


    const pSignalsM = window.groth16.alloc(nSignals*32);
    const pPolA = window.groth16.alloc(domainSize*32);
    const pPolB = window.groth16.alloc(domainSize*32);
    const pPolA2 = window.groth16.alloc(domainSize*32*2);
    const pPolB2 = window.groth16.alloc(domainSize*32*2);

    window.groth16.instance.exports.fft_toMontgomeryN(pSignals, pSignalsM, nSignals);

    window.groth16.instance.exports.pol_zero(pPolA, domainSize);
    window.groth16.instance.exports.pol_zero(pPolB, domainSize);

    window.groth16.instance.exports.pol_constructLC(pPolsA, pSignalsM, nSignals, pPolA);
    window.groth16.instance.exports.pol_constructLC(pPolsB, pSignalsM, nSignals, pPolB);

    window.groth16.instance.exports.fft_fromMontgomeryN(pPolA, pPolA, domainSize);

    for (let i=0; i<10; i++) {
        const a = window.groth16.bin2int(window.groth16.getBin(pPolA + i*32, 32));
        console.log(a.toString());
    }
};


window.calcPA_p = function() {
    const witness =window.witness.slice(4, 4+window.nSignals*32);
    const oPointsA = new Uint32Array(window.provingKey)[6];
    const pointsA =window.provingKey.slice(oPointsA, oPointsA + window.nSignals*64);
    window.groth16.g1_multiexp(witness, pointsA).then( function(r) {
        const p1 = window.groth16.g1_affine(r);
        const p2 = window.groth16.g1_fromMontgomery(p1);
        const p = window.groth16.bin2g1(p2);
        console.log(p);
    });
};

window.calcPA = function(_n, _w) {
    const n = _n || window.nSignals;
    const w = _w || 5;
    const pA = window.bn128.alloc(32*3);
    window.bn128.g1_zero(pA);
    window.bn128.g1_multiexp(
        window.pWitness,
        window.pPointsA,
        n,
        w,
        pA
    );
    window.bn128.g1_affine(pA, pA);
    window.bn128.g1_fromMontgomery(pA, pA);
    const res = window.bn128.g1_getPoint(pA);
    console.log(res[0].toString());
    console.log(res[1].toString());
    console.log(res[2].toString());
};


window.calcPB2 = function(_n, _w) {
    const n = _n || window.nSignals;
    const w = _w || 5;
    const pB2 = window.bn128.alloc(32*6);
    window.bn128.g2_zero(pB2);
    window.bn128.g2_multiexp(
        window.pWitness,
        window.pPointsB2,
        n,
        w,
        pB2
    );
    window.bn128.g2_affine(pB2, pB2);
    window.bn128.g2_fromMontgomery(pB2, pB2);
    const res = window.bn128.g2_getPoint(pB2);
    console.log(res[0][0].toString());
    console.log(res[0][1].toString());
    console.log(res[1][0].toString());
    console.log(res[1][1].toString());
    console.log(res[2][0].toString());
    console.log(res[2][1].toString());
};


window.test = function() {

    const t = window.F1.test_F1(100000000);
    document.getElementById("result").innerHTML = t;
};


},{"./index.js":1,"big-integer":2}],24:[function(require,module,exports){
(function (global){
'use strict';

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util/');
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"util/":27}],25:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],26:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],27:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":26,"_process":28,"inherits":25}],28:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[23]);
