/**
 * draw.js — 所有角色/物件的 Canvas 矢量绘制
 */
var Draw = (function () {
    'use strict';

    var THEME = {
        bg: '#211646',
        bg2: '#352269',
        grid: '#2e1d5e',
        ink: '#150a26',
        paper: '#ffffff',
        cyan: '#00f0ff',
        pink: '#ff007f',
        hotPink: '#ff2a7a',
        gold: '#ffea00',
        orange: '#ff8a00',
        red: '#ff2a2a',
        violet: '#8a2be2',
        panel: '#2c1c5e',
        panelDark: '#1a113a'
    };

    function _pixel(n) {
        return Math.round(n);
    }

    function _panel(ctx, x, y, w, h, fill, border, highlight, shadow) {
        x = _pixel(x);
        y = _pixel(y);
        w = _pixel(w);
        h = _pixel(h);
        var b = 4;

        // Main Border Outline
        ctx.fillStyle = border || THEME.ink;
        ctx.fillRect(x + b * 2, y, w - b * 4, h);
        ctx.fillRect(x, y + b * 2, w, h - b * 4);
        
        ctx.fillRect(x + b, y + b, b, b);
        ctx.fillRect(x + w - b * 2, y + b, b, b);
        ctx.fillRect(x + b, y + h - b * 2, b, b);
        ctx.fillRect(x + w - b * 2, y + h - b * 2, b, b);

        // Fill
        ctx.fillStyle = fill || THEME.panel;
        ctx.fillRect(x + b, y + b * 2, w - b * 2, h - b * 4);
        ctx.fillRect(x + b * 2, y + b, w - b * 4, h - b * 2);

        // Highlight
        if (highlight) {
            ctx.fillStyle = highlight;
            ctx.fillRect(x + b * 2, y + b, w - b * 4, b);
            ctx.fillRect(x + b, y + b * 2, b, h - b * 4);
            ctx.fillRect(x + b, y + b, b, b);
        }

        // Shadow
        if (shadow) {
            ctx.fillStyle = shadow;
            ctx.fillRect(x + b * 2, y + h - b * 2, w - b * 4, b);
            ctx.fillRect(x + w - b * 2, y + b * 2, b, h - b * 4);
            ctx.fillRect(x + w - b * 2, y + h - b * 2, b, b);
        }
        
        // Inner Corner Decorations (Cyber style)
        if (w > 60 && h > 60) {
            ctx.fillStyle = THEME.cyan;
            ctx.fillRect(x + b * 2, y + b * 2, b, b);
            ctx.fillRect(x + w - b * 3, y + b * 2, b, b);
            ctx.fillRect(x + b * 2, y + h - b * 3, b, b);
            ctx.fillRect(x + w - b * 3, y + h - b * 3, b, b);
        }
    }

    function drawPanel(ctx, x, y, w, h, fill, border, highlight, shadow) {
        _panel(ctx, x, y, w, h, fill, border, highlight, shadow);
    }

    function drawFrame(ctx, w, h) {
        var pad = 8;
        var b = 4;
        
        // Outer cyan thin border
        ctx.fillStyle = THEME.cyan;
        ctx.fillRect(pad + b, pad, w - pad * 2 - b * 2, b); // Top
        ctx.fillRect(pad + b, h - pad - b, w - pad * 2 - b * 2, b); // Bottom
        ctx.fillRect(pad, pad + b, b, h - pad * 2 - b * 2); // Left
        ctx.fillRect(w - pad - b, pad + b, b, h - pad * 2 - b * 2); // Right
        
        // Dark corners for outer border to make it pixelated
        ctx.fillStyle = THEME.bg;
        ctx.fillRect(pad, pad, b, b);
        ctx.fillRect(w - pad - b, pad, b, b);
        ctx.fillRect(pad, h - pad - b, b, b);
        ctx.fillRect(w - pad - b, h - pad - b, b, b);

        // Corner decorative accents (pink)
        ctx.fillStyle = THEME.pink;
        ctx.fillRect(pad - b, pad + b*4, b*2, b*4); // L Top
        ctx.fillRect(pad - b, h - pad - b*8, b*2, b*4); // L Bottom
        ctx.fillRect(w - pad - b, pad + b*4, b*2, b*4); // R Top
        ctx.fillRect(w - pad - b, h - pad - b*8, b*2, b*4); // R Bottom

        ctx.fillRect(pad + b*4, pad - b, b*4, b*2); // T Left
        ctx.fillRect(w - pad - b*8, pad - b, b*4, b*2); // T Right
        ctx.fillRect(pad + b*4, h - pad - b, b*4, b*2); // B Left
        ctx.fillRect(w - pad - b*8, h - pad - b, b*4, b*2); // B Right
    }

    function _strokeEllipse(ctx, x, y, rx, ry, fill, stroke, lineWidth) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth || 3;
        ctx.stroke();
    }

    /* ====== 财神绘制 ====== */

    /** 通用财神身体 */
    function _drawGodBase(ctx, cx, cy, scale, robeColor, faceColor) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);

        _strokeEllipse(ctx, 0, 40, 55, 70, robeColor, THEME.ink, 3);
        ctx.beginPath();
        ctx.rect(-14, -2, 28, 58);
        ctx.fillStyle = '#ffd84c';
        ctx.fill();
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#ff5a48';
        ctx.fillRect(-10, 8, 20, 6);
        ctx.fillRect(-10, 22, 20, 6);
        ctx.fillRect(-10, 36, 20, 6);

        _strokeEllipse(ctx, 0, -40, 32, 32, faceColor || '#ffe4c4', THEME.ink, 3);

        // 眼睛
        ctx.fillStyle = THEME.ink;
        ctx.fillRect(-13, -45, 6, 6);
        ctx.fillRect(7, -45, 6, 6);

        // 微笑
        ctx.beginPath();
        ctx.arc(0, -35, 8, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.strokeStyle = '#a54e32';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffb08b';
        ctx.fillRect(-16, -28, 8, 4);
        ctx.fillRect(8, -28, 8, 4);

        ctx.restore();
    }

    /** 关二爷 */
    function drawGuanYu(ctx, cx, cy, scale) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);

        // 帽子 (绿色战帽)
        ctx.beginPath();
        ctx.moveTo(-35, -75);
        ctx.lineTo(35, -75);
        ctx.lineTo(28, -95);
        ctx.lineTo(0, -105);
        ctx.lineTo(-28, -95);
        ctx.closePath();
        ctx.fillStyle = '#32d06c';
        ctx.fill();
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 3;
        ctx.stroke();

        // 帽顶装饰
        ctx.beginPath();
        ctx.arc(0, -95, 6, 0, Math.PI * 2);
        ctx.fillStyle = THEME.gold;
        ctx.fill();

        ctx.restore();
        _drawGodBase(ctx, cx, cy, scale, '#2ac76a', '#ffe4c4');

        // 美髯
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(-5, -30);
        ctx.quadraticCurveTo(-15, 20, -10, 55);
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(5, -30);
        ctx.quadraticCurveTo(15, 20, 10, 55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.quadraticCurveTo(0, 20, 0, 60);
        ctx.stroke();

        // 大刀
        ctx.beginPath();
        ctx.moveTo(60, -60);
        ctx.lineTo(60, 80);
        ctx.strokeStyle = '#6f5a33';
        ctx.lineWidth = 4;
        ctx.stroke();
        // 刀头
        ctx.beginPath();
        ctx.moveTo(55, -60);
        ctx.quadraticCurveTo(75, -80, 65, -60);
        ctx.lineTo(60, -55);
        ctx.fillStyle = '#eaf6ff';
        ctx.fill();

        ctx.restore();
    }

    /** 赵公明 */
    function drawZhaoGongMing(ctx, cx, cy, scale) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);

        // 冠冕
        ctx.beginPath();
        ctx.rect(-30, -100, 60, 25);
        ctx.fillStyle = '#ffb236';
        ctx.fill();
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 3;
        ctx.stroke();

        // 冠顶珠
        ctx.beginPath();
        ctx.arc(0, -100, 8, 0, Math.PI * 2);
        ctx.fillStyle = THEME.red;
        ctx.fill();
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
        _drawGodBase(ctx, cx, cy, scale, '#ff5a48', '#ffe4c4');

        // 元宝
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        _drawIngot(ctx, 0, 25, 0.8);

        // 胡须
        ctx.beginPath();
        ctx.moveTo(-8, -30);
        ctx.quadraticCurveTo(-20, 0, -15, 20);
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, -30);
        ctx.quadraticCurveTo(20, 0, 15, 20);
        ctx.stroke();
        ctx.restore();
    }

    /** 文财神 */
    function drawWenCaiShen(ctx, cx, cy, scale) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);

        // 文官帽
        ctx.beginPath();
        ctx.ellipse(0, -85, 40, 12, 0, Math.PI, 0);
        ctx.fillStyle = THEME.violet;
        ctx.fill();
        ctx.beginPath();
        ctx.rect(-25, -95, 50, 15);
        ctx.fillStyle = THEME.violet;
        ctx.fill();
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 3;
        ctx.stroke();
        // 帽翅
        ctx.beginPath();
        ctx.moveTo(-25, -85);
        ctx.quadraticCurveTo(-55, -90, -50, -80);
        ctx.strokeStyle = THEME.violet;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(25, -85);
        ctx.quadraticCurveTo(55, -90, 50, -80);
        ctx.stroke();

        ctx.restore();
        _drawGodBase(ctx, cx, cy, scale, THEME.violet, '#ffe4c4');

        // 如意
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(-40, 10);
        ctx.quadraticCurveTo(-55, -10, -45, -20);
        ctx.quadraticCurveTo(-35, -30, -30, -15);
        ctx.strokeStyle = THEME.gold;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }

    /** 比干 */
    function drawBiGan(ctx, cx, cy, scale) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);

        // 朝臣冠
        ctx.beginPath();
        ctx.moveTo(-20, -95);
        ctx.lineTo(20, -95);
        ctx.lineTo(15, -110);
        ctx.lineTo(0, -115);
        ctx.lineTo(-15, -110);
        ctx.closePath();
        ctx.fillStyle = '#8d63ff';
        ctx.fill();
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
        _drawGodBase(ctx, cx, cy, scale, '#8d63ff', '#ffe4c4');

        // 玉板
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.rect(-8, -15, 16, 50);
        ctx.fillStyle = THEME.paper;
        ctx.fill();
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    /** 元宝 */
    function _drawIngot(ctx, x, y, s) {
        s = s || 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(-20, 5);
        ctx.quadraticCurveTo(-25, -10, -10, -10);
        ctx.quadraticCurveTo(0, -18, 10, -10);
        ctx.quadraticCurveTo(25, -10, 20, 5);
        ctx.closePath();
        ctx.fillStyle = THEME.gold;
        ctx.fill();
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = THEME.paper;
        ctx.fillRect(-8, -8, 16, 3);
        ctx.restore();
    }

    /* ====== 木鱼绘制 ====== */

    function drawWoodenFish(ctx, cx, cy, scale, hitAnim) {
        var s = scale || 1;
        var squash = hitAnim ? 0.95 : 1;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s * 1, s * squash);

        // 鱼身
        ctx.beginPath();
        ctx.ellipse(0, 0, 70, 55, 0, 0, Math.PI * 2);
        ctx.fillStyle = THEME.orange;
        ctx.fill();
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 4;
        ctx.stroke();

        // 阴影块
        ctx.beginPath();
        ctx.ellipse(0, 15, 60, 30, 0, 0, Math.PI * 2);
        ctx.fillStyle = THEME.red;
        ctx.fill();

        // 鱼嘴缝
        ctx.beginPath();
        ctx.moveTo(-25, 15);
        ctx.quadraticCurveTo(0, 25, 25, 15);
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 4;
        ctx.stroke();

        // 鱼眼 (左)
        ctx.beginPath();
        ctx.arc(-18, -10, 8, 0, Math.PI * 2);
        ctx.fillStyle = THEME.paper;
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-18, -10, 3, 0, Math.PI * 2);
        ctx.fillStyle = THEME.ink;
        ctx.fill();

        // 鱼眼 (右)
        ctx.beginPath();
        ctx.arc(18, -10, 8, 0, Math.PI * 2);
        ctx.fillStyle = THEME.paper;
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(18, -10, 3, 0, Math.PI * 2);
        ctx.fillStyle = THEME.ink;
        ctx.fill();

        // 顶部把手
        ctx.beginPath();
        ctx.moveTo(-12, -55);
        ctx.lineTo(-12, -65);
        ctx.lineTo(12, -65);
        ctx.lineTo(12, -55);
        ctx.fillStyle = THEME.gold;
        ctx.fill();
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.restore();
    }

    /** 木棰 */
    function drawMallet(ctx, cx, cy, scale, angle) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.rotate(angle || 0);

        // 棰柄
        ctx.fillStyle = '#ff8a3d';
        ctx.fillRect(-4, -60, 8, 45);
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 3;
        ctx.strokeRect(-4, -60, 8, 45);

        // 棰头
        ctx.beginPath();
        ctx.ellipse(0, -65, 14, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5482';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    }

    /* ====== 杯筊绘制 ====== */

    function drawMoonBlock(ctx, cx, cy, scale, isFaceUp, rotation) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.rotate(rotation || 0);

        if (isFaceUp) {
            // 正面（平面朝上）— 红色
            ctx.beginPath();
            ctx.ellipse(0, 0, 28, 12, 0, 0, Math.PI * 2);
            ctx.fillStyle = THEME.red;
            ctx.fill();
            ctx.strokeStyle = THEME.ink;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = THEME.gold;
            ctx.fillRect(-12, -2, 24, 4);
        } else {
            // 反面（弧面朝上）— 木色弧形
            ctx.beginPath();
            ctx.ellipse(0, 5, 28, 12, 0, Math.PI, 0);
            ctx.quadraticCurveTo(0, -20, -28, 5);
            ctx.fillStyle = '#ffe3a6';
            ctx.fill();
            ctx.strokeStyle = THEME.ink;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = '#ff8a3d';
            ctx.fillRect(-10, -2, 20, 3);
        }

        ctx.restore();
    }

    /* ====== 装饰元素 ====== */

    /** 背景渐变 */
    function drawBackground(ctx, w, h, color1, color2) {
        var base = color1 || THEME.bg;
        var secondary = color2 || THEME.bg2;
        var cell = 32;
        var i;
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = secondary;
        for (i = 0; i < h; i += cell * 4) {
            ctx.fillRect(0, i, w, 2);
        }
        for (i = 0; i < w; i += cell * 4) {
            ctx.fillRect(i, 0, 2, h);
        }

        ctx.fillStyle = THEME.grid;
        for (i = 0; i < h; i += cell) {
            ctx.fillRect(0, i, w, 1);
        }
        for (i = 0; i < w; i += cell) {
            ctx.fillRect(i, 0, 1, h);
        }

        // Add some pixel dot pattern
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        for (var y = 0; y < h; y += cell) {
            for (var x = 0; x < w; x += cell) {
                ctx.fillRect(x + cell / 2 - 2, y + cell / 2 - 2, 4, 4);
            }
        }
    }

    /** 祥云 */
    function drawCloud(ctx, x, y, s, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha || 0.15;
        ctx.translate(x, y);
        ctx.scale(s || 1, s || 1);
        ctx.fillStyle = THEME.cyan;
        ctx.fillRect(-18, -4, 20, 8);
        ctx.fillRect(2, -4, 24, 8);
        ctx.fillRect(-2, -16, 8, 32);
        ctx.fillStyle = THEME.pink;
        ctx.fillRect(-34, -12, 12, 8);
        ctx.fillRect(26, 4, 12, 8);
        ctx.fillRect(-10, -24, 8, 8);
        ctx.fillStyle = THEME.gold;
        ctx.fillRect(-26, 8, 8, 8);
        ctx.fillRect(18, -16, 8, 8);
        ctx.restore();
    }

    /** 绘制光环 */
    function drawHalo(ctx, cx, cy, radius, color, alpha) {
        var ringColor = color || THEME.gold;
        var a = alpha || 0.3;
        var r = Math.round(radius);
        
        ctx.fillStyle = _colorAlpha(ringColor, a);
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillRect(cx - r - 8, cy - r + 16, 8, r * 2 - 32);
        ctx.fillRect(cx + r, cy - r + 16, 8, r * 2 - 32);
        ctx.fillRect(cx - r + 16, cy - r - 8, r * 2 - 32, 8);
        ctx.fillRect(cx - r + 16, cy + r, r * 2 - 32, 8);
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

    return {
        THEME: THEME,
        drawGuanYu: drawGuanYu,
        drawZhaoGongMing: drawZhaoGongMing,
        drawWenCaiShen: drawWenCaiShen,
        drawBiGan: drawBiGan,
        drawWoodenFish: drawWoodenFish,
        drawMallet: drawMallet,
        drawMoonBlock: drawMoonBlock,
        drawBackground: drawBackground,
        drawCloud: drawCloud,
        drawHalo: drawHalo,
        drawPanel: drawPanel,
        drawFrame: drawFrame
    };
})();
