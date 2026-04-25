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
            '赵公明·正财神': './images/赵公明·正财神.png',
            '关二爷·武财神': './images/关二爷·武财神.png',
            '比干·文财神': './images/比干·文财神.png',
            '范蠡·商财神': './images/范蠡·商财神.png'
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
            name: '赵公明·正财神',
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '赵公明·正财神', cx, cy, s, Draw.drawZhaoGongMing); },
            color: '#ff2a2a',
            desc: '掌八方财运，护日常财源，佑稳步暴富',
            hint: '求财刚需首选，打工存钱专属守护神',
            quotes: [
                '五路财神到，金银满堂招',
                '招财进宝，日进斗金',
                '财源广进，富贵临门',
                '黑虎巡财，八方来财'
            ]
        },
        {
            name: '关二爷·武财神',
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '关二爷·武财神', cx, cy, s, Draw.drawGuanYu); },
            color: '#228B22',
            desc: '守忠义正气，镇职场是非，助事业顺遂',
            hint: '职场打拼、面试晋升、远离职场内耗',
            quotes: [
                '忠义相随，财运亨通',
                '义薄云天，福泽绵长',
                '关帝护佑，百业兴旺',
                '正气凛然，邪祟退散'
            ]
        },
        {
            name: '比干·文财神',
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '比干·文财神', cx, cy, s, Draw.drawBiGan); },
            color: '#8a2be2',
            desc: '揽平安福气，解心头烦忧，护岁岁安稳',
            hint: '求身心舒畅、平安健康、告别emo',
            quotes: [
                '心正则财正，无私则无患',
                '七窍玲珑心，公正聚财运',
                '清廉如水，福报自来',
                '无偏无私，财神庇佑'
            ]
        },
        {
            name: '范蠡·商财神',
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '范蠡·商财神', cx, cy, s, Draw.drawWenCaiShen); },
            color: '#00f0ff',
            desc: '通财富玄机，助副业增收，利意外之财',
            hint: '副业创收、理财转运、咸鱼翻身',
            quotes: [
                '商道筹谋，财源滚滚',
                '聚财聚气，万事如意',
                '开源节流，金银满库',
                '机缘巧合，天降横财'
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

        // 左右切换按钮
        var arrowW = 40;
        var arrowH = 60;
        var arrowY = H * 0.35 - arrowH / 2;
        
        UI.createButton({
            x: W * 0.05, y: arrowY, w: arrowW, h: arrowH,
            text: '<',
            color: '#00f0ff', bgColor: 'rgba(0,240,255,0.1)', borderColor: '#00f0ff',
            fontSize: 24, radius: 8,
            onClick: function () {
                Audio.playTap();
                _selectedGod = (_selectedGod - 1 + gods.length) % gods.length;
                _setupSelectButtons();
            }
        });
        
        UI.createButton({
            x: W * 0.95 - arrowW, y: arrowY, w: arrowW, h: arrowH,
            text: '>',
            color: '#00f0ff', bgColor: 'rgba(0,240,255,0.1)', borderColor: '#00f0ff',
            fontSize: 24, radius: 8,
            onClick: function () {
                Audio.playTap();
                _selectedGod = (_selectedGod + 1) % gods.length;
                _setupSelectButtons();
            }
        });

        // 确认按钮
        var confirmW = Math.min(W * 0.6, 220);
        UI.createButton({
            x: (W - confirmW) / 2,
            y: H * 0.75,
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
            text: '返回',
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
            text: '返回',
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
                text: '开启体感权限',
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
            text: '返回',
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
            Engine.addFloatingText(Engine.width() / 2, Engine.height() * 0.35, _bowCount, '#FFD700', 28);
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

        var god = gods[_selectedGod];
        Draw.drawBackground(ctx, w, h);
        Draw.drawFrame(ctx, w, h);

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
        Draw.drawPanel(ctx, w * 0.08, h * 0.1, w * 0.84, h * 0.45, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);
        Draw.drawPanel(ctx, w * 0.08, h * 0.57, w * 0.84, h * 0.15, Draw.THEME.panel, Draw.THEME.pink, Draw.THEME.cyan, Draw.THEME.ink);
        
        // Title Pill
        var titleW = 200, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.06, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, god.name, w / 2, h * 0.06 + titleH / 2 + 2, 22, Draw.THEME.gold);
        
        var bobY = Math.sin(_time * 2.5) * 5; // 自然呼吸悬浮
        Draw.drawHalo(ctx, w / 2, h * 0.33 + bobY, 100, god.color, 0.2);
        god.draw(ctx, w / 2, h * 0.33 + bobY, 1.2);
        
        // 财神简介
        ctx.save();
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        
        // Desc
        ctx.font = '14px "PoxiaoPixel"';
        ctx.strokeStyle = Draw.THEME.ink;
        ctx.strokeText('简介：' + god.desc, w / 2, h * 0.62);
        ctx.fillStyle = Draw.THEME.paper;
        ctx.fillText('简介：' + god.desc, w / 2, h * 0.62);
        
        // Hint
        ctx.font = '12px "PoxiaoPixel"';
        ctx.strokeText(god.hint, w / 2, h * 0.67);
        ctx.fillStyle = Draw.THEME.gold;
        ctx.fillText(god.hint, w / 2, h * 0.67);
        ctx.restore();

        // 底部提示
        UI.drawSubtitle(ctx, '请择一位神明，开启你的专属赛博祈福', w / 2, h * 0.9, 14, Draw.THEME.cyan);
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
            ctx.fillStyle = '#ffd84c';
            ctx.fill();
            ctx.fillStyle = '#ff5a48';
            ctx.fillRect(px - 2, baseY - stickH + flicker - 10, 4, 4);
            ctx.restore();

            // 香棍主体
            ctx.beginPath();
            ctx.moveTo(px - 1.5, baseY - stickH);
            ctx.lineTo(px + 1.5, baseY - stickH);
            ctx.lineTo(px + 1, baseY);
            ctx.lineTo(px - 1, baseY);
            ctx.closePath();
            ctx.fillStyle = '#ff5a48';
            ctx.fill();

            // 烟雾
            var smokeA = 0.12 + Math.sin(_incenseGlow * 2 + i) * 0.06;
            ctx.beginPath();
            ctx.ellipse(px + Math.sin(_incenseGlow + i) * 3, baseY - stickH - 18 + flicker, 6, 12, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(99,239,255,' + smokeA + ')';
            ctx.fill();
        }

        // 香炉底座
        ctx.beginPath();
        ctx.ellipse(w / 2, baseY + 4, 35, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd84c';
        ctx.fill();
        ctx.strokeStyle = '#24113f';
        ctx.lineWidth = 3;
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
                ctx.fillStyle = 'rgba(255,88,179,0.25)';
                ctx.strokeStyle = 'rgba(255,216,76,0.95)';
            } else {
                ctx.fillStyle = 'rgba(99,239,255,' + (0.08 + pulse) + ')';
                ctx.strokeStyle = 'rgba(99,239,255,' + (0.35 + pulse) + ')';
            }
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.stroke();

            // 标签
            ctx.font = '12px "PoxiaoPixel"';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#24113f';
            ctx.strokeText(item.label, item.z.x, item.z.y + item.z.r + 16);
            ctx.fillStyle = item.down ? '#ffd84c' : '#fff2c1';
            ctx.fillText(item.label, item.z.x, item.z.y + item.z.r + 16);

            // 按下时的指纹图标
            if (!item.down) {
                ctx.font = '18px "PoxiaoPixel"';
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillText('按', item.z.x, item.z.y + 7);
            } else {
                ctx.font = '18px "PoxiaoPixel"';
                ctx.fillStyle = 'rgba(255,215,0,0.8)';
                ctx.fillText('好', item.z.x, item.z.y + 7);
            }
            ctx.restore();
        }
    }

    function _renderPrepare(ctx, w, h, god) {
        Draw.drawPanel(ctx, w * 0.08, h * 0.1, w * 0.84, h * 0.58, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);
        
        var titleW = 220, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.06, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, god.name, w / 2, h * 0.06 + titleH / 2 + 2, 22, Draw.THEME.gold);

        var bobY = Math.sin(_time * 2.5) * 5; // 悬浮
        Draw.drawHalo(ctx, w / 2, h * 0.28 + bobY, 80, god.color, 0.15 + Math.sin(_time * 3) * 0.05);
        god.draw(ctx, w / 2, h * 0.3 + bobY, 1.0);

        _drawIncense(ctx, w, h);
        _drawThumbZones(ctx, w, h);

        // 提示
        var alpha = 0.5 + Math.sin(_time * 4) * 0.3;
        ctx.save();
        ctx.font = '15px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#24113f';
        ctx.fillStyle = 'rgba(255,216,76,' + alpha + ')';

        if (Device.isMotionGranted() || !Device.isMotionSupported()) {
            ctx.strokeText('请将左右拇指同时按在下方两侧', w / 2, h * 0.55);
            ctx.fillText('请将左右拇指同时按在下方两侧', w / 2, h * 0.55);
            ctx.font = '13px "PoxiaoPixel"';
            ctx.fillStyle = '#fff2c1';
            ctx.strokeText(Device.isMotionSupported() ? '按住后上下移动手机参拜' : '按住后点击屏幕参拜', w / 2, h * 0.6);
            ctx.fillText(Device.isMotionSupported() ? '按住后上下移动手机参拜' : '按住后点击屏幕参拜', w / 2, h * 0.6);
        } else {
            ctx.strokeText('请先开启体感权限', w / 2, h * 0.55);
            ctx.fillText('请先开启体感权限', w / 2, h * 0.55);
        }
        ctx.restore();
    }

    function _renderBowing(ctx, w, h, god) {
        var bobY = _touching ? Math.sin(_time * 6) * 5 : Math.sin(_time * 2.5) * 5;
        Draw.drawPanel(ctx, w * 0.08, h * 0.1, w * 0.84, h * 0.62, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);
        
        var titleW = 220, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.06, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, god.name, w / 2, h * 0.06 + titleH / 2 + 2, 22, Draw.THEME.gold);

        Draw.drawHalo(ctx, w / 2, h * 0.28 + bobY, 90, god.color, 0.2);
        god.draw(ctx, w / 2, h * 0.3 + bobY, 1.0);

        _drawIncense(ctx, w, h);
        _drawThumbZones(ctx, w, h);

        // 拜拜进度
        ctx.save();
        ctx.font = '42px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#24113f';
        ctx.strokeText(_bowCount + ' / ' + _maxBows, w / 2, h * 0.55);
        ctx.fillStyle = '#ffd84c';
        ctx.fillText(_bowCount + ' / ' + _maxBows, w / 2, h * 0.55);

        ctx.font = '14px "PoxiaoPixel"';
        ctx.lineWidth = 3;
        ctx.fillStyle = '#fff2c1';
        if (!_touching) {
            ctx.fillStyle = '#ff5a48';
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
        UI.drawProgressBar(ctx, (w - barW) / 2, h * 0.66, barW, 8, _bowCount / _maxBows, '#ff58b3');
    }

    function _renderResult(ctx, w, h, god) {
        var fadeIn = Math.min(1, _resultTimer / 0.5);

        Draw.drawPanel(ctx, w * 0.08, h * 0.12, w * 0.84, h * 0.62, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.gold, Draw.THEME.ink);
        
        var titleW = 240, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.08, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, god.name + ' 赐福', w / 2, h * 0.08 + titleH / 2 + 2, 20, Draw.THEME.gold);

        var bobY = Math.sin(_time * 2.5) * 5;
        Draw.drawHalo(ctx, w / 2, h * 0.3 + bobY, 130, Draw.THEME.gold, 0.3 * fadeIn);
        god.draw(ctx, w / 2, h * 0.32 + bobY, 1.3);

        ctx.save();
        ctx.globalAlpha = fadeIn;

        ctx.font = '18px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#24113f';
        ctx.strokeText('「' + _resultQuote + '」', w / 2, h * 0.63);
        ctx.fillStyle = '#fff2c1';
        ctx.fillText('「' + _resultQuote + '」', w / 2, h * 0.63);

        // 祝福副标题
        ctx.font = '14px "PoxiaoPixel"';
        ctx.strokeText('诚心祈福，自有天佑', w / 2, h * 0.69);
        ctx.fillStyle = '#63efff';
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
