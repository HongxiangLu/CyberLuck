/**
 * home.js — 主菜单场景
 */
var HomeScene = (function () {
    'use strict';

    var buttons = [];
    var clouds = [];
    var _time = 0;

    function init() {
        UI.clearButtons();
        buttons = [];
        clouds = [];

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
            { text: '🙏 拜财神', icon: null, scene: 'worship', color: '#FFD700', bg: 'rgba(255,215,0,0.1)', border: 'rgba(255,215,0,0.35)' },
            { text: '🐟 木鱼灵宠', icon: null, scene: 'woodenfish', color: '#DEB887', bg: 'rgba(222,184,135,0.1)', border: 'rgba(222,184,135,0.35)' },
            { text: '🌙 掷杯筊', icon: null, scene: 'moonblocks', color: '#CD853F', bg: 'rgba(205,133,63,0.1)', border: 'rgba(205,133,63,0.35)' },
            { text: '🏃‍♂️ 拜年小人', icon: null, scene: 'stickman', color: '#FA8072', bg: 'rgba(250,128,114,0.1)', border: 'rgba(250,128,114,0.35)' }
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
    }

    function render(ctx, w, h) {
        _time += 0.016;

        // 背景
        Draw.drawBackground(ctx, w, h, '#0a0a2e', '#1a0a2e');

        // 祥云动画
        for (var i = 0; i < clouds.length; i++) {
            var c = clouds[i];
            c.x += c.speed;
            if (c.x > w + 60) c.x = -60;
            Draw.drawCloud(ctx, c.x, c.y, c.s, c.alpha);
        }

        // 光晕
        Draw.drawHalo(ctx, w / 2, h * 0.22, 120, '#FFD700', 0.15 + Math.sin(_time * 2) * 0.05);

        // 标题
        UI.drawTitle(ctx, '福运三宝', w / 2, h * 0.15, 36, '#FFD700');
        UI.drawSubtitle(ctx, '虔诚祈福 · 好运连连', w / 2, h * 0.22, 14, 'rgba(255,215,0,0.5)');

        // 小财神预览
        Draw.drawZhaoGongMing(ctx, w / 2, h * 0.32, 0.6);

        // 版本信息
        UI.drawSubtitle(ctx, '长按屏幕开始体验', w / 2, h * 0.92, 12, 'rgba(255,255,255,0.25)');

        // 按钮
        UI.drawButtons(ctx);
    }

    function destroy() {
        UI.clearButtons();
        buttons = [];
    }

    return {
        init: init,
        destroy: destroy
    };
})();
