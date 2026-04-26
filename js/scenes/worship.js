/**
 * worship.js — 拜财神场景
 */
var WorshipScene = (function () {
    'use strict';

    var _phase = 'select'; // select → prepare → bowing → result(燃烧显影/海报)
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
    var _desktopMode = false;
    var _spaceDown = false;
    var _desktopLastY = null;
    var _desktopSlideDelta = 0;
    var _desktopSlideDir = 0;
    var _desktopSlideCount = 0;
    var _desktopKeyHandler = null;
    var _desktopMoveHandler = null;
    var _godImages = {};  // 预加载的财神 PNG 图片
    var _imagesLoaded = false;
    var _worshipCost = 10;
    var _insufficientHintTimer = 0;
    var _selectReactTimer = 0;
    var _selectReactCooldown = 0;
    var _selectReactMode = '';
    var _selectReactLabel = '';
    var _posterState = 'idle';
    var _posterGeneratedUrl = '';
    var _posterBindingReady = false;
    var _godImageMapping = {
        '赵公明·正财神': './images/赵公明·正财神.png',
        '关二爷·武财神': './images/关二爷·武财神.png',
        '比干·文财神': './images/比干·文财神.png',
        '范蠡·商财神': './images/范蠡·商财神.png'
    };
    var _qrPlaceholder = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">' +
        '<rect width="180" height="180" fill="#ffffff"/>' +
        '<rect x="12" y="12" width="48" height="48" fill="#111111"/>' +
        '<rect x="24" y="24" width="24" height="24" fill="#ffffff"/>' +
        '<rect x="120" y="12" width="48" height="48" fill="#111111"/>' +
        '<rect x="132" y="24" width="24" height="24" fill="#ffffff"/>' +
        '<rect x="12" y="120" width="48" height="48" fill="#111111"/>' +
        '<rect x="24" y="132" width="24" height="24" fill="#ffffff"/>' +
        '<rect x="78" y="18" width="12" height="12" fill="#111111"/>' +
        '<rect x="90" y="30" width="12" height="12" fill="#111111"/>' +
        '<rect x="102" y="18" width="12" height="12" fill="#111111"/>' +
        '<rect x="78" y="54" width="12" height="12" fill="#111111"/>' +
        '<rect x="96" y="60" width="18" height="18" fill="#111111"/>' +
        '<rect x="72" y="84" width="12" height="12" fill="#111111"/>' +
        '<rect x="90" y="90" width="18" height="18" fill="#111111"/>' +
        '<rect x="120" y="78" width="12" height="12" fill="#111111"/>' +
        '<rect x="132" y="90" width="12" height="12" fill="#111111"/>' +
        '<rect x="144" y="102" width="12" height="12" fill="#111111"/>' +
        '<rect x="72" y="120" width="12" height="12" fill="#111111"/>' +
        '<rect x="84" y="132" width="24" height="12" fill="#111111"/>' +
        '<rect x="114" y="126" width="12" height="12" fill="#111111"/>' +
        '<rect x="126" y="138" width="12" height="12" fill="#111111"/>' +
        '<rect x="144" y="126" width="18" height="18" fill="#111111"/>' +
        '<rect x="72" y="150" width="12" height="12" fill="#111111"/>' +
        '<rect x="96" y="150" width="12" height="12" fill="#111111"/>' +
        '<rect x="120" y="156" width="12" height="12" fill="#111111"/>' +
        '</svg>'
    );

    /** 预加载所有财神 PNG 图片 */
    function _preloadGodImages(callback) {
        var keys = Object.keys(_godImageMapping);
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
                    // 加载失败时只显示占位提示，不再回退到矢量图
                    _godImages[name] = null;
                    loaded++;
                    if (loaded >= total) {
                        _imagesLoaded = true;
                        if (callback) callback();
                    }
                };
                img.src = src;
            })(keys[i], _godImageMapping[keys[i]]);
        }
    }

    /** 只绘制 PNG，避免再回退到旧的矢量财神 */
    function _drawGodImage(ctx, name, cx, cy, scale) {
        var img = _godImages[name];
        if (img && img.complete) {
            var drawH = 200 * scale;
            var ratio = img.naturalWidth / img.naturalHeight;
            var drawW = drawH * ratio;
            ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
        } else {
            _drawImagePlaceholder(ctx, cx, cy, scale);
        }
    }

    function _drawImagePlaceholder(ctx, cx, cy, scale) {
        var boxW = 120 * scale;
        var boxH = 150 * scale;
        ctx.save();
        ctx.fillStyle = 'rgba(36,17,63,0.82)';
        ctx.strokeStyle = '#63efff';
        ctx.lineWidth = 3;
        ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
        ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
        ctx.font = '12px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#24113f';
        ctx.strokeText('PNG载入中', cx, cy);
        ctx.fillStyle = '#fff2c1';
        ctx.fillText('PNG载入中', cx, cy);
        ctx.restore();
    }

    function _triggerInsufficientHint() {
        _insufficientHintTimer = 2.6;
    }

    var _IS_MOBILE_RE = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i;
    function _ensureDeviceMobileFallback() {
        if (!window.Device) return;
        if (typeof Device.isMobile !== 'function') {
            Device.isMobile = function () {
                return _IS_MOBILE_RE.test(navigator.userAgent);
            };
        }
    }

    function _isMobileClient() {
        return _IS_MOBILE_RE.test(navigator.userAgent);
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

    function _getCanvasPoint(e) {
        var canvas = Engine.getCanvas();
        var rect = canvas.getBoundingClientRect();
        var touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
        if (!touch) return null;
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }

    function _getSelectGodMetrics(w, h) {
        var bobY = Math.sin(_time * 2.5) * 5;
        var cx = w / 2;
        var cy = h * 0.33 + bobY;
        var drawH = 240;
        var drawW = 180;
        var img = _godImages[gods[_selectedGod].name];
        if (img && img.complete && img.naturalWidth && img.naturalHeight) {
            drawW = drawH * (img.naturalWidth / img.naturalHeight);
        }
        return {
            cx: cx,
            cy: cy,
            drawW: drawW,
            drawH: drawH
        };
    }

    function _isSelectGodHit(x, y) {
        var m = _getSelectGodMetrics(Engine.width(), Engine.height());
        return x >= m.cx - m.drawW / 2 && x <= m.cx + m.drawW / 2 &&
            y >= m.cy - m.drawH / 2 && y <= m.cy + m.drawH / 2;
    }

    function _triggerSelectReaction(x, y) {
        if (_selectReactCooldown > 0) return;
        var god = gods[_selectedGod];
        var m = _getSelectGodMetrics(Engine.width(), Engine.height());
        var px = x || m.cx;
        var py = y || m.cy;

        _selectReactCooldown = 0.45;
        _selectReactTimer = 1;
        _selectReactMode = ['zhao', 'guan', 'bigan', 'fanli'][_selectedGod] || 'zhao';
        Audio.playTap();
        Device.tapVibrate();

        if (_selectedGod === 0) {
            _selectReactLabel = '财运暴击';
            Engine.addGoldBurst(px, py, {
                count: 26,
                speed: 3.6,
                ringRadius: 34,
                upwardLift: 0.3,
                pixel: true,
                flashCoreRadius: 12,
                flashHaloRadius: 20
            });
            Engine.addFloatingText(m.cx, m.cy - 96, '财运暴击', '#ffd84c', 22);
        } else if (_selectedGod === 1) {
            _selectReactLabel = '正气开刃';
            Engine.addParticle(px, py, '#56ff9f', {
                count: 18,
                speed: 3.2,
                radius: 3,
                decay: 0.03
            });
            Engine.addFloatingText(m.cx, m.cy - 96, '正气开刃', '#56ff9f', 22);
        } else if (_selectedGod === 2) {
            _selectReactLabel = '心灯护体';
            Engine.addParticle(px, py, '#c07cff', {
                count: 16,
                speed: 2.5,
                radius: 3,
                decay: 0.024
            });
            Engine.addFloatingText(m.cx, m.cy - 96, '心灯护体', '#dba8ff', 22);
        } else {
            _selectReactLabel = '机缘加载';
            Engine.addParticle(px, py, '#63efff', {
                count: 22,
                speed: 3.1,
                radius: 2,
                decay: 0.028
            });
            Engine.addFloatingText(m.cx, m.cy - 96, '机缘加载', '#63efff', 22);
        }
    }

    function _renderSelectReaction(ctx, w, h, god) {
        if (_selectReactTimer <= 0) return;
        var m = _getSelectGodMetrics(w, h);
        var t = _selectReactTimer;
        var pulse = 1 - t;
        var i;

        ctx.save();
        ctx.translate(m.cx, m.cy);

        if (_selectReactMode === 'zhao') {
            for (i = 0; i < 8; i++) {
                var a = pulse * 6 + i * Math.PI / 4;
                var r = 66 + Math.sin(_time * 5 + i) * 8;
                var sx = Math.cos(a) * r;
                var sy = Math.sin(a) * (r * 0.58);
                ctx.fillStyle = 'rgba(255,216,76,' + (0.18 + t * 0.42) + ')';
                ctx.fillRect(Math.round(sx - 6), Math.round(sy - 6), 12, 12);
            }
            ctx.strokeStyle = 'rgba(255,216,76,' + (0.2 + t * 0.5) + ')';
            ctx.lineWidth = 4;
            ctx.strokeRect(-58 - pulse * 16, -74 - pulse * 8, 116 + pulse * 32, 148 + pulse * 16);
        } else if (_selectReactMode === 'guan') {
            ctx.strokeStyle = 'rgba(86,255,159,' + (0.22 + t * 0.55) + ')';
            ctx.lineWidth = 4;
            for (i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(0, 0, 72 + i * 14 + pulse * 18, -0.85 + i * 0.15, 0.25 + i * 0.15);
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(-86 + pulse * 18, 58);
            ctx.lineTo(94 - pulse * 16, -48);
            ctx.strokeStyle = 'rgba(255,242,193,' + (0.18 + t * 0.65) + ')';
            ctx.lineWidth = 5;
            ctx.stroke();
        } else if (_selectReactMode === 'bigan') {
            ctx.beginPath();
            ctx.ellipse(0, 0, 84 + pulse * 10, 110 + pulse * 10, 0, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(192,124,255,' + (0.18 + t * 0.48) + ')';
            ctx.lineWidth = 4;
            ctx.stroke();
            for (i = 0; i < 6; i++) {
                var starA = i * Math.PI / 3 + pulse * 2;
                var starX = Math.cos(starA) * 74;
                var starY = Math.sin(starA) * 52;
                ctx.fillStyle = 'rgba(255,242,193,' + (0.18 + t * 0.55) + ')';
                ctx.fillRect(Math.round(starX), Math.round(starY), 4, 4);
                ctx.fillRect(Math.round(starX - 4), Math.round(starY + 4), 4, 4);
            }
        } else if (_selectReactMode === 'fanli') {
            for (i = 0; i < 5; i++) {
                var yOff = -70 + i * 34 + Math.sin(_time * 5 + i) * 4;
                ctx.fillStyle = 'rgba(99,239,255,' + (0.14 + t * 0.42) + ')';
                ctx.fillRect(-94 + pulse * 18, yOff, 188 - pulse * 36, 6);
            }
            for (i = 0; i < 7; i++) {
                var dotA = pulse * 7 + i * Math.PI / 3.5;
                ctx.fillStyle = 'rgba(255,216,76,' + (0.16 + t * 0.42) + ')';
                ctx.beginPath();
                ctx.arc(Math.cos(dotA) * 82, Math.sin(dotA * 1.2) * 44, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();

        ctx.save();
        ctx.font = '12px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#24113f';
        ctx.strokeText(_selectReactLabel, m.cx, m.cy + m.drawH / 2 + 14);
        ctx.fillStyle = god.color;
        ctx.fillText(_selectReactLabel, m.cx, m.cy + m.drawH / 2 + 14);
        ctx.restore();
    }

    var gods = [
        {
            name: '赵公明·正财神',
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '赵公明·正财神', cx, cy, s); },
            color: '#ff2a2a',
            desc: '掌八方财运，护日常财源，佑稳步暴富',
            hint: '求财刚需首选，打工存钱专属守护神',
            posterBlessing: '福佑：财源滚滚',
            quotes: [
                '五路财神到，金银满堂招',
                '招财进宝，日进斗金',
                '财源广进，富贵临门',
                '黑虎巡财，八方来财'
            ]
        },
        {
            name: '关二爷·武财神',
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '关二爷·武财神', cx, cy, s); },
            color: '#228B22',
            desc: '守忠义正气，镇职场是非，助事业顺遂',
            hint: '职场打拼、面试晋升、远离职场内耗',
            posterBlessing: '福佑：事业开挂',
            quotes: [
                '忠义相随，财运亨通',
                '义薄云天，福泽绵长',
                '关帝护佑，百业兴旺',
                '正气凛然，邪祟退散'
            ]
        },
        {
            name: '比干·文财神',
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '比干·文财神', cx, cy, s); },
            color: '#8a2be2',
            desc: '揽平安福气，解心头烦忧，护岁岁安稳',
            hint: '求身心舒畅、平安健康、告别emo',
            posterBlessing: '福佑：福运安康',
            quotes: [
                '心正则财正，无私则无患',
                '七窍玲珑心，公正聚财运',
                '清廉如水，福报自来',
                '无偏无私，财神庇佑'
            ]
        },
        {
            name: '范蠡·商财神',
            draw: function (ctx, cx, cy, s) { _drawGodImage(ctx, '范蠡·商财神', cx, cy, s); },
            color: '#00f0ff',
            desc: '通财富玄机，助副业增收，利意外之财',
            hint: '副业创收、理财转运、咸鱼翻身',
            posterBlessing: '福佑：偏财觉醒',
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
        _insufficientHintTimer = 0;
        _selectReactTimer = 0;
        _selectReactCooldown = 0;
        _selectReactMode = '';
        _selectReactLabel = '';
        _posterState = 'idle';
        _posterGeneratedUrl = '';
        UI.clearButtons();
        _ensureDeviceMobileFallback();
        _hidePosterOverlay();
        _ensurePosterDom();
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
                if (!MeritSystem.canAfford(_worshipCost)) {
                    MeritSystem.showToast('功德不足，请先敲击木鱼积攒功德', 'warning');
                    _triggerInsufficientHint();
                    return;
                }
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

        // 请求陀螺仪权限（仅移动端需要）
        if (!_isMobileClient()) {
            // 桌面端：跳过权限申请，直接进入 bowing
            UI.createButton({
                x: 15, y: 15, w: 70, h: 36,
                text: '返回',
                color: 'rgba(255,255,255,0.7)',
                bgColor: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.15)',
                fontSize: 13, radius: 18,
                onClick: function () {
                    _phase = 'select';
                    _cleanupDesktopFallback();
                    _setupSelectButtons();
                }
            });
            _startBowing();
        } else if (!Device.isMotionGranted()) {
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
            if (_phase === 'select') {
                var point = _getCanvasPoint(e);
                if (point && _isSelectGodHit(point.x, point.y)) {
                    _triggerSelectReaction(point.x, point.y);
                }
                return;
            }
            if (_phase === 'prepare' || _phase === 'bowing') {
                if (e.touches) {
                    _checkTouchZones(e.touches);
                } else {
                    // 桌面鼠标模拟：视为双拇指同时按下
                    _leftThumbDown = true; _rightThumbDown = true; _touching = true;
                }
                if (_phase === 'prepare' && _touching && (Device.isMotionGranted() || !_isMobileClient())) {
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
        } else if (!_isMobileClient()) {
            // 桌面端：空格 + 鼠标上下滑动
            _bowCallback = null;
            _setupDesktopFallback(doBow);
        } else {
            // 有陀螺仪权限但未授权 → 点击屏幕计数
            _bowCallback = null;
            var canvas = Engine.getCanvas();
            var lastTap = 0;
            _fallbackTapHandler = function (e) {
                if (_phase !== 'bowing') return;
                var now = Date.now();
                if (now - lastTap < 400) return;
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
        _cleanupDesktopFallback();
    }

    function _setupDesktopFallback(doBow) {
        _desktopMode = true;
        _desktopSlideCount = 0;
        _desktopSlideDelta = 0;
        _desktopSlideDir = 0;
        _desktopLastY = null;

        _desktopKeyHandler = function (e) {
            if (e.code === 'Space') {
                if (e.type === 'keydown' && !_spaceDown) {
                    _spaceDown = true;
                    _desktopLastY = null;
                    _desktopSlideDelta = 0;
                    _desktopSlideDir = 0;
                } else if (e.type === 'keyup' && _spaceDown) {
                    _spaceDown = false;
                }
            }
        };

        _desktopMoveHandler = function (e) {
            if (!_spaceDown) return;

            var dy = e.movementY;
            if (dy == null) {
                if (_desktopLastY == null) {
                    _desktopLastY = e.clientY;
                    return;
                }
                dy = e.clientY - _desktopLastY;
            }
            _desktopLastY = e.clientY;
            _desktopSlideDelta += dy;

            var dir = _desktopSlideDelta > 0 ? 1 : _desktopSlideDelta < 0 ? -1 : 0;
            if (dir !== 0 && dir !== _desktopSlideDir) {
                if (Math.abs(_desktopSlideDelta) >= 50) {
                    _desktopSlideCount++;
                    _desktopSlideDelta = 0;
                    _desktopSlideDir = 0;
                    Device.tapVibrate();
                    doBow();
                } else {
                    _desktopSlideDir = dir;
                }
            }
        };

        document.addEventListener('keydown', _desktopKeyHandler);
        document.addEventListener('keyup', _desktopKeyHandler);
        document.addEventListener('mousemove', _desktopMoveHandler);
    }

    function _cleanupDesktopFallback() {
        _desktopMode = false;
        if (_desktopKeyHandler) {
            document.removeEventListener('keydown', _desktopKeyHandler);
            document.removeEventListener('keyup', _desktopKeyHandler);
            _desktopKeyHandler = null;
        }
        if (_desktopMoveHandler) {
            document.removeEventListener('mousemove', _desktopMoveHandler);
            _desktopMoveHandler = null;
        }
    }

    function _showResult() {
        _phase = 'result';
        _resultTimer = 0;
        _posterState = 'idle';
        _posterGeneratedUrl = '';
        _hidePosterOverlay();
        var god = gods[_selectedGod];
        var W = Engine.width();

        _resultQuote = god.quotes[Math.floor(Math.random() * god.quotes.length)];

        Engine.addGoldBurst(W / 2, Engine.height() * 0.35, {
            count: 32,
            speed: 3.8,
            ringRadius: 34,
            upwardLift: 0.55,
            flashCoreRadius: 12,
            flashHaloRadius: 22
        });
        Audio.playSuccess();
        Device.mediumVibrate();
        MeritSystem.deductPoints(_worshipCost);
        MeritSystem.showToast('虔心已达，神谕正在显影', 'success');
        UI.clearButtons();
    }

    function render(ctx, w, h) {
        _time += 0.016;
        if (_insufficientHintTimer > 0) _insufficientHintTimer -= 0.016;
        if (_selectReactTimer > 0) _selectReactTimer -= 0.03;
        if (_selectReactCooldown > 0) _selectReactCooldown -= 0.016;

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
        _drawReturnHint(ctx);
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
        _renderSelectReaction(ctx, w, h, god);
        
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
        UI.drawSubtitle(ctx, '请择一位神明，点一下看看他的脾气', w / 2, h * 0.88, 14, Draw.THEME.cyan);
        UI.drawSubtitle(ctx, '每次参拜消耗 ' + _worshipCost + ' 功德', w / 2, h * 0.92, 12, Draw.THEME.gold);
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
            var pulse = (Math.sin(_time * 1.5) + 1) / 2 * 0.18 + 0.06;
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

        if (Device.isMotionGranted() || !_isMobileClient()) {
            ctx.strokeText('请将左右拇指同时按在下方两侧', w / 2, h * 0.55);
            ctx.fillText('请将左右拇指同时按在下方两侧', w / 2, h * 0.55);
            ctx.font = '13px "PoxiaoPixel"';
            ctx.fillStyle = '#fff2c1';
            ctx.strokeText(_isMobileClient() ? '按住后上下移动手机参拜' : '按住后点击屏幕参拜', w / 2, h * 0.6);
            ctx.fillText(_isMobileClient() ? '按住后上下移动手机参拜' : '按住后点击屏幕参拜', w / 2, h * 0.6);
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
        if (_desktopMode) {
            var pulse = (Math.sin(_time * 1.5) + 1) / 2 * 0.4 + 0.6;
            ctx.fillStyle = 'rgba(255,216,76,' + (0.6 + pulse * 0.4) + ')';
            ctx.fillText('按住 [空格键] 并上下移动鼠标 ' + _bowCount + ' / ' + _maxBows, w / 2, h * 0.61);
        } else if (!_touching) {
            ctx.fillStyle = '#ff5a48';
            if (!_leftThumbDown && !_rightThumbDown) {
                ctx.fillText('请同时按住下方两个拇指位', w / 2, h * 0.61);
            } else if (!_leftThumbDown) {
                ctx.fillText('请按住左侧拇指位', w / 2, h * 0.61);
            } else {
                ctx.fillText('请按住右侧拇指位', w / 2, h * 0.61);
            }
        } else if (_isMobileClient()) {
            ctx.fillText('保持按住，上下移动手机参拜', w / 2, h * 0.61);
        } else {
            ctx.fillText('点击屏幕参拜', w / 2, h * 0.61);
        }
        ctx.restore();

        // 进度条
        var barW = Math.min(w * 0.5, 180);
        UI.drawProgressBar(ctx, (w - barW) / 2, h * 0.66, barW, 8, _bowCount / _maxBows, '#ff58b3');
    }

    function _ensurePosterDom() {
        var overlay = document.getElementById('posterOverlay');
        var poster = document.getElementById('sharePoster');
        if (!overlay || !poster) return null;

        var els = {
            overlay: overlay,
            poster: poster,
            previewImage: document.getElementById('posterPreviewImage'),
            replayButton: document.getElementById('posterReplayButton'),
            homeButton: document.getElementById('posterHomeButton'),
            nickname: document.getElementById('posterNickname'),
            godImage: document.getElementById('posterGodImage'),
            godName: document.getElementById('posterGodName'),
            blessing: document.getElementById('posterBlessing'),
            quote: document.getElementById('posterQuote'),
            qrImage: document.getElementById('posterQrImage')
        };

        if (els.qrImage && els.qrImage.src !== _qrPlaceholder) {
            els.qrImage.src = _qrPlaceholder;
        }

        if (!_posterBindingReady && els.replayButton && els.homeButton) {
            els.replayButton.addEventListener('click', function () {
                Audio.playTap();
                _hidePosterOverlay();
                _posterState = 'idle';
                _posterGeneratedUrl = '';
                _phase = 'select';
                _resultTimer = 0;
                _setupSelectButtons();
            });
            els.homeButton.addEventListener('click', function () {
                Audio.playTap();
                _hidePosterOverlay();
                App.switchScene('home');
            });
            _posterBindingReady = true;
        }

        return els;
    }

    function _hidePosterOverlay() {
        var overlay = document.getElementById('posterOverlay');
        var preview = document.getElementById('posterPreviewImage');
        if (overlay) overlay.hidden = true;
        if (preview) preview.removeAttribute('src');
    }

    function _getPosterNickname() {
        var key = 'cyberluck.posterNickname';
        try {
            var stored = localStorage.getItem(key);
            if (stored) return stored;
            stored = '赛博信众#' + (1000 + Math.floor(Math.random() * 9000));
            localStorage.setItem(key, stored);
            return stored;
        } catch (e) {
            return '赛博信众#' + (1000 + Math.floor(Math.random() * 9000));
        }
    }

    function _fillPosterDom(god) {
        var els = _ensurePosterDom();
        if (!els) return null;
        if (els.nickname) els.nickname.textContent = _getPosterNickname();
        if (els.godName) els.godName.textContent = god.name;
        if (els.blessing) els.blessing.textContent = god.posterBlessing || '福佑：财源滚滚';
        if (els.quote) els.quote.textContent = '「' + _resultQuote + '」';
        if (els.godImage) {
            els.godImage.src = _godImageMapping[god.name] || '';
            els.godImage.alt = god.name;
        }
        if (els.qrImage) els.qrImage.src = _qrPlaceholder;
        return els;
    }

    function _waitForImage(img) {
        return new Promise(function (resolve) {
            if (!img) {
                resolve();
                return;
            }
            if (img.complete && img.naturalWidth !== 0) {
                resolve();
                return;
            }
            var done = function () {
                img.removeEventListener('load', done);
                img.removeEventListener('error', done);
                resolve();
            };
            img.addEventListener('load', done);
            img.addEventListener('error', done);
        });
    }

    function _showPosterOverlay(dataUrl) {
        var els = _ensurePosterDom();
        if (!els || !els.previewImage) return;
        els.previewImage.src = dataUrl;
        els.overlay.hidden = false;
    }

    function _renderPosterFallback(god, els) {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        canvas.width = 860;
        canvas.height = 1520;

        var grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#110928');
        grad.addColorStop(1, '#2b124a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#63efff';
        ctx.lineWidth = 8;
        ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
        ctx.strokeStyle = '#ff58b3';
        ctx.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);

        ctx.fillStyle = '#63efff';
        ctx.font = '28px "PoxiaoPixel"';
        ctx.fillText('CYBER BLESSING', 64, 94);

        ctx.fillStyle = '#ffea00';
        ctx.font = '40px "PoxiaoPixel"';
        ctx.fillText(_getPosterNickname(), 64, 154);

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (var y = 0; y < canvas.height; y += 34) {
            ctx.fillRect(0, y, canvas.width, 1);
        }
        for (var x = 0; x < canvas.width; x += 34) {
            ctx.fillRect(x, 0, 1, canvas.height);
        }

        ctx.fillStyle = 'rgba(17,10,40,0.72)';
        ctx.fillRect(72, 214, 716, 640);
        ctx.strokeStyle = '#ffd84c';
        ctx.lineWidth = 6;
        ctx.strokeRect(72, 214, 716, 640);

        if (els && els.godImage && els.godImage.complete && els.godImage.naturalWidth) {
            var img = els.godImage;
            var drawH = 520;
            var drawW = drawH * (img.naturalWidth / img.naturalHeight);
            ctx.drawImage(img, (canvas.width - drawW) / 2, 260, drawW, drawH);
        }

        ctx.fillStyle = '#63efff';
        ctx.font = '38px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.fillText(god.name, canvas.width / 2, 906);

        ctx.fillStyle = '#ffea00';
        ctx.font = '56px "PoxiaoPixel"';
        ctx.fillText(god.posterBlessing || '福佑：财源滚滚', canvas.width / 2, 1030);

        ctx.fillStyle = '#fff2c1';
        ctx.font = '30px "PoxiaoPixel"';
        ctx.fillText('「' + _resultQuote + '」', canvas.width / 2, 1110);

        if (els && els.qrImage && els.qrImage.complete) {
            ctx.drawImage(els.qrImage, 88, 1220, 180, 180);
        }

        ctx.textAlign = 'left';
        ctx.fillStyle = '#ff58b3';
        ctx.font = '34px "PoxiaoPixel"';
        ctx.fillText('Vercel 神经祈福链路', 304, 1288);
        ctx.fillStyle = '#fff2c1';
        ctx.font = '24px "PoxiaoPixel"';
        ctx.fillText('长按/扫码接入神经祈福链路', 304, 1350);
        return canvas;
    }

    function _generateSharePoster(god) {
        var els = _fillPosterDom(god);
        if (!els) return Promise.reject(new Error('poster-dom-missing'));

        return Promise.all([
            _waitForImage(els.godImage),
            _waitForImage(els.qrImage),
            document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
        ]).then(function () {
            if (window.html2canvas) {
                return window.html2canvas(els.poster, {
                    backgroundColor: null,
                    scale: Math.max(2, Math.min(3, window.devicePixelRatio || 2)),
                    useCORS: true
                });
            }
            return _renderPosterFallback(god, els);
        }).then(function (canvas) {
            return canvas.toDataURL('image/png', 1);
        });
    }

    function _queuePosterGeneration(god) {
        if (_posterState !== 'idle' || _resultTimer < 1.2) return;
        _posterState = 'generating';
        _generateSharePoster(god).then(function (dataUrl) {
            _posterGeneratedUrl = dataUrl;
            _posterState = 'ready';
            _showPosterOverlay(dataUrl);
        }).catch(function () {
            _posterState = 'error';
            MeritSystem.showToast('海报生成失败，请稍后再试', 'warning');
            _phase = 'select';
            _setupSelectButtons();
        });
    }

    function _renderResult(ctx, w, h, god) {
        var fadeIn = Math.min(1, _resultTimer / 0.5);
        var flare = Math.min(1, _resultTimer / 1.15);
        var burnPulse = 0.35 + (Math.sin(_time * 7) + 1) / 2 * 0.45;
        var panelY = h * 0.1;
        var panelH = h * 0.68;

        Draw.drawPanel(ctx, w * 0.08, panelY, w * 0.84, panelH, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.gold, Draw.THEME.ink);

        var titleW = 248, titleH = 48;
        UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.06, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        UI.drawTitle(ctx, god.name + ' 神谕显影', w / 2, h * 0.06 + titleH / 2 + 2, 20, Draw.THEME.gold);

        Draw.drawHalo(ctx, w / 2, h * 0.3, 110 + flare * 48, god.color, 0.14 + flare * 0.2);
        Draw.drawHalo(ctx, w / 2, h * 0.3, 76 + flare * 22, '#ffd84c', 0.12 + burnPulse * 0.12);
        god.draw(ctx, w / 2, h * 0.3 + Math.sin(_time * 3.5) * 4, 1.16 + flare * 0.08);

        ctx.save();
        var baseY = h * 0.72;
        var stickH = h * 0.16;
        var positions = [w * 0.42, w * 0.5, w * 0.58];
        for (var i = 0; i < positions.length; i++) {
            var px = positions[i];
            var flame = 10 + flare * 20 + Math.sin(_time * 8 + i) * 4;
            ctx.fillStyle = 'rgba(255,90,72,' + (0.6 + burnPulse * 0.25) + ')';
            ctx.fillRect(px - 2, baseY - stickH, 4, stickH);
            ctx.beginPath();
            ctx.ellipse(px, baseY - stickH - 10, 8, flame, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,216,76,' + (0.42 + burnPulse * 0.3) + ')';
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(px, baseY - stickH - 12, 4, flame * 0.56, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + (0.26 + burnPulse * 0.2) + ')';
            ctx.fill();
            ctx.fillStyle = 'rgba(99,239,255,' + (0.1 + burnPulse * 0.12) + ')';
            ctx.fillRect(px + Math.sin(_time * 4 + i) * 3, baseY - stickH - 24 - flame, 3, 3);
            ctx.fillRect(px - 6 + Math.cos(_time * 3 + i) * 2, baseY - stickH - 12 - flame * 0.7, 2, 2);
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = fadeIn;
        ctx.font = '16px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#24113f';
        ctx.fillStyle = '#fff2c1';
        ctx.strokeText('「' + _resultQuote + '」', w / 2, h * 0.58);
        ctx.fillText('「' + _resultQuote + '」', w / 2, h * 0.58);

        ctx.font = '20px "PoxiaoPixel"';
        ctx.fillStyle = '#ffea00';
        ctx.strokeText(god.posterBlessing || '福佑：财源滚滚', w / 2, h * 0.64);
        ctx.fillText(god.posterBlessing || '福佑：财源滚滚', w / 2, h * 0.64);

        ctx.font = '13px "PoxiaoPixel"';
        if (_posterState === 'idle') {
            ctx.fillStyle = '#63efff';
            ctx.strokeText('神火回路点亮中...', w / 2, h * 0.7);
            ctx.fillText('神火回路点亮中...', w / 2, h * 0.7);
        } else if (_posterState === 'generating') {
            ctx.fillStyle = '#63efff';
            ctx.strokeText('正在生成 Canvas 海报...', w / 2, h * 0.7);
            ctx.fillText('正在生成 Canvas 海报...', w / 2, h * 0.7);
        } else if (_posterState === 'ready') {
            ctx.fillStyle = '#ff58b3';
            ctx.strokeText('神谕已定，海报已展开', w / 2, h * 0.7);
            ctx.fillText('神谕已定，海报已展开', w / 2, h * 0.7);
        } else {
            ctx.fillStyle = '#ff8a3d';
            ctx.strokeText('显影失败，请稍后重试', w / 2, h * 0.7);
            ctx.fillText('显影失败，请稍后重试', w / 2, h * 0.7);
        }
        ctx.restore();

        _queuePosterGeneration(god);
    }

    function destroy() {
        UI.clearButtons();
        _hidePosterOverlay();
        if (_bowCallback) Device.offBow(_bowCallback);
        _removeFallbackTap();
        _cleanupDesktopFallback();
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
