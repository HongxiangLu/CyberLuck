/**
 * engine.js — Canvas 渲染引擎、自适应、粒子系统
 */
var Engine = (function () {
    'use strict';

    var canvas, ctx;
    var W = 0, H = 0, DPR = 1;
    var particles = [];
    var floatingTexts = [];
    var animationId = null;
    var currentRender = null;

    /** 初始化 Canvas */
    function init() {
        canvas = document.getElementById('mainCanvas');
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        DPR = Math.min(window.devicePixelRatio || 1, 3);
        _resize();
        window.addEventListener('resize', _resize);
    }

    function _resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.imageSmoothingEnabled = false;
    }

    function width() { return W; }
    function height() { return H; }
    function getCtx() { return ctx; }
    function getCanvas() { return canvas; }

    /** 主渲染循环 */
    function startLoop(renderFn) {
        currentRender = renderFn;
        if (animationId) cancelAnimationFrame(animationId);
        function loop() {
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, W, H);
            if (currentRender) currentRender(ctx, W, H);
            _updateParticles(ctx);
            _updateFloatingTexts(ctx);
            animationId = requestAnimationFrame(loop);
        }
        loop();
    }

    function stopLoop() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        currentRender = null;
    }

    /* ====== 粒子系统 ====== */
    function addParticle(x, y, color, opts) {
        opts = opts || {};
        var count = opts.count || 12;
        for (var i = 0; i < count; i++) {
            var angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            var speed = (opts.speed || 3) * (0.5 + Math.random());
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                r: opts.radius || (2 + Math.random() * 3),
                color: color,
                alpha: 1,
                decay: opts.decay || (0.015 + Math.random() * 0.01),
                gravity: opts.gravity || 0
            });
        }
    }

    /** 金光爆发特效 */
    function addGoldBurst(x, y) {
        var golds = ['#FFD700', '#FFA500', '#FFEC8B', '#FF8C00', '#FFE4B5'];
        for (var i = 0; i < 30; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 2 + Math.random() * 5;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                r: 1.5 + Math.random() * 3,
                color: golds[Math.floor(Math.random() * golds.length)],
                alpha: 1,
                decay: 0.01 + Math.random() * 0.01,
                gravity: 0.05
            });
        }
    }

    function _updateParticles(ctx) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.alpha -= p.decay;
            if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = _colorWithAlpha(p.color, p.alpha);
            ctx.fill();
        }
    }

    /* ====== 飘字系统 ====== */
    function addFloatingText(x, y, text, color, size) {
        floatingTexts.push({
            x: x, y: y,
            text: text,
            color: color || '#FFD700',
            size: size || 24,
            alpha: 1,
            vy: -0.8 // 降低上升速度，原本是 -2
        });
    }

    function _updateFloatingTexts(ctx) {
        for (var i = floatingTexts.length - 1; i >= 0; i--) {
            var ft = floatingTexts[i];
            ft.y += ft.vy;
            ft.alpha -= 0.006; // 减缓透明度衰减，原本是 0.015
            if (ft.alpha <= 0) {
                floatingTexts.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.font = ft.size + 'px "PoxiaoPixel"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.lineWidth = Math.max(2, Math.floor(ft.size / 7));
            ctx.strokeStyle = _colorWithAlpha('#2b124c', ft.alpha);
            ctx.strokeText(ft.text, ft.x, ft.y);
            ctx.fillStyle = _colorWithAlpha(ft.color, ft.alpha);
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }
    }

    function _colorWithAlpha(color, alpha) {
        if (color.charAt(0) === '#') {
            if (color.length === 4) {
                color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
            }
            var r = parseInt(color.slice(1, 3), 16);
            var g = parseInt(color.slice(3, 5), 16);
            var b = parseInt(color.slice(5, 7), 16);
            return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
        }
        return color;
    }

    /** 场景过渡（淡入） */
    function fadeIn(duration, callback) {
        var start = performance.now();
        var overlay = { alpha: 1 };
        var oldRender = currentRender;
        function fadeRender(ctx, w, h) {
            if (oldRender) oldRender(ctx, w, h);
            ctx.fillStyle = 'rgba(10,10,26,' + overlay.alpha + ')';
            ctx.fillRect(0, 0, w, h);
            var elapsed = performance.now() - start;
            overlay.alpha = Math.max(0, 1 - elapsed / (duration || 500));
            if (overlay.alpha <= 0 && callback) {
                callback();
            }
        }
        currentRender = fadeRender;
    }

    return {
        init: init,
        width: width,
        height: height,
        getCtx: getCtx,
        getCanvas: getCanvas,
        startLoop: startLoop,
        stopLoop: stopLoop,
        addParticle: addParticle,
        addGoldBurst: addGoldBurst,
        addFloatingText: addFloatingText,
        fadeIn: fadeIn
    };
})();
