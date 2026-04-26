/**
 * moonblocks.js — 赛博灵签 + 物理掷筊协议
 */
var MoonBlocksScene = (function () {
    'use strict';

    var _view = 'sticks'; // sticks | blocks
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
    var _moonCost = 20;
    var _pendingStake = 0;
    var _insufficientHintTimer = 0;
    var _dom = null;
    var _stickState = 'idle'; // idle | shaking | revealing | result
    var _stickTimers = [];
    var _fortuneResult = null;
    var _fortunes = [
        '[事业·上上签] 你的每一行代码都被神明加密，永不报错。',
        '[财运·上吉签] 财神节点已接入，你投入的每一点念力，都会在意外之处回本。',
        '[机缘·中吉签] 命运齿轮转动，本周会有一个看似随手的选择，悄悄改变走向。',
        '[感情·上上签] 桃花协议已签发，心意终会合流，只差一次真诚的提交。',
        '[健康·上吉签] 生命值已被天庭锁定，旧疾退散，平安顺遂。',
        '[项目·中平签] 卡住你的不是命，是还没点下那次确认启动，勇敢部署吧。',
        '[除业·大吉签] 业障与旧缓存一并退散，你的赛博气场焕然一新。',
        '[护身·上上签] 赛博佛光护体，百邪不侵，诸事皆宜。'
    ];

    var results = {
        sheng: {
            name: '圣杯',
            desc: '一平一凸',
            message: '上古协议回传：可执行',
            detail: '神明链路确认通过，此次请求得到明确同意',
            color: '#FFD700'
        },
        xiao: {
            name: '笑杯',
            desc: '双平',
            message: '上古协议回传：请再描述一次',
            detail: '链路存在歧义，当前回应偏模糊，建议重发请求',
            color: '#87CEEB'
        },
        ku: {
            name: '哭杯',
            desc: '双凸',
            message: '上古协议回传：暂不接受',
            detail: '当前链路不稳定，建议先缓一缓，再择时重试',
            color: '#DDA0DD'
        }
    };

    function init() {
        _view = 'sticks';
        _phase = 'prepare';
        _touching = false;
        _touchCount = 0;
        _shakeCount = 0;
        _time = 0;
        _result = null;
        _pendingStake = 0;
        _insufficientHintTimer = 0;
        _stickState = 'idle';
        _fortuneResult = null;
        _clearStickTimers();
        UI.clearButtons();
        _createFortuneDom();
        _showSticksView();
        Engine.startLoop(render);
        _bindTouchEvents();
    }

    function _createFortuneDom() {
        if (_dom && _dom.root && _dom.root.parentNode) return;

        var root = document.createElement('div');
        root.className = 'fortune-overlay';
        root.innerHTML =
            '<div class="fortune-shell">' +
                '<button class="fortune-back" type="button">返回</button>' +
                '<div class="fortune-panel">' +
                    '<div class="fortune-title">今日神意签</div>' +
                    '<div class="fortune-rule">正在链接天庭主机... 请在灵识中同步参数：姓名/所求，确认后抽取本命神签</div>' +
                    '<div class="fortune-core">' +
                        '<div class="fortune-tube-wrap">' +
                            '<div class="fortune-tube-glow"></div>' +
                            '<img class="fortune-stick" src="images/fortune/slip.png" aria-hidden="true" />' +
                            '<img class="fortune-tube" src="images/fortune/tube.png" />' +
                        '</div>' +
                    '</div>' +
                    '<div class="fortune-actions">' +
                        '<button class="fortune-primary" type="button">开始读取神意</button>' +
                        '<button class="fortune-secondary" type="button">切换至物理掷筊协议</button>' +
                    '</div>' +
                '</div>' +
                '<div class="fortune-modal" hidden>' +
                    '<div class="fortune-modal-card">' +
                        '<div class="fortune-modal-title"></div>' +
                        '<div class="fortune-modal-body"></div>' +
                        '<div class="fortune-modal-actions">' +
                            '<button class="fortune-modal-cancel" type="button">取消</button>' +
                            '<button class="fortune-modal-confirm" type="button">确认</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(root);

        _dom = {
            root: root,
            back: root.querySelector('.fortune-back'),
            title: root.querySelector('.fortune-title'),
            rule: root.querySelector('.fortune-rule'),
            tubeWrap: root.querySelector('.fortune-tube-wrap'),
            stick: root.querySelector('.fortune-stick'),
            primary: root.querySelector('.fortune-primary'),
            secondary: root.querySelector('.fortune-secondary'),
            modal: root.querySelector('.fortune-modal'),
            modalTitle: root.querySelector('.fortune-modal-title'),
            modalBody: root.querySelector('.fortune-modal-body'),
            modalCancel: root.querySelector('.fortune-modal-cancel'),
            modalConfirm: root.querySelector('.fortune-modal-confirm')
        };

        _dom.back.addEventListener('click', function () {
            Audio.playTap();
            App.switchScene('home');
        });
        _dom.primary.addEventListener('click', function () {
            Audio.playTap();
            _startFortuneDraw();
        });
        _dom.secondary.addEventListener('click', function () {
            Audio.playTap();
            _openProtocolModal();
        });
        _dom.modalCancel.addEventListener('click', function () {
            Audio.playTap();
            _closeModal();
        });
        _dom.modalConfirm.addEventListener('click', function () {
            Audio.playTap();
            if (_dom.modalConfirm.dataset.mode === 'protocol') {
                _closeModal();
                _enterBlocksView();
            } else {
                _closeModal();
                _resetFortuneUi();
            }
        });
    }

    function _showSticksView() {
        _view = 'sticks';
        UI.clearButtons();
        _resetFortuneUi();
        if (_dom && _dom.root) _dom.root.hidden = false;
    }

    function _resetFortuneUi() {
        _stickState = 'idle';
        if (!_dom) return;
        _clearStickTimers();
        _dom.rule.textContent = '正在链接天庭主机... 请在灵识中同步参数：姓名/所求，确认后抽取本命神签';
        _dom.primary.disabled = false;
        _dom.secondary.disabled = false;
        _dom.tubeWrap.classList.remove('is-shaking');
        _dom.stick.classList.remove('is-rising');
        _closeModal();
    }

    function _startFortuneDraw() {
        if (!_dom || _stickState !== 'idle') return;
        _stickState = 'shaking';
        _dom.primary.disabled = true;
        _dom.secondary.disabled = true;
        _dom.rule.textContent = '香火数据已上传，神明正在下发灵签...';
        _dom.tubeWrap.classList.remove('is-shaking');
        _dom.stick.classList.remove('is-rising');
        void _dom.tubeWrap.offsetWidth;
        _dom.tubeWrap.classList.add('is-shaking');
        Device.tapVibrate();

        _stickTimers.push(window.setTimeout(function () {
            if (!_dom) return;
            _stickState = 'revealing';
            _dom.tubeWrap.classList.remove('is-shaking');
            _dom.stick.classList.add('is-rising');
            _dom.rule.textContent = '灵签已抽出，正在转译天庭谕旨...';
            Engine.addFloatingText(Engine.width() / 2, Engine.height() * 0.48, 'SIGNAL', '#ffd84c', 20);
        }, 1500));

        _stickTimers.push(window.setTimeout(function () {
            _stickState = 'result';
            _fortuneResult = _fortunes[Math.floor(Math.random() * _fortunes.length)];
            _openResultModal();
        }, 2280));
    }

    function _openResultModal() {
        if (!_dom) return;
        _dom.modal.hidden = false;
        _dom.modalTitle.textContent = '神意回执';
        _dom.modalBody.textContent = _fortuneResult;
        _dom.modalCancel.textContent = '关闭';
        _dom.modalConfirm.textContent = '再读一签';
        _dom.modalConfirm.dataset.mode = 'result';
        _dom.primary.disabled = true;
        _dom.secondary.disabled = true;
        Device.mediumVibrate();
    }

    function _openProtocolModal() {
        if (!_dom) return;
        _dom.modal.hidden = false;
        _dom.modalTitle.textContent = '物理掷筊协议说明';
        _dom.modalBody.textContent = '这是上古二进制通讯协议，一平一凸为圣杯（同意），双平为笑杯（含糊），双凸为哭杯（暂不接受）。确认后将切换至已有的物理掷筊组件。';
        _dom.modalCancel.textContent = '再想想';
        _dom.modalConfirm.textContent = '确认启动';
        _dom.modalConfirm.dataset.mode = 'protocol';
    }

    function _closeModal() {
        if (!_dom) return;
        _dom.modal.hidden = true;
    }

    function _clearStickTimers() {
        for (var i = 0; i < _stickTimers.length; i++) {
            window.clearTimeout(_stickTimers[i]);
        }
        _stickTimers = [];
    }

    function _enterBlocksView() {
        _view = 'blocks';
        _phase = 'prepare';
        _shakeCount = 0;
        _result = null;
        _resultTimer = 0;
        _fallTimer = 0;
        _touching = false;
        _closeModal();
        if (_dom && _dom.root) _dom.root.hidden = true;
        _setupPrepareUI();
    }

    function _setupPrepareUI() {
        if (_view !== 'blocks') return;
        UI.clearButtons();

        UI.createButton({
            x: 15, y: 15, w: 70, h: 36,
            text: '返回',
            color: 'rgba(255,255,255,0.7)',
            bgColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.15)',
            fontSize: 13, radius: 18,
            onClick: function () { App.switchScene('home'); }
        });

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
                        if (granted) _setupPrepareUI();
                    });
                }
            });
        }
    }

    function _bindTouchEvents() {
        var canvas = Engine.getCanvas();

        _touchStartHandler = function (e) {
            if (_view !== 'blocks') return;
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
            if (_view !== 'blocks') return;
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

        _shakeCallback = function () {
            if (_phase !== 'shaking') return;
            _doShakeStep();
        };

        if (Device.isMotionGranted()) {
            Device.onShake(_shakeCallback);
        } else {
            var canvas = Engine.getCanvas();
            var lastTap = 0;
            _fallbackTapHandler = function () {
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
            '01',
            '#CD853F',
            18
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
        MeritSystem.showToast('已投入 ' + _moonCost + ' 功德，正在启动物理掷筊协议', 'info');
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

        var rand = Math.random();
        if (rand < 0.5) {
            _result = 'sheng';
            _block1.faceUp = true;
            _block2.faceUp = false;
        } else if (rand < 0.75) {
            _result = 'xiao';
            _block1.faceUp = true;
            _block2.faceUp = true;
        } else {
            _result = 'ku';
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
            MeritSystem.showToast('上古协议通过，功德翻倍！', 'success');
        } else if (_result === 'xiao') {
            MeritSystem.addPoints(_pendingStake);
            MeritSystem.showToast('协议返回含糊，本次功德不变', 'info');
        } else {
            MeritSystem.showToast('协议拒绝，本次功德散尽', 'danger');
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
        Draw.drawPanel(ctx, w * 0.08, h * 0.1, w * 0.84, h * 0.72, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);
        Draw.drawCloud(ctx, (_time * 10 % (w + 100)) - 50, h * 0.08, 0.5, 0.06);

        if (_view === 'sticks') {
            _renderSticksBackdrop(ctx, w, h);
        } else if (_phase === 'prepare') {
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
        if (_view === 'blocks') _drawReturnHint(ctx);
    }

    function _renderSticksBackdrop(ctx, w, h) {
        var titleW = 220, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.08, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, '赛博灵签', w / 2, h * 0.08 + titleH / 2 + 2, 24, Draw.THEME.gold);
        Draw.drawHalo(ctx, w / 2, h * 0.42, 118, '#ff58b3', 0.11 + Math.sin(_time * 2) * 0.04);
        Draw.drawHalo(ctx, w / 2, h * 0.42, 78, '#63efff', 0.08 + Math.sin(_time * 1.6 + 0.3) * 0.03);
        UI.drawSubtitle(ctx, '签筒协议已装载，等待神意握手', w / 2, h * 0.78, 14, '#63efff');
        UI.drawSubtitle(ctx, '若要进入旧神系统，可切换至物理掷筊协议', w / 2, h * 0.83, 12, '#fff2c1');
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
        var titleW = 260, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.08, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, '物理掷筊协议', w / 2, h * 0.08 + titleH / 2 + 2, 22, Draw.THEME.gold);

        Draw.drawMoonBlock(ctx, w * 0.38, h * 0.38, 1.5, true, Math.sin(_time) * 0.1);
        Draw.drawMoonBlock(ctx, w * 0.62, h * 0.42, 1.5, false, Math.cos(_time) * 0.1);
        Draw.drawHalo(ctx, w / 2, h * 0.4, 100, '#ff58b3', 0.1 + Math.sin(_time * 2) * 0.04);

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
        var titleW = 260, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.08, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, '物理掷筊协议', w / 2, h * 0.08 + titleH / 2 + 2, 22, Draw.THEME.gold);

        ctx.save();
        ctx.translate(shake, shake * 0.5);
        Draw.drawMoonBlock(ctx, w * 0.38, h * 0.38, 1.5, true, _time * 3);
        Draw.drawMoonBlock(ctx, w * 0.62, h * 0.42, 1.5, false, -_time * 2.5);
        ctx.restore();

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
        var titleW = 260, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.08, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, '物理掷筊协议', w / 2, h * 0.08 + titleH / 2 + 2, 22, Draw.THEME.gold);

        var blocks = [_block1, _block2];
        var allLanded = true;

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b.landed) {
                b.vy += 0.5;
                b.y += b.vy;
                b.rotation += 0.15 * (i === 0 ? 1 : -1);

                if (b.y >= b.targetY) {
                    b.y = b.targetY;
                    b.landed = true;
                    b.rotation = (Math.random() - 0.5) * 0.3;
                    Device.tapVibrate();
                }
                allLanded = false;
            }

            Draw.drawMoonBlock(ctx, b.x, b.y, 1.8, b.faceUp, b.rotation);
        }

        if (allLanded && _fallTimer > 0.8) _showResult();
    }

    function _renderResult(ctx, w, h) {
        var r = results[_result];
        var fadeIn = Math.min(1, _resultTimer / 0.6);

        Draw.drawMoonBlock(ctx, _block1.x, _block1.targetY, 1.8, _block1.faceUp, _block1.rotation);
        Draw.drawMoonBlock(ctx, _block2.x, _block2.targetY, 1.8, _block2.faceUp, _block2.rotation);
        Draw.drawHalo(ctx, w / 2, h * 0.5, 120, r.color, 0.2 * fadeIn);

        ctx.save();
        ctx.globalAlpha = fadeIn;
        ctx.font = '42px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#24113f';
        ctx.strokeText(r.name, w / 2, h * 0.25);
        ctx.fillStyle = r.color;
        ctx.fillText(r.name, w / 2, h * 0.25);

        ctx.font = '14px "PoxiaoPixel"';
        ctx.lineWidth = 3;
        ctx.strokeText(r.desc, w / 2, h * 0.31);
        ctx.fillStyle = '#63efff';
        ctx.fillText(r.desc, w / 2, h * 0.31);

        ctx.font = '20px "PoxiaoPixel"';
        ctx.strokeText('「' + r.message + '」', w / 2, h * 0.7);
        ctx.fillStyle = '#fff2c1';
        ctx.fillText('「' + r.message + '」', w / 2, h * 0.7);

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
        _clearStickTimers();
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
        if (_dom && _dom.root && _dom.root.parentNode) {
            _dom.root.parentNode.removeChild(_dom.root);
        }
        _dom = null;
    }

    return {
        init: init,
        destroy: destroy
    };
})();
