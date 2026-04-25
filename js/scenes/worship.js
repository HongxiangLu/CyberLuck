/**
 * worship.js — 拜财神场景
 */
var WorshipScene = (function () {
    'use strict';

    var _phase = 'select'; // select → prepare → bowing → result
    var _selectedGod = 0;
    var _bowCount = 0;
    var _maxBows = 3;
    var _touching = false;
    var _time = 0;
    var _resultTimer = 0;
    var _bowCallback = null;
    var _resultQuote = '';
    var _fallbackTapHandler = null;
    var _touchStartHandler = null;
    var _touchEndHandler = null;
    var _motionRequested = false;

    var gods = [
        {
            name: '关二爷',
            draw: function (ctx, cx, cy, s) { Draw.drawGuanYu(ctx, cx, cy, s); },
            color: '#228B22',
            quotes: [
                '忠义相随，财运亨通',
                '义薄云天，福泽绵长',
                '关帝护佑，百业兴旺',
                '正气凛然，邪祟退散'
            ]
        },
        {
            name: '赵公明',
            draw: function (ctx, cx, cy, s) { Draw.drawZhaoGongMing(ctx, cx, cy, s); },
            color: '#8B0000',
            quotes: [
                '五路财神到，金银满堂招',
                '招财进宝，日进斗金',
                '财源广进，富贵临门',
                '黑虎巡财，八方来财'
            ]
        },
        {
            name: '文财神',
            draw: function (ctx, cx, cy, s) { Draw.drawWenCaiShen(ctx, cx, cy, s); },
            color: '#1a1a6e',
            quotes: [
                '文曲星照，才财双收',
                '笔下生花，财运亨通',
                '学富五车，财达四方',
                '文运昌盛，富贵花开'
            ]
        },
        {
            name: '比干',
            draw: function (ctx, cx, cy, s) { Draw.drawBiGan(ctx, cx, cy, s); },
            color: '#4B0082',
            quotes: [
                '心正则财正，无私则无患',
                '七窍玲珑心，公正聚财运',
                '清廉如水，福报自来',
                '无偏无私，财神庇佑'
            ]
        }
    ];

    function init() {
        _phase = 'select';
        _selectedGod = 0;
        _bowCount = 0;
        _touching = false;
        _time = 0;
        _motionRequested = false;
        UI.clearButtons();
        _setupSelectButtons();
        Engine.startLoop(render);
        _bindTouchEvents();
    }

    function _setupSelectButtons() {
        UI.clearButtons();
        var W = Engine.width();
        var H = Engine.height();
        var btnW = Math.min(W * 0.38, 140);
        var btnH = 46;
        var gap = 12;
        var cols = 2;
        var totalW = cols * btnW + (cols - 1) * gap;
        var startX = (W - totalW) / 2;
        var startY = H * 0.62;

        for (var i = 0; i < gods.length; i++) {
            (function (idx) {
                UI.createButton({
                    x: startX + (idx % cols) * (btnW + gap),
                    y: startY + Math.floor(idx / cols) * (btnH + gap + 4),
                    w: btnW, h: btnH,
                    text: gods[idx].name,
                    color: '#FFD700',
                    bgColor: idx === _selectedGod ? 'rgba(255,215,0,0.25)' : 'rgba(255,215,0,0.08)',
                    borderColor: idx === _selectedGod ? 'rgba(255,215,0,0.6)' : 'rgba(255,215,0,0.2)',
                    fontSize: 16,
                    radius: 12,
                    onClick: function () {
                        Audio.playTap();
                        _selectedGod = idx;
                        _setupSelectButtons();
                    }
                });
            })(i);
        }

        // 确认按钮
        var confirmW = Math.min(W * 0.6, 220);
        UI.createButton({
            x: (W - confirmW) / 2,
            y: startY + Math.ceil(gods.length / cols) * (btnH + gap + 4) + 10,
            w: confirmW, h: 52,
            text: '开始参拜',
            color: '#FFD700',
            bgColor: 'rgba(255,215,0,0.15)',
            borderColor: 'rgba(255,215,0,0.5)',
            fontSize: 18,
            radius: 26,
            onClick: function () {
                Audio.playTap();
                _goToPrepare();
            }
        });

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
    }

    function _goToPrepare() {
        _phase = 'prepare';
        UI.clearButtons();

        // 返回
        UI.createButton({
            x: 15, y: 15, w: 70, h: 36,
            text: '← 返回',
            color: 'rgba(255,255,255,0.7)',
            bgColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.15)',
            fontSize: 13, radius: 18,
            onClick: function () {
                _phase = 'select';
                _setupSelectButtons();
            }
        });

        // 请求陀螺仪权限
        if (!Device.isMotionGranted()) {
            var W = Engine.width();
            var btnW = Math.min(W * 0.7, 260);
            UI.createButton({
                x: (W - btnW) / 2,
                y: Engine.height() * 0.75,
                w: btnW, h: 52,
                text: '📱 开启体感权限',
                color: '#FFD700',
                bgColor: 'rgba(255,215,0,0.2)',
                borderColor: 'rgba(255,215,0,0.5)',
                fontSize: 16, radius: 26,
                onClick: function () {
                    Device.requestMotionPermission(function (granted) {
                        if (granted) {
                            _motionRequested = true;
                            _goToPrepare();
                        }
                    });
                }
            });
        }
    }

    function _bindTouchEvents() {
        var canvas = Engine.getCanvas();

        _touchStartHandler = function (e) {
            _touching = true;
            if (_phase === 'prepare' && (Device.isMotionGranted() || !Device.isMotionSupported())) {
                _startBowing();
            }
        };
        _touchEndHandler = function (e) {
            _touching = false;
            if (_phase === 'bowing') {
                // 松手暂停 — 提示继续按住
            }
        };

        canvas.addEventListener('touchstart', _touchStartHandler, { passive: true });
        canvas.addEventListener('touchend', _touchEndHandler, { passive: true });
        canvas.addEventListener('mousedown', _touchStartHandler);
        canvas.addEventListener('mouseup', _touchEndHandler);
    }

    function _startBowing() {
        _phase = 'bowing';
        _bowCount = 0;
        UI.clearButtons();

        // 返回
        UI.createButton({
            x: 15, y: 15, w: 70, h: 36,
            text: '← 返回',
            color: 'rgba(255,255,255,0.7)',
            bgColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.15)',
            fontSize: 13, radius: 18,
            onClick: function () {
                _phase = 'select';
                _setupSelectButtons();
                if (_bowCallback) Device.offBow(_bowCallback);
                _removeFallbackTap();
            }
        });

        var doBow = function () {
            if (_phase !== 'bowing') return;
            _bowCount++;
            Device.tapVibrate();
            Engine.addFloatingText(Engine.width() / 2, Engine.height() * 0.35, '🙏 ' + _bowCount, '#FFD700', 28);
            if (_bowCount >= _maxBows) {
                if (_bowCallback) Device.offBow(_bowCallback);
                _removeFallbackTap();
                _showResult();
            }
        };

        if (Device.isMotionGranted()) {
            _bowCallback = function (intensity) {
                if (!_touching) return;
                doBow();
            };
            Device.onBow(_bowCallback);
        } else {
            // 无陀螺仪 → 点击屏幕计数
            _bowCallback = null;
            var canvas = Engine.getCanvas();
            var lastTap = 0;
            _fallbackTapHandler = function (e) {
                if (_phase !== 'bowing') return;
                var now = Date.now();
                if (now - lastTap < 400) return; // 防抖
                lastTap = now;
                doBow();
            };
            canvas.addEventListener('touchstart', _fallbackTapHandler, { passive: true });
            canvas.addEventListener('click', _fallbackTapHandler);
        }
    }

    function _removeFallbackTap() {
        if (_fallbackTapHandler) {
            var canvas = Engine.getCanvas();
            canvas.removeEventListener('touchstart', _fallbackTapHandler);
            canvas.removeEventListener('click', _fallbackTapHandler);
            _fallbackTapHandler = null;
        }
    }

    function _showResult() {
        _phase = 'result';
        _resultTimer = 0;
        var god = gods[_selectedGod];
        var W = Engine.width();

        // 选定语录（只选一次，不在渲染循环中随机）
        _resultQuote = god.quotes[Math.floor(Math.random() * god.quotes.length)];

        Engine.addGoldBurst(W / 2, Engine.height() * 0.35);
        Audio.playSuccess();
        Device.mediumVibrate();

        UI.clearButtons();
        var btnW = Math.min(W * 0.55, 200);
        UI.createButton({
            x: (W - btnW) / 2,
            y: Engine.height() * 0.85,
            w: btnW, h: 48,
            text: '再拜一次',
            color: '#FFD700',
            bgColor: 'rgba(255,215,0,0.15)',
            borderColor: 'rgba(255,215,0,0.4)',
            fontSize: 16, radius: 24,
            onClick: function () {
                Audio.playTap();
                _phase = 'select';
                _setupSelectButtons();
            }
        });

        UI.createButton({
            x: 15, y: 15, w: 70, h: 36,
            text: '← 首页',
            color: 'rgba(255,255,255,0.7)',
            bgColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.15)',
            fontSize: 13, radius: 18,
            onClick: function () { App.switchScene('home'); }
        });
    }

    function render(ctx, w, h) {
        _time += 0.016;

        var god = gods[_selectedGod];
        Draw.drawBackground(ctx, w, h, '#0a0a2e', '#120a22');

        // 祥云
        var cloudOffset = _time * 15;
        Draw.drawCloud(ctx, (cloudOffset % (w + 120)) - 60, h * 0.1, 0.8, 0.08);
        Draw.drawCloud(ctx, ((cloudOffset * 0.7 + 200) % (w + 120)) - 60, h * 0.15, 0.6, 0.06);

        if (_phase === 'select') {
            _renderSelect(ctx, w, h, god);
        } else if (_phase === 'prepare') {
            _renderPrepare(ctx, w, h, god);
        } else if (_phase === 'bowing') {
            _renderBowing(ctx, w, h, god);
        } else if (_phase === 'result') {
            _resultTimer += 0.016;
            _renderResult(ctx, w, h, god);
        }

        UI.drawButtons(ctx);
    }

    function _renderSelect(ctx, w, h, god) {
        UI.drawTitle(ctx, '选择财神', w / 2, h * 0.08, 26, '#FFD700');
        Draw.drawHalo(ctx, w / 2, h * 0.33, 100, god.color, 0.2);
        god.draw(ctx, w / 2, h * 0.35, 1.2);
        UI.drawSubtitle(ctx, god.name, w / 2, h * 0.55, 20, '#FFD700');
    }

    function _renderPrepare(ctx, w, h, god) {
        Draw.drawHalo(ctx, w / 2, h * 0.33, 80, god.color, 0.15 + Math.sin(_time * 3) * 0.05);
        god.draw(ctx, w / 2, h * 0.35, 1.0);
        UI.drawTitle(ctx, god.name, w / 2, h * 0.08, 24, '#FFD700');

        // 提示
        var alpha = 0.5 + Math.sin(_time * 4) * 0.3;
        ctx.save();
        ctx.font = '16px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,215,0,' + alpha + ')';

        if (Device.isMotionGranted() || !Device.isMotionSupported()) {
            ctx.fillText('👆 按住屏幕，开始虔诚参拜', w / 2, h * 0.62);
            ctx.font = '13px -apple-system, "PingFang SC", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillText(Device.isMotionSupported() ? '按住后上下移动手机' : '按住后点击屏幕参拜', w / 2, h * 0.67);
        } else {
            ctx.fillText('请先开启体感权限', w / 2, h * 0.62);
        }
        ctx.restore();
    }

    function _renderBowing(ctx, w, h, god) {
        var bobY = _touching ? Math.sin(_time * 6) * 5 : 0;
        Draw.drawHalo(ctx, w / 2, h * 0.33 + bobY, 90, god.color, 0.2);
        god.draw(ctx, w / 2, h * 0.35 + bobY, 1.0);

        // 进度
        UI.drawTitle(ctx, god.name, w / 2, h * 0.08, 22, '#FFD700');

        ctx.save();
        ctx.font = 'bold 48px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(_bowCount + ' / ' + _maxBows, w / 2, h * 0.62);

        ctx.font = '14px -apple-system, "PingFang SC", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        if (!_touching) {
            ctx.fillStyle = 'rgba(255,100,100,0.8)';
            ctx.fillText('请按住屏幕不要松手', w / 2, h * 0.68);
        } else if (Device.isMotionSupported()) {
            ctx.fillText('按住屏幕，上下移动手机参拜', w / 2, h * 0.68);
        } else {
            ctx.fillText('点击屏幕参拜', w / 2, h * 0.68);
        }
        ctx.restore();

        // 不支持陀螺仪 — 点击计数
        if (!Device.isMotionSupported() && _touching) {
            // 通过 touch 事件中判断
        }

        // 进度条
        var barW = Math.min(w * 0.6, 200);
        UI.drawProgressBar(ctx, (w - barW) / 2, h * 0.73, barW, 8, _bowCount / _maxBows, '#FFD700');
    }

    function _renderResult(ctx, w, h, god) {
        var fadeIn = Math.min(1, _resultTimer / 0.5);

        Draw.drawHalo(ctx, w / 2, h * 0.3, 130, '#FFD700', 0.3 * fadeIn);
        god.draw(ctx, w / 2, h * 0.32, 1.3);

        ctx.save();
        ctx.globalAlpha = fadeIn;

        // 语录
        UI.drawTitle(ctx, '🎊 ' + god.name + ' 赐福', w / 2, h * 0.55, 22, '#FFD700');

        ctx.font = '18px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFF8DC';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 15;
        ctx.fillText('「' + _resultQuote + '」', w / 2, h * 0.63);
        ctx.shadowBlur = 0;

        // 祝福副标题
        ctx.font = '14px -apple-system, "PingFang SC", sans-serif';
        ctx.fillStyle = 'rgba(255,248,220,0.6)';
        ctx.fillText('诚心祈福，自有天佑', w / 2, h * 0.69);

        ctx.restore();
    }

    function destroy() {
        UI.clearButtons();
        if (_bowCallback) Device.offBow(_bowCallback);
        _removeFallbackTap();
        var canvas = Engine.getCanvas();
        if (_touchStartHandler) {
            canvas.removeEventListener('touchstart', _touchStartHandler);
            canvas.removeEventListener('mousedown', _touchStartHandler);
        }
        if (_touchEndHandler) {
            canvas.removeEventListener('touchend', _touchEndHandler);
            canvas.removeEventListener('mouseup', _touchEndHandler);
        }
        _touchStartHandler = null;
        _touchEndHandler = null;
    }

    return {
        init: init,
        destroy: destroy
    };
})();
