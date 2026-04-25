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
    var _leftThumbDown = false;
    var _rightThumbDown = false;
    var _time = 0;
    var _resultTimer = 0;
    var _bowCallback = null;
    var _resultQuote = '';
    var _fallbackTapHandler = null;
    var _touchStartHandler = null;
    var _touchMoveHandler = null;
    var _touchEndHandler = null;
    var _motionRequested = false;
    var _incenseGlow = 0;
    var _godImages = {};  // 预加载的财神 SVG 图片
    var _imagesLoaded = false;

    /** 预加载所有财神 SVG 图片 */
    function _preloadGodImages(callback) {
        var mapping = {
            '关二爷': './svgs/关二爷.svg',
            '赵公明': './svgs/赵公明.svg',
            '文财神': './svgs/陶朱公.svg',
            '比干':   './svgs/比干.svg'
        };
        var keys = Object.keys(mapping);
        var loaded = 0;
        var total = keys.length;
        for (var i = 0; i < keys.length; i++) {
            (function (name, src) {
                var img = new Image();
                img.onload = function () {
                    _godImages[name] = img;
                    loaded++;
                    if (loaded >= total) {
                        _imagesLoaded = true;
                        if (callback) callback();
                    }
                };
                img.onerror = function () {
                    // 加载失败，使用 null 标记，渲染时回退到 Canvas 矢量
                    _godImages[name] = null;
                    loaded++;
                    if (loaded >= total) {
                        _imagesLoaded = true;
                        if (callback) callback();
                    }
                };
                img.src = src;
            })(keys[i], mapping[keys[i]]);
        }
    }

    /** 绘制财神形象（优先 SVG 图片，回退 Canvas 矢量） */
    function _drawGodImage(ctx, name, cx, cy, scale, fallbackDraw) {
        var img = _godImages[name];
        if (img) {
            var drawH = 200 * scale;
            var ratio = img.naturalWidth / img.naturalHeight;
            var drawW = drawH * ratio;
            ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
        } else if (fallbackDraw) {
            fallbackDraw(ctx, cx, cy, scale);
        }
    }

    var gods = [
        {
            name: '关二爷',
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '关二爷', cx, cy, s, Draw.drawGuanYu); },
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
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '赵公明', cx, cy, s, Draw.drawZhaoGongMing); },
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
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '文财神', cx, cy, s, Draw.drawWenCaiShen); },
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
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '比干', cx, cy, s, Draw.drawBiGan); },
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
        if (!_imagesLoaded) {
            _preloadGodImages();
        }
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
                y: Engine.height() * 0.5,
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

    function _getThumbZones() {
        var W = Engine.width();
        var H = Engine.height();
        var zoneR = 50;
        var zoneY = H * 0.88;
        return {
            left:  { x: W * 0.22, y: zoneY, r: zoneR },
            right: { x: W * 0.78, y: zoneY, r: zoneR }
        };
    }

    function _checkTouchZones(touches) {
        var zones = _getThumbZones();
        var lHit = false, rHit = false;
        for (var i = 0; i < touches.length; i++) {
            var t = touches[i];
            var rect = Engine.getCanvas().getBoundingClientRect();
            var tx = t.clientX - rect.left;
            var ty = t.clientY - rect.top;
            var dlx = tx - zones.left.x, dly = ty - zones.left.y;
            var drx = tx - zones.right.x, dry = ty - zones.right.y;
            if (Math.sqrt(dlx*dlx + dly*dly) < zones.left.r + 20) lHit = true;
            if (Math.sqrt(drx*drx + dry*dry) < zones.right.r + 20) rHit = true;
        }
        _leftThumbDown = lHit;
        _rightThumbDown = rHit;
        _touching = lHit && rHit;
    }

    function _bindTouchEvents() {
        var canvas = Engine.getCanvas();

        _touchStartHandler = function (e) {
            if (_phase === 'prepare' || _phase === 'bowing') {
                if (e.touches) {
                    _checkTouchZones(e.touches);
                } else {
                    // 桌面鼠标模拟：视为双拇指同时按下
                    _leftThumbDown = true; _rightThumbDown = true; _touching = true;
                }
                if (_phase === 'prepare' && _touching && (Device.isMotionGranted() || !Device.isMotionSupported())) {
                    _startBowing();
                }
            }
        };
        _touchMoveHandler = function (e) {
            if ((_phase === 'prepare' || _phase === 'bowing') && e.touches) {
                _checkTouchZones(e.touches);
            }
        };
        _touchEndHandler = function (e) {
            if (e.touches && e.touches.length > 0) {
                _checkTouchZones(e.touches);
            } else {
                _leftThumbDown = false; _rightThumbDown = false; _touching = false;
            }
        };

        canvas.addEventListener('touchstart', _touchStartHandler, { passive: true });
        canvas.addEventListener('touchmove', _touchMoveHandler, { passive: true });
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

    /** 绘制三根香 */
    function _drawIncense(ctx, w, h) {
        var baseY = h * 0.82;
        var stickH = h * 0.18;
        var positions = [w * 0.42, w * 0.5, w * 0.58];
        _incenseGlow += 0.03;

        for (var i = 0; i < positions.length; i++) {
            var px = positions[i];
            // 火焰
            var flicker = Math.sin(_incenseGlow * 4 + i * 1.5) * 2;
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(px, baseY - stickH - 4 + flicker, 4, 8, 0, 0, Math.PI * 2);
            var fg = ctx.createRadialGradient(px, baseY - stickH - 4 + flicker, 0, px, baseY - stickH - 4 + flicker, 8);
            fg.addColorStop(0, 'rgba(255,200,50,0.95)');
            fg.addColorStop(0.5, 'rgba(255,100,20,0.6)');
            fg.addColorStop(1, 'rgba(255,50,0,0)');
            ctx.fillStyle = fg;
            ctx.fill();
            ctx.restore();

            // 香棍主体
            ctx.beginPath();
            ctx.moveTo(px - 1.5, baseY - stickH);
            ctx.lineTo(px + 1.5, baseY - stickH);
            ctx.lineTo(px + 1, baseY);
            ctx.lineTo(px - 1, baseY);
            ctx.closePath();
            var sg = ctx.createLinearGradient(px, baseY - stickH, px, baseY);
            sg.addColorStop(0, '#8B0000');
            sg.addColorStop(0.3, '#CD3333');
            sg.addColorStop(1, '#8B4513');
            ctx.fillStyle = sg;
            ctx.fill();

            // 烟雾
            var smokeA = 0.12 + Math.sin(_incenseGlow * 2 + i) * 0.06;
            ctx.beginPath();
            ctx.ellipse(px + Math.sin(_incenseGlow + i) * 3, baseY - stickH - 18 + flicker, 6, 12, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(200,200,200,' + smokeA + ')';
            ctx.fill();
        }

        // 香炉底座
        ctx.beginPath();
        ctx.ellipse(w / 2, baseY + 4, 35, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#8B7355';
        ctx.fill();
        ctx.strokeStyle = '#DAA520';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    /** 绘制拇指按压区 */
    function _drawThumbZones(ctx, w, h) {
        var zones = _getThumbZones();
        var arr = [
            { z: zones.left,  down: _leftThumbDown,  label: '左手拇指' },
            { z: zones.right, down: _rightThumbDown, label: '右手拇指' }
        ];
        for (var i = 0; i < arr.length; i++) {
            var item = arr[i];
            var pulse = Math.sin(_time * 5) * 0.1;
            ctx.save();
            ctx.beginPath();
            ctx.arc(item.z.x, item.z.y, item.z.r, 0, Math.PI * 2);
            if (item.down) {
                ctx.fillStyle = 'rgba(255,215,0,0.25)';
                ctx.strokeStyle = 'rgba(255,215,0,0.8)';
            } else {
                ctx.fillStyle = 'rgba(255,255,255,' + (0.06 + pulse) + ')';
                ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + pulse) + ')';
            }
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // 标签
            ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = item.down ? 'rgba(255,215,0,0.9)' : 'rgba(255,255,255,0.45)';
            ctx.fillText(item.label, item.z.x, item.z.y + item.z.r + 16);

            // 按下时的指纹图标
            if (!item.down) {
                ctx.font = '22px -apple-system, sans-serif';
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillText('👆', item.z.x, item.z.y + 7);
            } else {
                ctx.font = '22px -apple-system, sans-serif';
                ctx.fillStyle = 'rgba(255,215,0,0.8)';
                ctx.fillText('✅', item.z.x, item.z.y + 7);
            }
            ctx.restore();
        }
    }

    function _renderPrepare(ctx, w, h, god) {
        Draw.drawHalo(ctx, w / 2, h * 0.28, 80, god.color, 0.15 + Math.sin(_time * 3) * 0.05);
        god.draw(ctx, w / 2, h * 0.3, 1.0);
        UI.drawTitle(ctx, god.name, w / 2, h * 0.08, 24, '#FFD700');

        _drawIncense(ctx, w, h);
        _drawThumbZones(ctx, w, h);

        // 提示
        var alpha = 0.5 + Math.sin(_time * 4) * 0.3;
        ctx.save();
        ctx.font = '15px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,215,0,' + alpha + ')';

        if (Device.isMotionGranted() || !Device.isMotionSupported()) {
            ctx.fillText('👇 请将左右拇指同时按在下方两侧', w / 2, h * 0.55);
            ctx.font = '13px -apple-system, "PingFang SC", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillText(Device.isMotionSupported() ? '按住后上下移动手机参拜' : '按住后点击屏幕参拜', w / 2, h * 0.6);
        } else {
            ctx.fillText('请先开启体感权限', w / 2, h * 0.55);
        }
        ctx.restore();
    }

    function _renderBowing(ctx, w, h, god) {
        var bobY = _touching ? Math.sin(_time * 6) * 5 : 0;
        Draw.drawHalo(ctx, w / 2, h * 0.28 + bobY, 90, god.color, 0.2);
        god.draw(ctx, w / 2, h * 0.3 + bobY, 1.0);

        UI.drawTitle(ctx, god.name, w / 2, h * 0.08, 22, '#FFD700');

        _drawIncense(ctx, w, h);
        _drawThumbZones(ctx, w, h);

        // 拜拜进度
        ctx.save();
        ctx.font = 'bold 42px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(_bowCount + ' / ' + _maxBows, w / 2, h * 0.55);

        ctx.font = '14px -apple-system, "PingFang SC", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        if (!_touching) {
            ctx.fillStyle = 'rgba(255,100,100,0.8)';
            if (!_leftThumbDown && !_rightThumbDown) {
                ctx.fillText('请同时按住下方两个拇指位', w / 2, h * 0.61);
            } else if (!_leftThumbDown) {
                ctx.fillText('请按住左侧拇指位', w / 2, h * 0.61);
            } else {
                ctx.fillText('请按住右侧拇指位', w / 2, h * 0.61);
            }
        } else if (Device.isMotionSupported()) {
            ctx.fillText('保持按住，上下移动手机参拜', w / 2, h * 0.61);
        } else {
            ctx.fillText('点击屏幕参拜', w / 2, h * 0.61);
        }
        ctx.restore();

        // 进度条
        var barW = Math.min(w * 0.5, 180);
        UI.drawProgressBar(ctx, (w - barW) / 2, h * 0.66, barW, 8, _bowCount / _maxBows, '#FFD700');
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
        if (_touchMoveHandler) {
            canvas.removeEventListener('touchmove', _touchMoveHandler);
        }
        if (_touchEndHandler) {
            canvas.removeEventListener('touchend', _touchEndHandler);
            canvas.removeEventListener('mouseup', _touchEndHandler);
        }
        _touchStartHandler = _touchMoveHandler = _touchEndHandler = null;
    }

    return {
        init: init,
        destroy: destroy
    };
})();
