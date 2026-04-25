/**
 * woodenfish.js — 木鱼灵宠场景
 */
var WoodenFishScene = (function () {
    'use strict';

    var _merit = 0;
    var _hitAnim = 0;
    var _malletAngle = 0;
    var _time = 0;
    var _ripples = [];
    var _petLevel = 0;
    var _petLevels = [
        { name: '初心', threshold: 0, color: '#ff3b30', glow: '#ff3b30' },
        { name: '虔诚', threshold: 50, color: '#ff8a3d', glow: '#ff8a3d' },
        { name: '慧根', threshold: 200, color: '#4079ff', glow: '#4079ff' },
        { name: '金莲', threshold: 500, color: '#ffcc00', glow: '#ffcc00' },
        { name: '菩提', threshold: 1000, color: '#6d4bff', glow: '#6d4bff' },
        { name: '圆满', threshold: 2000, color: '#ff5482', glow: '#ff5482' }
    ];

    var _touchHandler = null;
    var _unsubscribeMerit = null;

    function init() {
        UI.clearButtons();
        _hitAnim = 0;
        _malletAngle = 0;
        _time = 0;
        _ripples = [];
        _merit = MeritSystem.getPoints();
        _updateLevel();
        _unsubscribeMerit = MeritSystem.onChange(function (points) {
            _merit = points;
            _updateLevel();
        });

        // 返回按钮
        UI.createButton({
            x: 15, y: 15, w: 70, h: 36,
            text: '返回',
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

        var gain = 1;
        MeritSystem.addPoints(gain);

        _hitAnim = 1;
        _malletAngle = -0.5;

        // 飘字
        var W = Engine.width();
        var H = Engine.height();
        Engine.addFloatingText(
            W / 2 + (Math.random() - 0.5) * 40,
            H * 0.32,
            '+' + gain,
            '#FFD700',
            22
        );

        // 波纹
        _ripples.push({ x: W / 2, y: H * 0.48, r: 20, alpha: 0.6, maxR: 100 });

        _updateLevel();

        // 粒子
        if (_merit > 0 && _merit % 10 === 0) {
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
        Draw.drawBackground(ctx, w, h);
        Draw.drawFrame(ctx, w, h);
        Draw.drawPanel(ctx, w * 0.08, h * 0.1, w * 0.84, h * 0.68, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);
        Draw.drawPanel(ctx, w * 0.15, h * 0.8, w * 0.7, h * 0.08, Draw.THEME.panel, Draw.THEME.pink, Draw.THEME.cyan, Draw.THEME.ink);

        var titleW = 200, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.08, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, '功德 ' + _merit, w / 2, h * 0.08 + titleH / 2 + 2, 24, Draw.THEME.gold);

        // 波纹
        for (var ri = _ripples.length - 1; ri >= 0; ri--) {
            var rp = _ripples[ri];
            rp.r += 2;
            rp.alpha -= 0.015;
            if (rp.alpha <= 0) { _ripples.splice(ri, 1); continue; }
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,216,76,' + rp.alpha + ')';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        var level = _petLevels[_petLevel];
        var nextLevel = _petLevels[_petLevel + 1];

        // 光环 — 随等级变色
        Draw.drawHalo(ctx, w / 2, h * 0.48, 110 + _petLevel * 10, level.glow, 0.15 + Math.sin(_time * 2) * 0.05);

        // 木鱼（增加被敲击时的弹性缩放）
        var bounceScale = 1.0;
        if (_hitAnim > 0) {
            bounceScale = 1.0 - _hitAnim * 0.15; // 被敲击时稍微缩小
        }
        var baseScale = 1.2 + _petLevel * 0.05;
        Draw.drawWoodenFish(ctx, w / 2, h * 0.48, baseScale * bounceScale, _hitAnim > 0.1);

        // 木棰
        Draw.drawMallet(ctx, w / 2 + 65, h * 0.38, 0.9, _malletAngle);

        // 灵宠等级
        ctx.save();
        ctx.font = '16px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#24113f';
        ctx.strokeText('境界：' + level.name, w / 2, h * 0.19);
        ctx.fillStyle = level.color;
        ctx.fillText('境界：' + level.name, w / 2, h * 0.19);
        ctx.restore();

        // 进度条
        if (nextLevel) {
            var progress = (_merit - level.threshold) / (nextLevel.threshold - level.threshold);
            var barW = Math.min(w * 0.6, 200);
            UI.drawProgressBar(ctx, (w - barW) / 2, h * 0.22, barW, 6, progress, level.color);
            UI.drawSubtitle(ctx, '下一境界: ' + nextLevel.name + ' (' + nextLevel.threshold + ')', w / 2, h * 0.26, 11, '#63efff');
        } else {
            UI.drawSubtitle(ctx, '像素灵宠已满级', w / 2, h * 0.24, 14, '#ff58b3');
        }

        // 提示
        var tapAlpha = 0.3 + Math.sin(_time * 3) * 0.15;
        UI.drawSubtitle(ctx, '点击敲击木鱼', w / 2, h * 0.72, 14, 'rgba(255,242,193,' + tapAlpha + ')');

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
        if (_unsubscribeMerit) {
            _unsubscribeMerit();
            _unsubscribeMerit = null;
        }
    }

    return {
        init: init,
        destroy: destroy
    };
})();
