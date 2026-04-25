/**
 * home.js — 主菜单场景
 */
var HomeScene = (function () {
    'use strict';

    var buttons = [];
    var clouds = [];
    var _time = 0;
    var _heroImg = null;
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

    function init() {
        UI.clearButtons();
        buttons = [];
        clouds = [];
        
        if (!_heroImg) {
            _heroImg = new Image();
            _heroImg.src = './images/李诡祖增福财神.png';
        }
        _starterClaimed = _readStarterClaimed();

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
        var btnW = Math.min(W * 0.75, 280);
        var btnH = 60;
        var gap = 15;
        var startY = H * 0.38;
        var bx = (W - btnW) / 2;

        var scenes = [
            { text: '拜财神', scene: 'worship', color: '#ff4da6', bg: 'rgba(255,77,166,0.15)', border: '#ff4da6' },
            { text: '木鱼灵宠', scene: 'woodenfish', color: '#4de1ff', bg: 'rgba(77,225,255,0.15)', border: '#4de1ff' },
            { text: '掷杯筊', scene: 'moonblocks', color: '#ffb34d', bg: 'rgba(255,179,77,0.15)', border: '#ffb34d' },
            { text: '拜年小人', scene: 'stickman', color: '#4dffb3', bg: 'rgba(77,255,179,0.15)', border: '#4dffb3' }
        ];

        for (var j = 0; j < scenes.length; j++) {
            (function (item, index) {
                var btn = UI.createButton({
                    x: bx, y: startY + index * (btnH + gap),
                    w: btnW, h: btnH,
                    text: item.text,
                    color: item.color,
                    bgColor: item.bg,
                    borderColor: item.border,
                    fontSize: 20,
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
            var imgH = 150;
            var imgW = 150;
            if (_heroImg && _heroImg.complete) {
                imgW = imgH * (_heroImg.naturalWidth / _heroImg.naturalHeight || 1);
            }
            
            var hoverY = Math.sin(_time * 2.5) * 6;
            var cx = w / 2;
            var cy = h * 0.26 + hoverY;

            // 检测是否点击在财神区域内
            if (x > cx - imgW / 2 && x < cx + imgW / 2 && y > cy - imgH / 2 && y < cy + imgH / 2) {
                _clickAnim = 1;
                Audio.init();
                Audio.playSuccess();
                Device.tapVibrate();
                Engine.addGoldBurst(cx, cy, {
                    count: 30,
                    speed: 3.4,
                    ringRadius: Math.min(imgW, imgH) * 0.42,
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
                    MeritSystem.showToast('初始功德已经领过啦，去敲木鱼继续积攒吧', 'info');
                }
            }
        };

        canvas.addEventListener('touchstart', _touchHandler, { passive: true });
        canvas.addEventListener('mousedown', _touchHandler);
    }

    function render(ctx, w, h) {
        _time += 0.016;

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
        Draw.drawPanel(ctx, w * 0.08, h * 0.08, w * 0.84, h * 0.28, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);
        Draw.drawPanel(ctx, w * 0.08, h * 0.38, w * 0.84, h * 0.50, Draw.THEME.panel, Draw.THEME.pink, Draw.THEME.cyan, Draw.THEME.ink);
        
        Draw.drawHalo(ctx, w / 2, h * 0.22, 120, Draw.THEME.pink, 0.15 + Math.sin(_time * 2) * 0.05);

        // Draw Title Pill Background
        var titleW = 280;
        var titleH = 64;
        var titleX = w / 2 - titleW / 2;
        var titleY = h * 0.08;
        
        UI.drawRoundedRect(ctx, titleX, titleY, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
        
        // Header
        UI.drawTitle(ctx, '这年我拜爆了', w / 2, titleY + titleH / 2 + 2, 32, Draw.THEME.gold);

        // 衰减点击动画
        if (_clickAnim > 0) _clickAnim *= 0.85;
        if (_clickAnim < 0.01) _clickAnim = 0;

        // 小财神预览动效（上下悬浮 + 点击缩放）
        var hoverY = Math.sin(_time * 2.5) * 6;
        var scale = 1.0 + _clickAnim * 0.15; // 点击时放大 15%
        
        ctx.save();
        if (_heroImg && _heroImg.complete) {
            var imgH = 150;
            var imgW = imgH * (_heroImg.naturalWidth / _heroImg.naturalHeight || 1);
            ctx.translate(w / 2, h * 0.26 + hoverY);
            ctx.scale(scale, scale);
            ctx.drawImage(_heroImg, -imgW / 2, -imgH / 2, imgW, imgH);
        } else {
            ctx.font = '13px "PoxiaoPixel"';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#24113f';
            ctx.strokeText('PNG载入中', w / 2, h * 0.26 + hoverY);
            ctx.fillStyle = '#fff2c1';
            ctx.fillText('PNG载入中', w / 2, h * 0.26 + hoverY);
        }
        ctx.restore();

        if (!_starterClaimed) {
            var hintAlpha = 0.4 + Math.sin(_time * 1.6) * 0.25;
            ctx.save();
            ctx.font = '13px "PoxiaoPixel"';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(36,17,63,' + hintAlpha + ')';
            ctx.strokeText('点我获得初始功德', w / 2, h * 0.34);
            ctx.fillStyle = 'rgba(255,242,193,' + hintAlpha + ')';
            ctx.fillText('点我获得初始功德', w / 2, h * 0.34);
            ctx.restore();
        }

        // 版本信息
        UI.drawSubtitle(ctx, '今年的好运，先拜为敬', w / 2, h * 0.92, 16, Draw.THEME.cyan);

        // 按钮
        UI.drawButtons(ctx);
    }

    function destroy() {
        UI.clearButtons();
        buttons = [];
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
