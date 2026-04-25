/**
 * woodenfish.js — 木鱼灵宠场景
 */
var WoodenFishScene = (function () {
    'use strict';

    var _merit = 0;
    var _totalMerit = 0;
    var _hitAnim = 0;
    var _malletAngle = 0;
    var _time = 0;
    var _ripples = [];
    var _petLevel = 0;
    var _petLevels = [
        { name: '初心', threshold: 0, color: '#8B8B8B', glow: '#666' },
        { name: '虔诚', threshold: 50, color: '#CD853F', glow: '#A0522D' },
        { name: '慧根', threshold: 200, color: '#4169E1', glow: '#1E90FF' },
        { name: '金莲', threshold: 500, color: '#FFD700', glow: '#FFA500' },
        { name: '菩提', threshold: 1000, color: '#9370DB', glow: '#8A2BE2' },
        { name: '圆满', threshold: 2000, color: '#FF69B4', glow: '#FF1493' }
    ];

    var _touchHandler = null;

    function init() {
        UI.clearButtons();
        _hitAnim = 0;
        _malletAngle = 0;
        _time = 0;
        _ripples = [];

        // 从 localStorage 读取
        try {
            _totalMerit = parseInt(localStorage.getItem('woodenfish_merit') || '0', 10);
        } catch (e) { _totalMerit = 0; }
        _merit = _totalMerit;
        _updateLevel();

        // 返回按钮
        UI.createButton({
            x: 15, y: 15, w: 70, h: 36,
            text: '← 返回',
            color: 'rgba(255,255,255,0.7)',
            bgColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.15)',
            fontSize: 13, radius: 18,
            onClick: function () { App.switchScene('home'); }
        });

        _bindTouch();
        Engine.startLoop(render);
    }

    function _bindTouch() {
        var canvas = Engine.getCanvas();
        _touchHandler = function (e) {
            if (e.type === 'touchstart') e.preventDefault();
            _doHit();
        };
        canvas.addEventListener('touchstart', _touchHandler, { passive: false });
        canvas.addEventListener('mousedown', _touchHandler);
    }

    function _doHit() {
        Audio.init();
        Audio.playWoodHit();
        Device.tapVibrate();

        _merit++;
        _totalMerit = _merit;
        try { localStorage.setItem('woodenfish_merit', String(_totalMerit)); } catch (e) {}

        _hitAnim = 1;
        _malletAngle = -0.5;

        // 飘字
        var W = Engine.width();
        var H = Engine.height();
        Engine.addFloatingText(
            W / 2 + (Math.random() - 0.5) * 40,
            H * 0.32,
            '功德 +1',
            '#FFD700',
            22
        );

        // 波纹
        _ripples.push({ x: W / 2, y: H * 0.48, r: 20, alpha: 0.6, maxR: 100 });

        _updateLevel();

        // 粒子
        if (_merit % 10 === 0) {
            Engine.addGoldBurst(W / 2, H * 0.45);
        }
    }

    function _updateLevel() {
        _petLevel = 0;
        for (var i = _petLevels.length - 1; i >= 0; i--) {
            if (_merit >= _petLevels[i].threshold) {
                _petLevel = i;
                break;
            }
        }
    }

    function render(ctx, w, h) {
        _time += 0.016;

        // 衰减动画
        if (_hitAnim > 0) _hitAnim *= 0.9;
        if (_hitAnim < 0.01) _hitAnim = 0;
        if (_malletAngle < 0) _malletAngle += 0.06;
        if (_malletAngle > 0) _malletAngle = 0;

        // 背景
        Draw.drawBackground(ctx, w, h, '#0d0d1a', '#1a0d0d');

        // 波纹
        for (var ri = _ripples.length - 1; ri >= 0; ri--) {
            var rp = _ripples[ri];
            rp.r += 2;
            rp.alpha -= 0.015;
            if (rp.alpha <= 0) { _ripples.splice(ri, 1); continue; }
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,215,0,' + rp.alpha + ')';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        var level = _petLevels[_petLevel];
        var nextLevel = _petLevels[_petLevel + 1];

        // 光环 — 随等级变色
        Draw.drawHalo(ctx, w / 2, h * 0.48, 110 + _petLevel * 10, level.glow, 0.15 + Math.sin(_time * 2) * 0.05);

        // 木鱼
        Draw.drawWoodenFish(ctx, w / 2, h * 0.48, 1.2 + _petLevel * 0.05, _hitAnim > 0.1);

        // 木棰
        Draw.drawMallet(ctx, w / 2 + 65, h * 0.38, 0.9, _malletAngle);

        // 功德计数
        UI.drawTitle(ctx, '功德 ' + _merit, w / 2, h * 0.12, 28, '#FFD700');

        // 灵宠等级
        ctx.save();
        ctx.font = 'bold 16px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = level.color;
        ctx.fillText('境界：' + level.name, w / 2, h * 0.19);
        ctx.restore();

        // 进度条
        if (nextLevel) {
            var progress = (_merit - level.threshold) / (nextLevel.threshold - level.threshold);
            var barW = Math.min(w * 0.6, 200);
            UI.drawProgressBar(ctx, (w - barW) / 2, h * 0.22, barW, 6, progress, level.color);
            UI.drawSubtitle(ctx, '下一境界: ' + nextLevel.name + ' (' + nextLevel.threshold + ')', w / 2, h * 0.26, 11, 'rgba(255,255,255,0.3)');
        } else {
            UI.drawSubtitle(ctx, '✨ 已臻圆满 ✨', w / 2, h * 0.24, 14, '#FF69B4');
        }

        // 提示
        var tapAlpha = 0.3 + Math.sin(_time * 3) * 0.15;
        UI.drawSubtitle(ctx, '点击敲击木鱼', w / 2, h * 0.72, 14, 'rgba(255,255,255,' + tapAlpha + ')');

        // 流光粒子环绕
        if (_petLevel >= 2) {
            for (var pi = 0; pi < 3; pi++) {
                var angle = _time * (1 + pi * 0.3) + pi * Math.PI * 2 / 3;
                var px = w / 2 + Math.cos(angle) * (90 + _petLevel * 8);
                var py = h * 0.48 + Math.sin(angle) * (60 + _petLevel * 5);
                ctx.beginPath();
                ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fillStyle = level.color;
                ctx.fill();
            }
        }

        UI.drawButtons(ctx);
    }

    function destroy() {
        UI.clearButtons();
        var canvas = Engine.getCanvas();
        if (_touchHandler) {
            canvas.removeEventListener('touchstart', _touchHandler);
            canvas.removeEventListener('mousedown', _touchHandler);
        }
        _touchHandler = null;
    }

    return {
        init: init,
        destroy: destroy
    };
})();
