/**
 * home.js — 主菜单场景
 */
var HomeScene = (function () {
    'use strict';

    var buttons = [];
    var clouds = [];
    var _layout = null;
    var _time = 0;
    var _heroImg = null;
    var _coins = [];
    var _coinEls = [];
    var _clickAnim = 0;
    var _touchHandler = null;
    var _starterClaimed = false;
    var _starterStorageKey = 'cyberluck_initial_merit_claimed';

    function _readStarterClaimed() {
        try {
            return localStorage.getItem(_starterStorageKey) === '1';
        } catch (e) {
            return false;
        }
    }

    function _writeStarterClaimed() {
        try {
            localStorage.setItem(_starterStorageKey, '1');
        } catch (e) {}
    }

    function _isPhoneLayout(w, h) {
        return w <= 520 && h > w;
    }

    function _buildLayout(w, h) {
        var isPhone = _isPhoneLayout(w, h);
        var topPanelY = h * (isPhone ? 0.07 : 0.08);
        var topPanelH = h * (isPhone ? 0.33 : 0.28);
        var buttonPanelY = h * (isPhone ? 0.395 : 0.38);
        var buttonPanelH = h * (isPhone ? 0.42 : 0.5);
        var buttonW = isPhone ? Math.min(w * 0.54, 236) : Math.min(w * 0.75, 280);
        var buttonH = isPhone ? 52 : 60;
        var buttonGap = isPhone ? 12 : 15;
        var titleW = isPhone ? Math.min(w * 0.58, 236) : 280;
        var titleH = isPhone ? 56 : 64;

        return {
            isPhone: isPhone,
            topPanelX: w * 0.08,
            topPanelY: topPanelY,
            topPanelW: w * 0.84,
            topPanelH: topPanelH,
            buttonPanelX: w * 0.08,
            buttonPanelY: buttonPanelY,
            buttonPanelW: w * 0.84,
            buttonPanelH: buttonPanelH,
            titleW: titleW,
            titleH: titleH,
            titleX: w / 2 - titleW / 2,
            titleY: topPanelY + (isPhone ? 12 : 0),
            titleFontSize: isPhone ? 26 : 32,
            heroCenterX: w / 2,
            heroCenterY: topPanelY + topPanelH * (isPhone ? 0.63 : 0.64),
            heroHeight: isPhone ? Math.min(146, h * 0.19) : 150,
            hintY: buttonPanelY + (isPhone ? 18 : 20),
            buttonW: buttonW,
            buttonH: buttonH,
            buttonGap: buttonGap,
            buttonX: (w - buttonW) / 2,
            buttonStartY: isPhone ? buttonPanelY + 28 : h * 0.38,
            buttonFontSize: isPhone ? 18 : 20,
            footerY: isPhone ? Math.min(h * 0.89, buttonPanelY + buttonPanelH + 34) : h * 0.92,
            footerFontSize: isPhone ? 14 : 16
        };
    }

    function _syncLayout(w, h) {
        _layout = _buildLayout(w, h);
        for (var i = 0; i < buttons.length; i++) {
            if (!buttons[i]) continue;
            buttons[i].x = _layout.buttonX;
            buttons[i].y = _layout.buttonStartY + i * (_layout.buttonH + _layout.buttonGap);
            buttons[i].w = _layout.buttonW;
            buttons[i].h = _layout.buttonH;
            buttons[i].fontSize = _layout.buttonFontSize;
        }
        return _layout;
    }

    function _getHeroMetrics(layout) {
        var imgH = layout.heroHeight;
        var imgW = imgH;
        if (_heroImg && _heroImg.complete) {
            imgW = imgH * (_heroImg.naturalWidth / _heroImg.naturalHeight || 1);
        }
        return {
            cx: layout.heroCenterX,
            cy: layout.heroCenterY,
            w: imgW,
            h: imgH
        };
    }

    function _drawTapBadge(ctx, x, y, t) {
        var bob = Math.sin(t * 1.2) * 0.8;
        ctx.save();
        ctx.translate(x, y + bob);
        ctx.font = '13px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = Draw.THEME.ink;
        ctx.strokeText('点我~', 0, 0);
        ctx.fillStyle = '#ffe26a';
        ctx.fillText('点我~', 0, 0);
        ctx.restore();
    }

    function _resetCoins() {
        var slots = [
            { dx: -0.56, dy: 0.21, jx: 0.03, jy: 0.03 },
            { dx: 0.56, dy: 0.14, jx: 0.03, jy: 0.03 }
        ];
        _coins = [];
        for (var k = 0; k < slots.length; k++) {
            var slot = slots[k];
            _coins.push({
                dx: slot.dx + (Math.random() - 0.5) * slot.jx,
                dy: slot.dy + (Math.random() - 0.5) * slot.jy,
                scale: 0.72 + Math.random() * 0.06,
                phase: Math.random() * Math.PI * 2,
                hiddenUntil: 0,
                pendingRespawn: false
            });
        }
    }

    function _getCoinMetrics(layout, hero, hoverY) {
        var baseSize = layout.isPhone ? 17 : 20;
        var list = [];
        for (var i = 0; i < _coins.length; i++) {
            var coin = _coins[i];
            if (coin.hiddenUntil > _time) {
                continue;
            }
            if (coin.pendingRespawn) {
                _respawnCoin(coin);
                coin.pendingRespawn = false;
            }
            list.push({
                coin: coin,
                size: baseSize * coin.scale,
                x: hero.cx + hero.h * coin.dx,
                y: hero.cy + hero.h * coin.dy,
                alpha: 0.12 + (Math.sin(_time * 0.7 + coin.phase) + 1) * 0.34
            });
        }
        return list;
    }

    function _respawnCoin(coin) {
        var respawnSlots = [
            { dx: -0.56, dy: 0.21, jx: 0.03, jy: 0.03 },
            { dx: 0.56, dy: 0.14, jx: 0.03, jy: 0.03 }
        ];
        var slot = respawnSlots[Math.floor(Math.random() * respawnSlots.length)];
        coin.dx = slot.dx + (Math.random() - 0.5) * slot.jx;
        coin.dy = slot.dy + (Math.random() - 0.5) * slot.jy;
        coin.scale = 0.72 + Math.random() * 0.06;
        coin.phase = Math.random() * Math.PI * 2;
        coin.hiddenUntil = 0;
    }

    function _ensureCoinElements() {
        if (_coinEls.length) return;
        for (var i = 0; i < 2; i++) {
            var el = document.createElement('img');
            el.src = './images/home/golden_coin.gif';
            el.alt = '金币';
            el.style.position = 'fixed';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '6';
            el.style.transform = 'translate(-50%, -50%)';
            el.style.imageRendering = 'pixelated';
            el.style.display = 'none';
            document.body.appendChild(el);
            _coinEls.push(el);
        }
    }

    function _syncCoinElements(metrics, canvasW, canvasH) {
        _ensureCoinElements();
        var rect = Engine.getCanvas().getBoundingClientRect();
        var scaleX = rect.width / canvasW;
        var scaleY = rect.height / canvasH;
        for (var i = 0; i < _coinEls.length; i++) {
            var el = _coinEls[i];
            var item = metrics[i];
            if (!item) {
                el.style.display = 'none';
                continue;
            }
            el.style.display = 'block';
            el.style.left = (rect.left + item.x * scaleX) + 'px';
            el.style.top = (rect.top + item.y * scaleY) + 'px';
            el.style.width = (item.size * scaleX) + 'px';
            el.style.height = (item.size * scaleY) + 'px';
            el.style.opacity = String(item.alpha);
        }
    }

    function _destroyCoinElements() {
        for (var i = 0; i < _coinEls.length; i++) {
            if (_coinEls[i] && _coinEls[i].parentNode) {
                _coinEls[i].parentNode.removeChild(_coinEls[i]);
            }
        }
        _coinEls = [];
    }

    function init() {
        UI.clearButtons();
        buttons = [];
        clouds = [];
        
        if (!_heroImg) {
            _heroImg = new Image();
            _heroImg.src = './images/李诡祖增福财神.png';
        }
        _starterClaimed = _readStarterClaimed();
        _resetCoins();
        _ensureCoinElements();

        // 生成装饰祥云
        for (var i = 0; i < 6; i++) {
            clouds.push({
                x: Math.random() * Engine.width(),
                y: 60 + Math.random() * (Engine.height() * 0.3),
                s: 0.5 + Math.random() * 0.8,
                speed: 0.2 + Math.random() * 0.3,
                alpha: 0.06 + Math.random() * 0.1
            });
        }

        var W = Engine.width();
        var H = Engine.height();
        var layout = _syncLayout(W, H);

        var scenes = [
            { text: '开运拜一拜', scene: 'worship', color: '#ff4da6', bg: 'rgba(255,77,166,0.15)', border: '#ff4da6' },
            { text: '敲出好运来', scene: 'woodenfish', color: '#4de1ff', bg: 'rgba(77,225,255,0.15)', border: '#4de1ff' },
            { text: '今日神意签', scene: 'moonblocks', color: '#ffb34d', bg: 'rgba(255,179,77,0.15)', border: '#ffb34d' },
            { text: '拜年姿势王', scene: 'stickman', color: '#4dffb3', bg: 'rgba(77,255,179,0.15)', border: '#4dffb3' }
        ];

        for (var j = 0; j < scenes.length; j++) {
            (function (item, index) {
                var btn = UI.createButton({
                    x: layout.buttonX, y: layout.buttonStartY + index * (layout.buttonH + layout.buttonGap),
                    w: layout.buttonW, h: layout.buttonH,
                    text: item.text,
                    color: item.color,
                    bgColor: item.bg,
                    borderColor: item.border,
                    fontSize: layout.buttonFontSize,
                    radius: 16,
                    onClick: function () {
                        Audio.playTap();
                        App.switchScene(item.scene);
                    }
                });
                buttons.push(btn);
            })(scenes[j], j);
        }

        Engine.startLoop(render);
        _bindTouch();
    }

    function _bindTouch() {
        var canvas = Engine.getCanvas();
        if (_touchHandler) {
            canvas.removeEventListener('touchstart', _touchHandler);
            canvas.removeEventListener('mousedown', _touchHandler);
        }

        _touchHandler = function (e) {
            var rect = canvas.getBoundingClientRect();
            var touch = e.touches ? e.touches[0] : e;
            var x = touch.clientX - rect.left;
            var y = touch.clientY - rect.top;
            
            var w = Engine.width();
            var h = Engine.height();
            var layout = _syncLayout(w, h);
            var hero = _getHeroMetrics(layout);
            
            var hoverY = Math.sin(_time * 1.35) * 4;
            var cx = hero.cx;
            var cy = hero.cy + hoverY;
            var coinMetrics = _getCoinMetrics(layout, hero, hoverY);
            for (var i = 0; i < coinMetrics.length; i++) {
                var coin = coinMetrics[i];
                var hitRadius = coin.size * 0.42;
                var dx = x - coin.x;
                var dy = y - coin.y;
                if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                    Audio.init();
                    Audio.playSuccess();
                    Device.tapVibrate();
                    MeritSystem.addPoints(9);
                    MeritSystem.showToast('金币功德 +9', 'success');
                    Engine.addFloatingText(coin.x, coin.y - coin.size * 0.55, '+9', '#FFD700', 22);
                    Engine.addGoldBurst(coin.x, coin.y, {
                        count: 12,
                        speed: 2.4,
                        ringRadius: coin.size * 0.5,
                        upwardLift: 0.24,
                        flash: true,
                        flashCoreRadius: 8,
                        flashHaloRadius: 16,
                        flashGrow: 1.4,
                        flashDecay: 0.08,
                        pixel: true
                    });
                    coin.coin.hiddenUntil = _time + 1.6;
                    coin.coin.pendingRespawn = true;
                    return;
                }
            }

            // 检测是否点击在财神区域内
            if (x > cx - hero.w / 2 && x < cx + hero.w / 2 && y > cy - hero.h / 2 && y < cy + hero.h / 2) {
                _clickAnim = 1;
                Audio.init();
                Audio.playSuccess();
                Device.tapVibrate();
                Engine.addGoldBurst(cx, cy, {
                    count: 30,
                    speed: 3.4,
                    ringRadius: Math.min(hero.w, hero.h) * 0.42,
                    upwardLift: 0.45,
                    flash: true,
                    flashCoreRadius: 12,
                    flashHaloRadius: 24,
                    flashGrow: 2.2,
                    flashDecay: 0.07,
                    pixel: true
                });
                if (!_starterClaimed) {
                    var rewards = [22, 33, 66];
                    var reward = rewards[Math.floor(Math.random() * rewards.length)];
                    _starterClaimed = true;
                    _writeStarterClaimed();
                    MeritSystem.addPoints(reward);
                    MeritSystem.showToast('初始功德到账 +' + reward, 'success');
                    Engine.addFloatingText(x + (Math.random() - 0.5) * 40, y - 20, '+' + reward, '#FFD700', 24);
                } else {
                    MeritSystem.showToast('初始功德已经领过啦，去“敲出好运来”继续积攒吧', 'info');
                }
            }
        };

        canvas.addEventListener('touchstart', _touchHandler, { passive: true });
        canvas.addEventListener('mousedown', _touchHandler);
    }

    function render(ctx, w, h) {
        _time += 0.016;
        var layout = _syncLayout(w, h);
        var hero = _getHeroMetrics(layout);

        // 背景
        Draw.drawBackground(ctx, w, h);
        Draw.drawFrame(ctx, w, h);

        // 祥云动画
        for (var i = 0; i < clouds.length; i++) {
            var c = clouds[i];
            c.x += c.speed;
            if (c.x > w + 60) c.x = -60;
            Draw.drawCloud(ctx, c.x, c.y, c.s, c.alpha);
        }

        // Main panels
        Draw.drawPanel(ctx, layout.topPanelX, layout.topPanelY, layout.topPanelW, layout.topPanelH, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);
        Draw.drawPanel(ctx, layout.buttonPanelX, layout.buttonPanelY, layout.buttonPanelW, layout.buttonPanelH, Draw.THEME.panel, Draw.THEME.pink, Draw.THEME.cyan, Draw.THEME.ink);
        
        Draw.drawHalo(ctx, w / 2, h * 0.22, 120, Draw.THEME.pink, 0.15 + Math.sin(_time * 2) * 0.05);

        // Draw Title Pill Background
        var titleW = layout.titleW;
        var titleH = layout.titleH;
        var titleX = layout.titleX;
        var titleY = layout.titleY;
        
        UI.drawRoundedRect(ctx, titleX, titleY, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        
        // Header
        UI.drawTitle(ctx, '这年我拜爆了', w / 2, titleY + titleH / 2 + 2, layout.titleFontSize, Draw.THEME.gold);

        // 衰减点击动画
        if (_clickAnim > 0) _clickAnim *= 0.85;
        if (_clickAnim < 0.01) _clickAnim = 0;

        // 小财神预览动效（上下悬浮 + 点击缩放）
        var hoverY = Math.sin(_time * 1.35) * 4;
        var scale = 1.0 + _clickAnim * 0.15; // 点击时放大 15%
        var coinMetrics = _getCoinMetrics(layout, hero, hoverY);
        _syncCoinElements(coinMetrics, w, h);
        
        ctx.save();
        if (_heroImg && _heroImg.complete) {
            ctx.translate(hero.cx, hero.cy + hoverY);
            ctx.scale(scale, scale);
            ctx.drawImage(_heroImg, -hero.w / 2, -hero.h / 2, hero.w, hero.h);
        } else {
            ctx.font = '13px "PoxiaoPixel"';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#24113f';
            ctx.strokeText('PNG载入中', hero.cx, hero.cy + hoverY);
            ctx.fillStyle = '#fff2c1';
            ctx.fillText('PNG载入中', hero.cx, hero.cy + hoverY);
        }
        ctx.restore();

        _drawTapBadge(ctx, hero.cx - hero.w * 0.62, hero.cy - hero.h * 0.28, _time);

        if (!_starterClaimed) {
            var hintAlpha = 0.62 + Math.sin(_time * 1.6) * 0.18;
            ctx.save();
            ctx.font = '13px "PoxiaoPixel"';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(36,17,63,' + hintAlpha + ')';
            ctx.strokeText('点财神领初始功德，点金币额外 +9', w / 2, layout.hintY);
            ctx.fillStyle = 'rgba(255,236,133,' + hintAlpha + ')';
            ctx.fillText('点财神领初始功德，点金币额外 +9', w / 2, layout.hintY);
            ctx.restore();
        } else {
            var coinHintAlpha = 0.56 + Math.sin(_time * 1.6) * 0.16;
            ctx.save();
            ctx.font = '13px "PoxiaoPixel"';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(36,17,63,' + coinHintAlpha + ')';
            ctx.strokeText('金币可精准点击，每次 +9 功德', w / 2, layout.hintY);
            ctx.fillStyle = 'rgba(255,236,133,' + coinHintAlpha + ')';
            ctx.fillText('金币可精准点击，每次 +9 功德', w / 2, layout.hintY);
            ctx.restore();
        }

        // 版本信息
        UI.drawSubtitle(ctx, '今年的好运，先拜为敬', w / 2, layout.footerY, layout.footerFontSize, Draw.THEME.cyan);

        // 按钮
        UI.drawButtons(ctx);
    }

    function destroy() {
        UI.clearButtons();
        buttons = [];
        _destroyCoinElements();
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
