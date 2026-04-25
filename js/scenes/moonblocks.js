/**
 * moonblocks.js — 掷杯筊场景
 */
var MoonBlocksScene = (function () {
    'use strict';

    var _phase = 'prepare'; // prepare → shaking → falling → result
    var _touching = false;
    var _touchCount = 0;
    var _shakeCount = 0;
    var _requiredShakes = 3;
    var _time = 0;
    var _result = null; // 'sheng' | 'xiao' | 'ku'
    var _block1 = { faceUp: true, rotation: 0, x: 0, y: 0, vy: 0, landed: false };
    var _block2 = { faceUp: false, rotation: 0, x: 0, y: 0, vy: 0, landed: false };
    var _fallTimer = 0;
    var _resultTimer = 0;
    var _shakeCallback = null;
    var _fallbackTapHandler = null;
    var _touchStartHandler = null;
    var _touchEndHandler = null;
    var _motionRequested = false;
    var _moonCost = 20;
    var _pendingStake = 0;
    var _insufficientHintTimer = 0;

    var results = {
        sheng: {
            name: '圣杯',
            emoji: '',
            desc: '一正一反',
            message: '神明大悦，功德翻倍！',
            detail: '双倍投入尽数奉还，此乃上上吉兆',
            color: '#FFD700'
        },
        xiao: {
            name: '笑杯',
            emoji: '',
            desc: '双正',
            message: '神明微笑，功德不变',
            detail: '本次投入如数退还，不赚不赔',
            color: '#87CEEB'
        },
        ku: {
            name: '哭杯',
            emoji: '',
            desc: '双反',
            message: '神明不语，功德散尽',
            detail: '本次投入全部没收，且待下回机缘',
            color: '#DDA0DD'
        }
    };

    function init() {
        _phase = 'prepare';
        _touching = false;
        _touchCount = 0;
        _shakeCount = 0;
        _time = 0;
        _result = null;
        _motionRequested = false;
        _pendingStake = 0;
        _insufficientHintTimer = 0;
        UI.clearButtons();
        _setupPrepareUI();
        Engine.startLoop(render);
        _bindTouchEvents();
    }

    function _setupPrepareUI() {
        UI.clearButtons();

        // 返回
        UI.createButton({
            x: 15, y: 15, w: 70, h: 36,
            text: '返回',
            color: 'rgba(255,255,255,0.7)',
            bgColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.15)',
            fontSize: 13, radius: 18,
            onClick: function () { App.switchScene('home'); }
        });

        // 权限按钮 (如果需要)
        if (!Device.isMotionGranted() && Device.isMotionSupported()) {
            var W = Engine.width();
            UI.createButton({
                x: (W - 240) / 2,
                y: Engine.height() * 0.75,
                w: 240, h: 50,
                text: '开启体感权限',
                color: '#CD853F',
                bgColor: 'rgba(205,133,63,0.2)',
                borderColor: 'rgba(205,133,63,0.5)',
                fontSize: 15, radius: 25,
                onClick: function () {
                    Device.requestMotionPermission(function (granted) {
                        if (granted) {
                            _motionRequested = true;
                            _setupPrepareUI();
                        }
                    });
                }
            });
        }
    }

    function _bindTouchEvents() {
        var canvas = Engine.getCanvas();

        _touchStartHandler = function (e) {
            // 统计触摸点
            if (e.touches) {
                _touchCount = e.touches.length;
            } else {
                _touchCount = 1;
            }
            _touching = true;

            if (_phase === 'prepare' && (Device.isMotionGranted() || !Device.isMotionSupported())) {
                if (!_beginWager()) return;
                _startShaking();
            }
        };

        _touchEndHandler = function (e) {
            if (e.touches) {
                _touchCount = e.touches.length;
            } else {
                _touchCount = 0;
            }
            if (_touchCount === 0) _touching = false;
        };

        canvas.addEventListener('touchstart', _touchStartHandler, { passive: true });
        canvas.addEventListener('touchend', _touchEndHandler, { passive: true });
        canvas.addEventListener('mousedown', _touchStartHandler);
        canvas.addEventListener('mouseup', _touchEndHandler);
    }

    function _startShaking() {
        _phase = 'shaking';
        _shakeCount = 0;
        UI.clearButtons();

        UI.createButton({
            x: 15, y: 15, w: 70, h: 36,
            text: '返回',
            color: 'rgba(255,255,255,0.7)',
            bgColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.15)',
            fontSize: 13, radius: 18,
            onClick: function () {
                if (_shakeCallback) Device.offShake(_shakeCallback);
                _refundPendingStake();
                _phase = 'prepare';
                _setupPrepareUI();
            }
        });

        _shakeCallback = function (intensity) {
            if (_phase !== 'shaking') return;
            _doShakeStep();
        };

        if (Device.isMotionGranted()) {
            Device.onShake(_shakeCallback);
        } else {
            // 无陀螺仪 → 点击屏幕模拟摇动
            var canvas = Engine.getCanvas();
            var lastTap = 0;
            _fallbackTapHandler = function (e) {
                if (_phase !== 'shaking') return;
                var now = Date.now();
                if (now - lastTap < 350) return;
                lastTap = now;
                _doShakeStep();
            };
            canvas.addEventListener('touchstart', _fallbackTapHandler, { passive: true });
            canvas.addEventListener('click', _fallbackTapHandler);
        }
    }

    function _doShakeStep() {
        _shakeCount++;
        Device.tapVibrate();
        Engine.addFloatingText(
            Engine.width() / 2 + (Math.random() - 0.5) * 60,
            Engine.height() * 0.4,
            '✦',
            '#CD853F',
            20
        );
        if (_shakeCount >= _requiredShakes) {
            if (_shakeCallback) Device.offShake(_shakeCallback);
            _removeFallbackTap();
            _throwBlocks();
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

    function _beginWager() {
        if (_pendingStake > 0) return true;
        if (!MeritSystem.canAfford(_moonCost)) {
            MeritSystem.showToast('功德不足，请先敲击木鱼积攒功德', 'warning');
            _insufficientHintTimer = 2.6;
            return false;
        }
        MeritSystem.deductPoints(_moonCost);
        _pendingStake = _moonCost;
        MeritSystem.showToast('已投入 ' + _moonCost + ' 功德，静候杯筊', 'info');
        return true;
    }

    function _refundPendingStake() {
        if (_pendingStake <= 0) return;
        MeritSystem.addPoints(_pendingStake);
        MeritSystem.showToast('本次掷筊已取消，功德已退回', 'info');
        _pendingStake = 0;
    }

    function _throwBlocks() {
        _phase = 'falling';
        _fallTimer = 0;

        // 随机决定结果
        var rand = Math.random();
        if (rand < 0.5) {
            _result = 'sheng'; // 圣杯 — 一正一反
            _block1.faceUp = true;
            _block2.faceUp = false;
        } else if (rand < 0.75) {
            _result = 'xiao'; // 笑杯 — 双正
            _block1.faceUp = true;
            _block2.faceUp = true;
        } else {
            _result = 'ku'; // 哭杯 — 双反
            _block1.faceUp = false;
            _block2.faceUp = false;
        }

        var W = Engine.width();
        var H = Engine.height();
        _block1.x = W * 0.35;
        _block1.y = H * 0.15;
        _block1.vy = 0;
        _block1.rotation = Math.random() * Math.PI * 2;
        _block1.landed = false;
        _block1.targetY = H * 0.52;

        _block2.x = W * 0.65;
        _block2.y = H * 0.12;
        _block2.vy = 0;
        _block2.rotation = Math.random() * Math.PI * 2;
        _block2.landed = false;
        _block2.targetY = H * 0.57;

        Audio.playBlockDrop();
    }

    function _showResult() {
        _phase = 'result';
        _resultTimer = 0;
        Device.mediumVibrate();

        if (_result === 'sheng') {
            MeritSystem.addPoints(_pendingStake * 2);
            MeritSystem.showToast('神明大悦，功德翻倍！', 'success');
        } else if (_result === 'xiao') {
            MeritSystem.addPoints(_pendingStake);
            MeritSystem.showToast('神明微笑，功德不变', 'info');
        } else {
            MeritSystem.showToast('神明不语，功德散尽', 'danger');
        }
        _pendingStake = 0;

        var r = results[_result];
        UI.clearButtons();
        var W = Engine.width();
        var btnW = Math.min(W * 0.5, 180);

        UI.createButton({
            x: (W - btnW) / 2,
            y: Engine.height() * 0.88,
            w: btnW, h: 46,
            text: '再掷一次',
            color: r.color,
            bgColor: 'rgba(255,255,255,0.08)',
            borderColor: _colorAlpha(r.color, 0.4),
            fontSize: 15, radius: 23,
            onClick: function () {
                Audio.playTap();
                _phase = 'prepare';
                _shakeCount = 0;
                _result = null;
                _setupPrepareUI();
            }
        });

        UI.createButton({
            x: 15, y: 15, w: 70, h: 36,
            text: '首页',
            color: 'rgba(255,255,255,0.7)',
            bgColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.15)',
            fontSize: 13, radius: 18,
            onClick: function () { App.switchScene('home'); }
        });
    }

    function render(ctx, w, h) {
        _time += 0.016;
        if (_insufficientHintTimer > 0) _insufficientHintTimer -= 0.016;

        Draw.drawBackground(ctx, w, h);
        Draw.drawFrame(ctx, w, h);
        Draw.drawPanel(ctx, w * 0.08, h * 0.1, w * 0.84, h * 0.68, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);

        // 装饰
        Draw.drawCloud(ctx, (_time * 10 % (w + 100)) - 50, h * 0.08, 0.5, 0.06);

        if (_phase === 'prepare') {
            _renderPrepare(ctx, w, h);
        } else if (_phase === 'shaking') {
            _renderShaking(ctx, w, h);
        } else if (_phase === 'falling') {
            _fallTimer += 0.016;
            _renderFalling(ctx, w, h);
        } else if (_phase === 'result') {
            _resultTimer += 0.016;
            _renderResult(ctx, w, h);
        }

        UI.drawButtons(ctx);
        _drawReturnHint(ctx);
    }

    function _drawReturnHint(ctx) {
        if (_insufficientHintTimer <= 0) return;
        var alpha = Math.min(1, _insufficientHintTimer / 0.5);
        ctx.save();
        ctx.font = '11px "PoxiaoPixel"';
        ctx.textAlign = 'left';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(36,17,63,' + alpha + ')';
        ctx.fillStyle = 'rgba(255,242,193,' + alpha + ')';
        ctx.strokeText('先返回首页敲木鱼攒功德', 92, 36);
        ctx.fillText('先返回首页敲木鱼攒功德', 92, 36);
        ctx.restore();
    }

    function _renderPrepare(ctx, w, h) {
        var titleW = 200, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.08, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, '掷杯筊', w / 2, h * 0.08 + titleH / 2 + 2, 24, Draw.THEME.gold);

        // 展示杯筊
        Draw.drawMoonBlock(ctx, w * 0.38, h * 0.38, 1.5, true, Math.sin(_time) * 0.1);
        Draw.drawMoonBlock(ctx, w * 0.62, h * 0.42, 1.5, false, Math.cos(_time) * 0.1);

        Draw.drawHalo(ctx, w / 2, h * 0.4, 100, '#ff58b3', 0.1 + Math.sin(_time * 2) * 0.04);

        // 提示
        var alpha = 0.5 + Math.sin(_time * 3) * 0.3;
        ctx.save();
        ctx.font = '16px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#24113f';
        ctx.fillStyle = 'rgba(255,216,76,' + alpha + ')';

        if (Device.isMotionGranted() || !Device.isMotionSupported()) {
            ctx.strokeText('双手握住手机', w / 2, h * 0.56);
            ctx.fillText('双手握住手机', w / 2, h * 0.56);
            ctx.font = '14px "PoxiaoPixel"';
            ctx.fillStyle = '#fff2c1';
            ctx.strokeText('每次投掷消耗 ' + _moonCost + ' 功德', w / 2, h * 0.61);
            ctx.fillText('每次投掷消耗 ' + _moonCost + ' 功德', w / 2, h * 0.61);
            ctx.strokeText('心中默念问题', w / 2, h * 0.66);
            ctx.fillText('心中默念问题', w / 2, h * 0.66);
            ctx.strokeText(Device.isMotionSupported() ? '按住屏幕后晃动手机投掷' : '按住屏幕后点击投掷', w / 2, h * 0.7);
            ctx.fillText(Device.isMotionSupported() ? '按住屏幕后晃动手机投掷' : '按住屏幕后点击投掷', w / 2, h * 0.7);
        } else {
            ctx.strokeText('请先开启体感权限', w / 2, h * 0.6);
            ctx.fillText('请先开启体感权限', w / 2, h * 0.6);
        }
        ctx.restore();
    }

    function _renderShaking(ctx, w, h) {
        var shake = Math.sin(_time * 20) * 3;
        var titleW = 200, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.08, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, '掷杯筊', w / 2, h * 0.08 + titleH / 2 + 2, 24, Draw.THEME.gold);

        // 抖动效果
        ctx.save();
        ctx.translate(shake, shake * 0.5);
        Draw.drawMoonBlock(ctx, w * 0.38, h * 0.38, 1.5, true, _time * 3);
        Draw.drawMoonBlock(ctx, w * 0.62, h * 0.42, 1.5, false, -_time * 2.5);
        ctx.restore();

        // 进度
        ctx.save();
        ctx.font = '36px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#24113f';
        ctx.strokeText(_shakeCount + ' / ' + _requiredShakes, w / 2, h * 0.6);
        ctx.fillStyle = '#ffd84c';
        ctx.fillText(_shakeCount + ' / ' + _requiredShakes, w / 2, h * 0.6);

        ctx.font = '14px "PoxiaoPixel"';
        ctx.lineWidth = 3;
        ctx.fillStyle = '#fff2c1';
        if (!_touching) {
            ctx.fillStyle = '#ff5a48';
            ctx.fillText('请按住屏幕不要松手', w / 2, h * 0.66);
        } else if (Device.isMotionSupported()) {
            ctx.fillText('用力晃动手机！', w / 2, h * 0.66);
        } else {
            ctx.fillText('点击屏幕投掷', w / 2, h * 0.66);
        }
        ctx.restore();

        UI.drawProgressBar(ctx, (w - 180) / 2, h * 0.7, 180, 8, _shakeCount / _requiredShakes, '#ff58b3');


    }

    function _renderFalling(ctx, w, h) {
        var titleW = 200, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.08, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, '掷杯筊', w / 2, h * 0.08 + titleH / 2 + 2, 24, Draw.THEME.gold);

        // 落下动画
        var blocks = [_block1, _block2];
        var allLanded = true;

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b.landed) {
                b.vy += 0.5; // 重力
                b.y += b.vy;
                b.rotation += 0.15 * (i === 0 ? 1 : -1);

                if (b.y >= b.targetY) {
                    b.y = b.targetY;
                    b.landed = true;
                    b.rotation = (Math.random() - 0.5) * 0.3; // 落地微倾
                    Device.tapVibrate();
                }
                allLanded = false;
            }

            Draw.drawMoonBlock(ctx, b.x, b.y, 1.8, b.faceUp, b.rotation);
        }

        if (allLanded && _fallTimer > 0.8) {
            _showResult();
        }
    }

    function _renderResult(ctx, w, h) {
        var r = results[_result];
        var fadeIn = Math.min(1, _resultTimer / 0.6);

        // 杯筊静态展示
        Draw.drawMoonBlock(ctx, _block1.x, _block1.targetY, 1.8, _block1.faceUp, _block1.rotation);
        Draw.drawMoonBlock(ctx, _block2.x, _block2.targetY, 1.8, _block2.faceUp, _block2.rotation);

        // 结果光环
        Draw.drawHalo(ctx, w / 2, h * 0.5, 120, r.color, 0.2 * fadeIn);

        ctx.save();
        ctx.globalAlpha = fadeIn;

        // 结果标题
        ctx.font = '42px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#24113f';
        ctx.strokeText(r.name, w / 2, h * 0.25);
        ctx.fillStyle = r.color;
        ctx.fillText(r.name, w / 2, h * 0.25);

        // 描述
        ctx.font = '14px "PoxiaoPixel"';
        ctx.lineWidth = 3;
        ctx.strokeText(r.desc, w / 2, h * 0.31);
        ctx.fillStyle = '#63efff';
        ctx.fillText(r.desc, w / 2, h * 0.31);

        // 主语
        ctx.font = '20px "PoxiaoPixel"';
        ctx.strokeText('「' + r.message + '」', w / 2, h * 0.7);
        ctx.fillStyle = '#fff2c1';
        ctx.fillText('「' + r.message + '」', w / 2, h * 0.7);

        // 副语
        ctx.font = '14px "PoxiaoPixel"';
        ctx.strokeText(r.detail, w / 2, h * 0.76);
        ctx.fillStyle = '#ff8a3d';
        ctx.fillText(r.detail, w / 2, h * 0.76);

        ctx.restore();
    }

    function _colorAlpha(hex, a) {
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    function destroy() {
        UI.clearButtons();
        if (_shakeCallback) Device.offShake(_shakeCallback);
        _removeFallbackTap();
        _refundPendingStake();
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
