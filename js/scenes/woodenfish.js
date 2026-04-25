/**
 * woodenfish.js — 木鱼灵宠场景
 */
var WoodenFishScene = (function () {
    'use strict';

    var _merit = 0;
    var _hitAnim = 0;
    var _malletAngle = 0;
    var _time = 0;
    var _petLevel = 0;
    var _currentFish = 0;
    var _effects = [];
    var _touchHandler = null;
    var _unsubscribeMerit = null;
    var _assetsLoaded = false;
    var _assets = {};
    var _petLevels = [
        { name: '初心', threshold: 0, color: '#ff3b30', glow: '#ff3b30' },
        { name: '虔诚', threshold: 50, color: '#ff8a3d', glow: '#ff8a3d' },
        { name: '慧根', threshold: 200, color: '#4079ff', glow: '#4079ff' },
        { name: '金莲', threshold: 500, color: '#ffcc00', glow: '#ffcc00' },
        { name: '菩提', threshold: 1000, color: '#6d4bff', glow: '#6d4bff' },
        { name: '圆满', threshold: 2000, color: '#ff5482', glow: '#ff5482' }
    ];
    var _fishTypes = [
        {
            name: '福焰木鱼',
            hint: '一敲即炸金焰像素',
            imageKey: 'fishFlame',
            glow: '#ff8a00',
            accent: '#ffd84c',
            effect: 'flame',
            imgScale: 1.1
        },
        {
            name: '霓闪木鱼',
            hint: '自带赛博电弧回路',
            imageKey: 'fishStorm',
            glow: '#63efff',
            accent: '#8fe6ff',
            effect: 'storm',
            imgScale: 1.08
        },
        {
            name: '莲相木鱼',
            hint: '敲出花瓣与星屑',
            imageKey: 'fishLotus',
            glow: '#ff58b3',
            accent: '#ffe08a',
            effect: 'lotus',
            imgScale: 1.08
        },
        {
            name: '经典木鱼',
            hint: '保留最初的像素功德感',
            imageKey: null,
            glow: '#ff8a3d',
            accent: '#ffd84c',
            effect: 'classic',
            imgScale: 1
        }
    ];

    function init() {
        UI.clearButtons();
        _hitAnim = 0;
        _malletAngle = 0;
        _time = 0;
        _effects = [];
        _merit = MeritSystem.getPoints();
        _updateLevel();
        _preloadAssets();
        _setupButtons();
        _unsubscribeMerit = MeritSystem.onChange(function (points) {
            _merit = points;
            _updateLevel();
        });
        _bindTouch();
        Engine.startLoop(render);
    }

    function _preloadAssets() {
        if (_assetsLoaded) return;
        _assetsLoaded = true;
        _loadImage('fishFlame', './fish.png');
        _loadImage('fishStorm', './fish0.png');
        _loadImage('fishLotus', './fish2.png');
        _loadImage('striker', './striker.png');
    }

    function _loadImage(key, src) {
        var img = new Image();
        img.onload = function () {
            _assets[key] = img;
        };
        img.onerror = function () {
            _assets[key] = null;
        };
        img.src = src;
    }

    function _setupButtons() {
        UI.clearButtons();
        UI.createButton({
            x: 15, y: 15, w: 78, h: 40,
            text: '返回',
            color: 'rgba(255,255,255,0.7)',
            bgColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.15)',
            fontSize: 13, radius: 18,
            onClick: function () { App.switchScene('home'); }
        });
        UI.createButton({
            x: Math.max(15, Engine.width() - 112),
            y: 15,
            w: 96,
            h: 40,
            text: '切换木鱼',
            color: '#63efff',
            bgColor: 'rgba(99,239,255,0.12)',
            borderColor: 'rgba(99,239,255,0.42)',
            fontSize: 12,
            radius: 18,
            onClick: function () {
                Audio.playTap();
                _currentFish = (_currentFish + 1) % _fishTypes.length;
                Device.tapVibrate();
                MeritSystem.showToast('已切换为 ' + _fishTypes[_currentFish].name, 'success');
            }
        });
    }

    function _bindTouch() {
        var canvas = Engine.getCanvas();
        _touchHandler = function (e) {
            var point = _getPointFromEvent(e);
            if (!point || !_isFishHit(point.x, point.y)) return;
            if (e.type === 'touchstart') e.preventDefault();
            _doHit(point.x, point.y);
        };
        canvas.addEventListener('touchstart', _touchHandler, { passive: false });
        canvas.addEventListener('mousedown', _touchHandler);
    }

    function _getPointFromEvent(e) {
        var canvas = Engine.getCanvas();
        var rect = canvas.getBoundingClientRect();
        var touch = e.touches ? e.touches[0] : e;
        if (!touch) return null;
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }

    function _isFishHit(x, y) {
        var W = Engine.width();
        var H = Engine.height();
        var cx = W / 2;
        var cy = H * 0.49;
        var fish = _fishTypes[_currentFish];
        var baseScale = 1.12 + _petLevel * 0.04;
        var rx = (fish.imageKey ? 88 : 78) * baseScale * fish.imgScale;
        var ry = (fish.imageKey ? 64 : 58) * baseScale * fish.imgScale;
        var dx = x - cx;
        var dy = y - cy;
        return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.16;
    }

    function _doHit(hitX, hitY) {
        Audio.init();
        Audio.playWoodHit();
        Device.tapVibrate();

        var nextMerit = _merit + 1;
        MeritSystem.addPoints(1);
        _hitAnim = 1;
        _malletAngle = -0.58;

        var W = Engine.width();
        var H = Engine.height();
        var fish = _fishTypes[_currentFish];

        Engine.addFloatingText(
            W / 2 + (Math.random() - 0.5) * 44,
            H * 0.31,
            '+1',
            fish.accent,
            22
        );

        _spawnHitEffect(fish.effect, hitX || W / 2, hitY || H * 0.48);
        _updateLevel();

        if (nextMerit > 0 && nextMerit % 10 === 0) {
            Engine.addGoldBurst(W / 2, H * 0.45, {
                count: 22,
                speed: 3.6,
                ringRadius: 38,
                upwardLift: 0.6,
                flashCoreRadius: 10,
                flashHaloRadius: 18
            });
        }
    }

    function _spawnHitEffect(type, x, y) {
        var i;
        if (type === 'flame') {
            _pushRing(x, y, '#ffd84c', 28, 2.6, 0.06, 4);
            for (i = 0; i < 18; i++) {
                _effects.push({
                    kind: 'pixel',
                    x: x + (Math.random() - 0.5) * 18,
                    y: y + (Math.random() - 0.5) * 12,
                    vx: (Math.random() - 0.5) * 2.8,
                    vy: -1.8 - Math.random() * 2.2,
                    gravity: 0.06,
                    size: 4 + Math.floor(Math.random() * 4),
                    color: i % 2 ? '#ff8a00' : '#ffd84c',
                    alpha: 1,
                    decay: 0.02 + Math.random() * 0.02
                });
            }
            for (i = 0; i < 6; i++) {
                _effects.push({
                    kind: 'glow',
                    x: x + (Math.random() - 0.5) * 24,
                    y: y - 8 - Math.random() * 10,
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: -0.6 - Math.random() * 0.8,
                    gravity: -0.005,
                    size: 16 + Math.random() * 12,
                    color: 'rgba(255,140,0,0.22)',
                    alpha: 0.7,
                    decay: 0.022
                });
            }
            Engine.addGoldBurst(x, y, {
                count: 14,
                speed: 2.4,
                ringRadius: 24,
                upwardLift: 0.4,
                flashCoreRadius: 8,
                flashHaloRadius: 14
            });
            return;
        }

        if (type === 'storm') {
            _pushRing(x, y, '#63efff', 30, 3.1, 0.055, 3);
            for (i = 0; i < 3; i++) {
                _effects.push({
                    kind: 'bolt',
                    x: x,
                    y: y,
                    alpha: 1,
                    decay: 0.08,
                    segments: _createBoltSegments(x, y, 44 + Math.random() * 16, i * 0.8)
                });
            }
            for (i = 0; i < 16; i++) {
                _effects.push({
                    kind: 'shard',
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 4.2,
                    vy: (Math.random() - 0.5) * 3.6,
                    gravity: 0.02,
                    size: 6 + Math.random() * 6,
                    rotation: Math.random() * Math.PI,
                    spin: (Math.random() - 0.5) * 0.25,
                    color: i % 2 ? '#63efff' : '#baf6ff',
                    alpha: 1,
                    decay: 0.028
                });
            }
            return;
        }

        if (type === 'lotus') {
            _pushRing(x, y, '#ff58b3', 26, 2.2, 0.045, 3);
            _pushRing(x, y, '#ffe08a', 38, 1.8, 0.035, 2);
            for (i = 0; i < 10; i++) {
                _effects.push({
                    kind: 'petal',
                    baseX: x,
                    baseY: y,
                    orbit: 18 + Math.random() * 14,
                    drift: 0.6 + Math.random() * 0.6,
                    angle: (Math.PI * 2 / 10) * i,
                    spin: 0.05 + Math.random() * 0.04,
                    rise: 0,
                    size: 8 + Math.random() * 5,
                    color: i % 2 ? '#ff9ecf' : '#ffe08a',
                    alpha: 1,
                    decay: 0.018
                });
            }
            for (i = 0; i < 8; i++) {
                _effects.push({
                    kind: 'orb',
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 2.2,
                    vy: -1.1 - Math.random() * 1.2,
                    gravity: 0.015,
                    size: 4 + Math.random() * 4,
                    color: i % 2 ? '#ffe08a' : '#ff58b3',
                    alpha: 0.95,
                    decay: 0.02
                });
            }
            return;
        }

        _pushRing(x, y, '#ffd84c', 24, 2.2, 0.05, 3);
        for (i = 0; i < 8; i++) {
            _effects.push({
                kind: 'rune',
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 1.2,
                vy: -0.8 - Math.random() * 0.8,
                gravity: 0.01,
                size: 10 + Math.random() * 4,
                rotation: Math.random() * Math.PI,
                spin: (Math.random() - 0.5) * 0.18,
                color: i % 2 ? '#ffd84c' : '#fff2c1',
                alpha: 1,
                decay: 0.022
            });
        }
        Engine.addGoldBurst(x, y, {
            count: 12,
            speed: 2.6,
            ringRadius: 20,
            upwardLift: 0.45,
            flashCoreRadius: 8,
            flashHaloRadius: 14
        });
    }

    function _pushRing(x, y, color, radius, grow, decay, lineWidth) {
        _effects.push({
            kind: 'ring',
            x: x,
            y: y,
            r: radius,
            grow: grow,
            decay: decay,
            alpha: 0.72,
            lineWidth: lineWidth,
            color: color
        });
    }

    function _createBoltSegments(x, y, length, offset) {
        var segments = [];
        var px = x;
        var py = y;
        var step = length / 5;
        for (var i = 0; i < 5; i++) {
            px += Math.cos(offset + i * 0.6) * (8 + Math.random() * 6);
            py += (i === 0 ? -8 : step * 0.42) * (i % 2 === 0 ? -1 : 1);
            segments.push({ x: px, y: py });
        }
        return segments;
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
        if (_hitAnim > 0) _hitAnim *= 0.88;
        if (_hitAnim < 0.01) _hitAnim = 0;
        if (_malletAngle < 0) _malletAngle += 0.075;
        if (_malletAngle > 0) _malletAngle = 0;

        Draw.drawBackground(ctx, w, h);
        Draw.drawFrame(ctx, w, h);
        Draw.drawPanel(ctx, w * 0.08, h * 0.1, w * 0.84, h * 0.72, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);
        Draw.drawPanel(ctx, w * 0.12, h * 0.78, w * 0.76, h * 0.11, Draw.THEME.panel, Draw.THEME.pink, Draw.THEME.cyan, Draw.THEME.ink);

        var titleW = 200, titleH = 48;
        var level = _petLevels[_petLevel];
        var nextLevel = _petLevels[_petLevel + 1];
        var fish = _fishTypes[_currentFish];

        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.08, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, '功德 ' + _merit, w / 2, h * 0.08 + titleH / 2 + 2, 24, Draw.THEME.gold);

        Draw.drawHalo(ctx, w / 2, h * 0.49, 112 + _petLevel * 10, fish.glow, 0.13 + Math.sin(_time * 2) * 0.05);
        _drawAmbientParticles(ctx, w, h, fish, level);
        _drawEffects(ctx);
        _drawFish(ctx, w, h, fish);
        _drawMallet(ctx, w, h);

        ctx.save();
        ctx.font = '15px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#24113f';
        ctx.strokeText('境界：' + level.name, w / 2, h * 0.18);
        ctx.fillStyle = level.color;
        ctx.fillText('境界：' + level.name, w / 2, h * 0.18);
        ctx.restore();

        ctx.save();
        ctx.font = '12px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#24113f';
        ctx.strokeText('木鱼形态 ' + (_currentFish + 1) + ' / ' + _fishTypes.length + ' · ' + fish.name, w / 2, h * 0.245);
        ctx.fillStyle = fish.accent;
        ctx.fillText('木鱼形态 ' + (_currentFish + 1) + ' / ' + _fishTypes.length + ' · ' + fish.name, w / 2, h * 0.245);
        ctx.restore();

        if (nextLevel) {
            var progress = (_merit - level.threshold) / (nextLevel.threshold - level.threshold);
            var barW = Math.min(w * 0.6, 220);
            UI.drawProgressBar(ctx, (w - barW) / 2, h * 0.27, barW, 6, progress, fish.glow);
            UI.drawSubtitle(ctx, '下一境界: ' + nextLevel.name + ' (' + nextLevel.threshold + ')', w / 2, h * 0.305, 11, '#63efff');
        } else {
            UI.drawSubtitle(ctx, '像素灵宠已满级', w / 2, h * 0.295, 14, '#ff58b3');
        }

        var tipAlpha = 0.34 + Math.sin(_time * 3) * 0.14;
        UI.drawSubtitle(ctx, '点击木鱼本体敲击 · 右上角可切换形态', w / 2, h * 0.73, 14, 'rgba(255,242,193,' + tipAlpha + ')');
        UI.drawSubtitle(ctx, fish.hint, w / 2, h * 0.77, 12, fish.accent);
        UI.drawButtons(ctx);
    }

    function _drawFish(ctx, w, h, fish) {
        var bounceScale = 1 - _hitAnim * 0.12;
        var baseScale = 1.12 + _petLevel * 0.04;
        var cx = w / 2;
        var cy = h * 0.49 + Math.sin(_time * 2.3) * 3;

        if (fish.imageKey && _assets[fish.imageKey]) {
            var img = _assets[fish.imageKey];
            var drawH = 180 * baseScale * bounceScale * fish.imgScale;
            var drawW = drawH * (img.naturalWidth / img.naturalHeight);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1, 1 - _hitAnim * 0.08);
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
        } else {
            Draw.drawWoodenFish(ctx, cx, cy, baseScale * bounceScale, _hitAnim > 0.08);
        }
    }

    function _drawMallet(ctx, w, h) {
        var x = w / 2 + 88;
        var y = h * 0.39;
        if (_assets.striker) {
            var img = _assets.striker;
            var drawH = 150;
            var drawW = drawH * (img.naturalWidth / img.naturalHeight);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(_malletAngle);
            ctx.drawImage(img, -drawW * 0.18, -drawH * 0.9, drawW, drawH);
            ctx.restore();
            return;
        }
        Draw.drawMallet(ctx, x, y, 0.95, _malletAngle);
    }

    function _drawAmbientParticles(ctx, w, h, fish, level) {
        if (_petLevel < 1) return;
        for (var i = 0; i < 4; i++) {
            var angle = _time * (0.8 + i * 0.18) + i * Math.PI / 2;
            var px = w / 2 + Math.cos(angle) * (88 + _petLevel * 9);
            var py = h * 0.49 + Math.sin(angle) * (60 + _petLevel * 5);
            ctx.fillStyle = fish.accent;
            ctx.fillRect(Math.round(px), Math.round(py), 3 + (i % 2), 3 + (i % 2));
            if (_petLevel >= 3) {
                ctx.fillStyle = level.color;
                ctx.fillRect(Math.round(px + 5), Math.round(py - 5), 2, 2);
            }
        }
    }

    function _drawEffects(ctx) {
        for (var i = _effects.length - 1; i >= 0; i--) {
            var fx = _effects[i];
            fx.alpha -= fx.decay || 0.02;
            if (fx.alpha <= 0) {
                _effects.splice(i, 1);
                continue;
            }

            if (fx.kind === 'ring') {
                fx.r += fx.grow;
                ctx.save();
                ctx.beginPath();
                ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2);
                ctx.lineWidth = fx.lineWidth;
                ctx.strokeStyle = _rgba(fx.color, fx.alpha);
                ctx.stroke();
                ctx.restore();
                continue;
            }

            if (fx.kind === 'bolt') {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(fx.x, fx.y);
                for (var bi = 0; bi < fx.segments.length; bi++) {
                    ctx.lineTo(fx.segments[bi].x, fx.segments[bi].y);
                }
                ctx.strokeStyle = 'rgba(99,239,255,' + fx.alpha + ')';
                ctx.lineWidth = 3;
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(99,239,255,0.7)';
                ctx.stroke();
                ctx.restore();
                continue;
            }

            if (fx.kind === 'petal') {
                fx.angle += fx.spin;
                fx.orbit += fx.drift;
                fx.rise -= 0.18;
                ctx.save();
                ctx.translate(
                    fx.baseX + Math.cos(fx.angle) * fx.orbit,
                    fx.baseY + Math.sin(fx.angle) * fx.orbit * 0.45 + fx.rise
                );
                ctx.rotate(fx.angle);
                ctx.fillStyle = _rgba(fx.color, fx.alpha);
                ctx.beginPath();
                ctx.moveTo(0, -fx.size);
                ctx.quadraticCurveTo(fx.size * 0.7, -fx.size * 0.1, 0, fx.size);
                ctx.quadraticCurveTo(-fx.size * 0.7, -fx.size * 0.1, 0, -fx.size);
                ctx.fill();
                ctx.restore();
                continue;
            }

            fx.x += fx.vx || 0;
            fx.y += fx.vy || 0;
            fx.vy += fx.gravity || 0;
            fx.rotation = (fx.rotation || 0) + (fx.spin || 0);

            if (fx.kind === 'pixel') {
                ctx.fillStyle = _rgba(fx.color, fx.alpha);
                ctx.fillRect(Math.round(fx.x), Math.round(fx.y), fx.size, fx.size);
                continue;
            }

            if (fx.kind === 'glow') {
                ctx.save();
                ctx.beginPath();
                ctx.arc(fx.x, fx.y, fx.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,160,0,' + (fx.alpha * 0.18) + ')';
                ctx.fill();
                ctx.restore();
                continue;
            }

            if (fx.kind === 'orb') {
                ctx.save();
                ctx.beginPath();
                ctx.arc(fx.x, fx.y, fx.size, 0, Math.PI * 2);
                ctx.fillStyle = _rgba(fx.color, fx.alpha);
                ctx.fill();
                ctx.restore();
                continue;
            }

            if (fx.kind === 'shard') {
                ctx.save();
                ctx.translate(fx.x, fx.y);
                ctx.rotate(fx.rotation);
                ctx.fillStyle = _rgba(fx.color, fx.alpha);
                ctx.fillRect(-fx.size / 2, -2, fx.size, 4);
                ctx.restore();
                continue;
            }

            if (fx.kind === 'rune') {
                ctx.save();
                ctx.translate(fx.x, fx.y);
                ctx.rotate(fx.rotation);
                ctx.strokeStyle = _rgba(fx.color, fx.alpha);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-fx.size / 2, 0);
                ctx.lineTo(fx.size / 2, 0);
                ctx.moveTo(0, -fx.size / 2);
                ctx.lineTo(0, fx.size / 2);
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    function _rgba(hex, alpha) {
        if (!hex || hex.charAt(0) !== '#') return hex;
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
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
