/* =========================================================================
 * break_eternity.js —— 本地大数库（Decimal）
 * -------------------------------------------------------------------------
 * 说明：本文件为自包含的 Decimal 实现，提供与 break_eternity.js 兼容的
 * 常用 API（add / mul / pow / log10 / toString / fromString 等），用于把
 * 游戏内所有大数（元数值、发散之力、宇宙奇点、成本、产出、软上限阈值）
 * 统一为 Decimal 类型，避免 Number 参与乘除幂运算的溢出与精度丢失。
 *
 * 表示法（与 break_infinity.js 同构的“层”模型）：
 *   value = sign * 10^(10^(...10^(mag)...))   （共 layer 个 "10^"）
 *   - layer 0：value = sign * mag，mag ∈ [0, EXP_LIMIT]
 *   - layer ≥ 1：mag 为最内层数值，mag ∈ (log10(EXP_LIMIT), EXP_LIMIT]
 * 因此可表示到任意“塔”级（10^^N）的数值。
 *
 * 注：因本环境无法联网下载官方原版（GitHub raw 被拦截、jsDelivr 拒绝
 * JavaScript content-type、pwsh 崩溃），此文件为按官方 API 约定的兼容实现。
 * ======================================================================= */
(function (global) {
  'use strict';

  var EXP_LIMIT = 9e15;                       // 单层可安全表示的幅度上限
  var LAYER_DOWN = Math.log10(EXP_LIMIT);     // ≈15.9542

  function isFiniteNum(x) { return typeof x === 'number' && isFinite(x); }

  /* ------------------------------ 构造器 ------------------------------ */
  function Decimal(value) {
    if (value instanceof Decimal) {
      this.sign = value.sign;
      this.layer = value.layer;
      this.mag = value.mag;
      return;
    }
    if (typeof value === 'number') {
      var d = Decimal.fromNumber(value);
      this.sign = d.sign; this.layer = d.layer; this.mag = d.mag;
      return;
    }
    if (typeof value === 'string') {
      var d2 = Decimal.fromString(value);
      this.sign = d2.sign; this.layer = d2.layer; this.mag = d2.mag;
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      this.sign = (value.sign === -1 || value.sign === 1) ? value.sign : (value.sign === 0 ? 0 : 1);
      this.layer = Math.max(0, Math.floor(Number(value.layer) || 0));
      this.mag = (value.mag == null) ? 0 : Number(value.mag);
      this.normalize();
      return;
    }
    this.sign = 0; this.layer = 0; this.mag = 0;
  }

  /* ------------------------------ 归一化 ------------------------------ */
  Decimal.prototype.normalize = function () {
    if (!isFiniteNum(this.mag)) return this; // Infinity / NaN 保持原样
    if (this.sign === 0) { this.layer = 0; this.mag = 0; return this; }
    // 提升：mag 过大则取 log 进下一层
    while (this.mag > EXP_LIMIT) {
      this.mag = Math.log10(this.mag);
      this.layer += 1;
    }
    // 降层：layer≥1 且 mag 过小（对应值 ≤ EXP_LIMIT）则 10^mag 回到上一层
    while (this.layer >= 1 && this.mag <= LAYER_DOWN) {
      this.mag = Math.pow(10, this.mag);
      this.layer -= 1;
    }
    if (this.layer === 0 && this.mag < 0) this.mag = 0;
    return this;
  };

  /* ------------------------------ 静态工厂 ------------------------------ */
  Decimal.fromNumber = function (n) {
    if (isNaN(n)) return Decimal.dNaN;
    if (n === Infinity) return Decimal.dInf;
    if (n === -Infinity) return Decimal.dNegInf;
    if (n === 0) return Decimal.dZero;
    var d = new Decimal();
    d.sign = n < 0 ? -1 : 1;
    d.layer = 0;
    d.mag = Math.abs(n);
    d.normalize();
    return d;
  };

  Decimal.fromString = function (s) {
    if (typeof s !== 'string') s = String(s);
    s = s.trim();
    if (s === '' || s === 'NaN') return Decimal.dNaN;
    if (s === 'Infinity' || s === 'inf' || s === 'Inf') return Decimal.dInf;
    if (s === '-Infinity' || s === '-inf' || s === '-Inf') return Decimal.dNegInf;
    var sign = 1, i = 0;
    if (s.charAt(0) === '-') { sign = -1; i = 1; }
    else if (s.charAt(0) === '+') { i = 1; }
    var eCount = 0;
    while (i < s.length && (s.charAt(i) === 'e' || s.charAt(i) === 'E')) { eCount++; i++; }
    var rest = s.slice(i);
    if (eCount > 0) {
      var inner = Decimal.fromString(rest);
      if (Decimal.isNaN(inner)) return Decimal.dNaN;
      var result = inner;
      for (var k = 0; k < eCount; k++) result = Decimal.pow(Decimal.dTen, result);
      return sign < 0 ? result.neg() : result;
    }
    // 普通数字 / 科学计数法（1.23e45、1e768 等，避免 parseFloat 溢出）
    var m = rest.match(/^(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?$/);
    if (!m) return Decimal.dNaN;
    var mant = parseFloat(m[1]);
    if (isNaN(mant)) return Decimal.dNaN;
    if (m[2] !== undefined && m[2] !== '') {
      var exp = parseInt(m[2], 10);
      var v = Decimal.fromNumber(mant).mul(Decimal.pow(Decimal.dTen, Decimal.fromNumber(exp)));
      return sign < 0 ? v.neg() : v;
    }
    return Decimal.fromNumber(sign * mant);
  };

  Decimal.fromComponents = function (sign, layer, mag) {
    var d = new Decimal();
    d.sign = sign < 0 ? -1 : (sign === 0 ? 0 : 1);
    d.layer = Math.max(0, Math.floor(Number(layer) || 0));
    d.mag = (mag == null || mag === '') ? 0 : Number(mag);
    d.normalize();
    return d;
  };

  Decimal.abs = function (x) { return x.abs(); };
  Decimal.neg = function (x) { return x.neg(); };
  Decimal.add = function (a, b) { return ensure(a).add(ensure(b)); };
  Decimal.sub = function (a, b) { return ensure(a).sub(ensure(b)); };
  Decimal.mul = function (a, b) { return ensure(a).mul(ensure(b)); };
  Decimal.div = function (a, b) { return ensure(a).div(ensure(b)); };
  Decimal.pow = function (base, exp) { return ensure(base).pow(ensure(exp)); };
  Decimal.log10 = function (x) { return ensure(x).log10(); };
  Decimal.cmp = function (a, b) { return cmp(ensure(a), ensure(b)); };
  Decimal.cmpAbs = function (a, b) { return cmpAbs(ensure(a), ensure(b)); };
  Decimal.max = function (a, b) { return Decimal.cmp(a, b) >= 0 ? ensure(a) : ensure(b); };
  Decimal.min = function (a, b) { return Decimal.cmp(a, b) <= 0 ? ensure(a) : ensure(b); };

  function ensure(x) {
    if (x instanceof Decimal) return x;
    if (typeof x === 'number' || typeof x === 'string') return new Decimal(x);
    return Decimal.dNaN;
  }

  /* ------------------------------ 判断 ------------------------------ */
  Decimal.isNaN = function (d) {
    if (!(d instanceof Decimal)) return true;
    return isNaN(d.mag);
  };
  Decimal.isInfinity = function (d) {
    if (!(d instanceof Decimal)) return false;
    return d.layer === 0 && d.mag === Infinity;
  };

  Decimal.prototype.isNan = function () { return isNaN(this.mag); };
  Decimal.prototype.isFinite = function () { return !isNaN(this.mag) && this.mag !== Infinity; };

  /* ------------------------------ 比较 ------------------------------ */
  function cmpAbs(a, b) {
    if (a.sign === 0 && b.sign === 0) return 0;
    if (a.sign === 0) return -1;
    if (b.sign === 0) return 1;
    if (a.mag === Infinity) return b.mag === Infinity ? 0 : 1;
    if (b.mag === Infinity) return -1;
    if (a.layer !== b.layer) return a.layer > b.layer ? 1 : -1;
    return a.mag > b.mag ? 1 : (a.mag < b.mag ? -1 : 0);
  }

  function cmp(a, b) {
    if (isNaN(a.mag) || isNaN(b.mag)) return NaN;
    if (a.sign === b.sign) {
      if (a.sign === 0) return 0;
      var c = cmpAbs(a, b);
      return a.sign > 0 ? c : -c;
    }
    return a.sign > b.sign ? 1 : -1;
  }

  Decimal.prototype.cmp = function (o) { return cmp(this, ensure(o)); };
  Decimal.prototype.cmpAbs = function (o) { return cmpAbs(this, ensure(o)); };
  Decimal.prototype.eq = function (o) { return cmp(this, ensure(o)) === 0; };
  Decimal.prototype.neq = function (o) { return cmp(this, ensure(o)) !== 0; };
  Decimal.prototype.lt = function (o) { return cmp(this, ensure(o)) < 0; };
  Decimal.prototype.lte = function (o) { return cmp(this, ensure(o)) <= 0; };
  Decimal.prototype.gt = function (o) { return cmp(this, ensure(o)) > 0; };
  Decimal.prototype.gte = function (o) { return cmp(this, ensure(o)) >= 0; };
  Decimal.prototype.max = function (o) { return Decimal.max(this, ensure(o)); };
  Decimal.prototype.min = function (o) { return Decimal.min(this, ensure(o)); };

  /* ------------------------------ 一元 ------------------------------ */
  Decimal.prototype.abs = function () {
    if (this.sign === 0) return Decimal.dZero;
    return Decimal.fromComponents(1, this.layer, this.mag);
  };
  Decimal.prototype.neg = function () {
    if (this.sign === 0) return Decimal.dZero;
    return Decimal.fromComponents(-this.sign, this.layer, this.mag);
  };
  Decimal.prototype.negate = Decimal.prototype.neg;

  Decimal.prototype.log10 = function () {
    if (this.sign === 0) return Decimal.dNegInf;
    if (this.mag === Infinity) return Decimal.dInf;
    var m = this.abs();
    if (m.layer === 0) {
      return Decimal.fromNumber(Math.log10(m.mag));
    }
    return Decimal.fromComponents(1, m.layer - 1, m.mag);
  };

  Decimal.prototype.floor = function () {
    if (this.sign === 0 || this.mag === Infinity || isNaN(this.mag)) return new Decimal(this);
    if (this.layer === 0) return Decimal.fromNumber(Math.floor(this.sign * this.mag));
    return new Decimal(this);
  };

  Decimal.prototype.toNumber = function () {
    if (isNaN(this.mag)) return NaN;
    if (this.mag === Infinity) return this.sign * Infinity;
    if (this.layer === 0) return this.sign * this.mag;
    return this.sign * Infinity;
  };

  Decimal.prototype.valueOf = function () { return this.toNumber(); };

  /* ------------------------------ 加减 ------------------------------ */
  function addAbsLm(a, b) {
    // 返回 |a|+|b| 的 {layer, mag}（a、b 均为正）
    if (a.layer !== b.layer) {
      return a.layer > b.layer ? { layer: a.layer, mag: a.mag } : { layer: b.layer, mag: b.mag };
    }
    if (a.layer === 0) return { layer: 0, mag: a.mag + b.mag };
    if (a.mag > b.mag) return { layer: a.layer, mag: a.mag };
    if (b.mag > a.mag) return { layer: b.layer, mag: b.mag };
    // 完全相等：|a|+|b| = 2*|a|
    if (a.layer === 1) return { layer: 1, mag: a.mag + Math.log10(2) };
    return { layer: a.layer, mag: a.mag };
  }

  function subAbsLm(a, b) {
    // 返回 |a|-|b| 的 {layer, mag}（a > b > 0）
    if (a.layer !== b.layer) {
      return { layer: a.layer, mag: a.mag }; // b 相对可忽略
    }
    if (a.layer === 0) return { layer: 0, mag: a.mag - b.mag };
    if (a.mag === b.mag) return { layer: 0, mag: 0 };
    var dm = a.mag - b.mag;
    if (a.layer === 1) {
      var factor = 1 - Math.pow(10, -dm);
      if (factor <= 0) return { layer: 0, mag: 0 };
      return { layer: 1, mag: a.mag + Math.log10(factor) };
    }
    // layer ≥ 2：b 相对 a 可忽略（除非 mag 几乎相等，此时差异极小，近似即可）
    return { layer: a.layer, mag: a.mag };
  }

  Decimal.prototype.add = function (o) {
    o = ensure(o);
    if (isNaN(this.mag) || isNaN(o.mag)) return Decimal.dNaN;
    if (this.sign === 0) return o;
    if (o.sign === 0) return this;
    if (this.mag === Infinity || o.mag === Infinity) {
      if (this.mag === Infinity && o.mag === Infinity && this.sign !== o.sign) return Decimal.dNaN;
      return this.mag === Infinity ? this : o;
    }
    if (this.sign === o.sign) {
      var lm = addAbsLm(this.abs(), o.abs());
      return Decimal.fromComponents(this.sign, lm.layer, lm.mag);
    }
    var c = cmpAbs(this, o);
    if (c === 0) return Decimal.dZero;
    if (c > 0) {
      var lm2 = subAbsLm(this.abs(), o.abs());
      return Decimal.fromComponents(this.sign, lm2.layer, lm2.mag);
    }
    var lm3 = subAbsLm(o.abs(), this.abs());
    return Decimal.fromComponents(o.sign, lm3.layer, lm3.mag);
  };

  Decimal.prototype.sub = function (o) {
    return this.add(ensure(o).neg());
  };

  /* ------------------------------ 乘除 ------------------------------ */
  Decimal.prototype.mul = function (o) {
    o = ensure(o);
    if (isNaN(this.mag) || isNaN(o.mag)) return Decimal.dNaN;
    if (this.sign === 0 || o.sign === 0) return Decimal.dZero;
    if (this.mag === Infinity || o.mag === Infinity) {
      return this.sign * o.sign > 0 ? Decimal.dInf : Decimal.dNegInf;
    }
    var sign = this.sign * o.sign;
    var res = pow10(this.log10().add(o.log10()));
    return sign < 0 ? res.neg() : res;
  };

  Decimal.prototype.div = function (o) {
    o = ensure(o);
    if (isNaN(this.mag) || isNaN(o.mag)) return Decimal.dNaN;
    if (o.sign === 0) return this.sign === 0 ? Decimal.dNaN : (this.sign > 0 ? Decimal.dInf : Decimal.dNegInf);
    if (this.sign === 0) return Decimal.dZero;
    if (this.mag === Infinity) return o.mag === Infinity ? Decimal.dNaN : this;
    if (o.mag === Infinity) return Decimal.dZero;
    var sign = this.sign * o.sign;
    var res = pow10(this.log10().sub(o.log10()));
    return sign < 0 ? res.neg() : res;
  };

  Decimal.prototype.recip = function () {
    if (isNaN(this.mag)) return Decimal.dNaN;
    if (this.sign === 0) return Decimal.dInf;
    if (this.mag === Infinity) return Decimal.dZero;
    var r = pow10(this.log10().neg());
    return this.sign < 0 ? r.neg() : r;
  };

  /* ------------------------------ 幂 ------------------------------ */
  function pow10(x) {
    // 返回 10^x
    if (isNaN(x.mag)) return Decimal.dNaN;
    if (x.sign === 0) return Decimal.dOne;
    if (x.mag === Infinity) return x.sign > 0 ? Decimal.dInf : Decimal.dZero;
    if (x.sign > 0) {
      return Decimal.fromComponents(1, x.layer + 1, x.mag);
    }
    // x 为负：10^x = 10^-|x|。直接计算，避免与 recip 相互递归导致栈溢出。
    var ax = x.abs();
    if (ax.layer === 0) {
      if (ax.mag >= 308) return Decimal.dZero; // 下溢
      return Decimal.fromNumber(Math.pow(10, -ax.mag));
    }
    return Decimal.dZero; // |x| ≥ 10^15.95，10^-|x| 早已下溢为 0
  }

  Decimal.prototype.pow = function (exp) {
    exp = ensure(exp);
    if (isNaN(this.mag) || isNaN(exp.mag)) return Decimal.dNaN;
    if (exp.sign === 0) return Decimal.dOne;
    if (this.sign === 0) return exp.sign > 0 ? Decimal.dZero : Decimal.dNaN;
    if (this.eq(Decimal.dTen)) return pow10(exp);
    // 通用：base^exp = 10^(exp * log10(|base|))
    // 简化：游戏内仅对正底数使用 pow；负底数按指数奇偶近似取符号
    var sign = 1;
    if (this.sign < 0) {
      var half = exp.div(2);
      var isOdd = exp.floor().eq(exp) && !half.eq(half.floor());
      sign = isOdd ? -1 : 1;
    }
    var r = pow10(exp.mul(this.abs().log10()));
    return sign < 0 ? r.neg() : r;
  };

  Decimal.prototype.sqrt = function () {
    if (this.sign < 0) return Decimal.dNaN;
    return this.pow(new Decimal(0.5));
  };

  /* ------------------------------ toString ------------------------------ */
  function expToString(L, m) {
    if (!isFiniteNum(L) || L < 0) L = 0;
    if (L > 1000) L = 1000; // 防御：避免异常层数导致深递归
    var s = String(m);
    for (var i = 0; i < L; i++) s = 'e' + s;
    return s;
  }

  Decimal.prototype.toString = function () {
    if (isNaN(this.mag)) return 'NaN';
    if (this.mag === Infinity) return this.sign < 0 ? '-Infinity' : 'Infinity';
    if (this.sign === 0) return '0';
    var s = this.sign < 0 ? '-' : '';
    if (this.layer === 0) return s + String(this.mag);
    return s + 'e' + expToString(this.layer - 1, this.mag);
  };

  Decimal.prototype.toJSON = function () { return this.toString(); };

  /* ------------------------------ 常量 ------------------------------ */
  Decimal.dZero = Decimal.fromComponents(0, 0, 0);
  Decimal.dOne = Decimal.fromNumber(1);
  Decimal.dNegOne = Decimal.fromNumber(-1);
  Decimal.dTen = Decimal.fromNumber(10);
  Decimal.dTwo = Decimal.fromNumber(2);
  Decimal.dHalf = Decimal.fromNumber(0.5);
  Decimal.dInf = Decimal.fromComponents(1, 0, Infinity);
  Decimal.dNegInf = Decimal.fromComponents(-1, 0, Infinity);
  Decimal.dNaN = Decimal.fromComponents(0, 0, NaN);
  Decimal.dMaxValue = Decimal.fromNumber(Number.MAX_VALUE); // ≈1.797e308

  // 供指纹校验使用的原型方法必须是真实函数（不可枚举覆盖）
  Decimal.prototype.add;
  Decimal.prototype.mul;
  Decimal.prototype.pow;
  Decimal.prototype.log10;
  Decimal.prototype.toString;

  global.Decimal = Decimal;
})(window);
