/**
 * draw.js — 所有角色/物件的 Canvas 矢量绘制
 */
var Draw = (function () {
    'use strict';

    /* ====== 财神绘制 ====== */

    /** 通用财神身体 */
    function _drawGodBase(ctx, cx, cy, scale, robeColor, faceColor) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);

        // 身体/袍子
        ctx.beginPath();
        ctx.ellipse(0, 40, 55, 70, 0, 0, Math.PI * 2);
        ctx.fillStyle = robeColor;
        ctx.fill();

        // 袍子装饰
        ctx.beginPath();
        ctx.ellipse(0, 40, 55, 70, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,215,0,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 头
        ctx.beginPath();
        ctx.arc(0, -40, 32, 0, Math.PI * 2);
        ctx.fillStyle = faceColor || '#FFE4C4';
        ctx.fill();

        // 眼睛
        ctx.fillStyle = '#2a1a0a';
        ctx.beginPath();
        ctx.arc(-10, -42, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -42, 3, 0, Math.PI * 2);
        ctx.fill();

        // 微笑
        ctx.beginPath();
        ctx.arc(0, -35, 8, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.stroke();

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
        ctx.fillStyle = '#228B22';
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 帽顶装饰
        ctx.beginPath();
        ctx.arc(0, -95, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();

        ctx.restore();
        _drawGodBase(ctx, cx, cy, scale, '#228B22', '#FFE4C4');

        // 美髯
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(-5, -30);
        ctx.quadraticCurveTo(-15, 20, -10, 55);
        ctx.strokeStyle = '#1a1a1a';
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
        ctx.strokeStyle = '#8B7355';
        ctx.lineWidth = 4;
        ctx.stroke();
        // 刀头
        ctx.beginPath();
        ctx.moveTo(55, -60);
        ctx.quadraticCurveTo(75, -80, 65, -60);
        ctx.lineTo(60, -55);
        ctx.fillStyle = '#C0C0C0';
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
        ctx.fillStyle = '#B8860B';
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 冠顶珠
        ctx.beginPath();
        ctx.arc(0, -100, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#FF4500';
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
        _drawGodBase(ctx, cx, cy, scale, '#8B0000', '#FFE4C4');

        // 元宝
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        _drawIngot(ctx, 0, 25, 0.8);

        // 胡须
        ctx.beginPath();
        ctx.moveTo(-8, -30);
        ctx.quadraticCurveTo(-20, 0, -15, 20);
        ctx.strokeStyle = '#333';
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
        ctx.fillStyle = '#1a1a6e';
        ctx.fill();
        ctx.beginPath();
        ctx.rect(-25, -95, 50, 15);
        ctx.fillStyle = '#1a1a6e';
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // 帽翅
        ctx.beginPath();
        ctx.moveTo(-25, -85);
        ctx.quadraticCurveTo(-55, -90, -50, -80);
        ctx.strokeStyle = '#1a1a6e';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(25, -85);
        ctx.quadraticCurveTo(55, -90, 50, -80);
        ctx.stroke();

        ctx.restore();
        _drawGodBase(ctx, cx, cy, scale, '#1a1a6e', '#FFE4C4');

        // 如意
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(-40, 10);
        ctx.quadraticCurveTo(-55, -10, -45, -20);
        ctx.quadraticCurveTo(-35, -30, -30, -15);
        ctx.strokeStyle = '#FFD700';
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
        ctx.fillStyle = '#4B0082';
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
        _drawGodBase(ctx, cx, cy, scale, '#4B0082', '#FFE4C4');

        // 玉板
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.rect(-8, -15, 16, 50);
        ctx.fillStyle = '#F5F5DC';
        ctx.fill();
        ctx.strokeStyle = '#DAA520';
        ctx.lineWidth = 1;
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
        var grad = ctx.createLinearGradient(-20, -18, 20, 5);
        grad.addColorStop(0, '#FFD700');
        grad.addColorStop(0.5, '#FFF8DC');
        grad.addColorStop(1, '#DAA520');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 1;
        ctx.stroke();
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
        var grad = ctx.createRadialGradient(0, 0, 10, 0, 0, 70);
        grad.addColorStop(0, '#8B6914');
        grad.addColorStop(0.6, '#6B4400');
        grad.addColorStop(1, '#3B2200');
        ctx.beginPath();
        ctx.ellipse(0, 0, 70, 55, 0, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#4a3000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 木纹
        ctx.beginPath();
        ctx.ellipse(0, 5, 50, 35, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(139,105,20,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(0, 10, 30, 20, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 鱼嘴缝
        ctx.beginPath();
        ctx.moveTo(-25, 15);
        ctx.quadraticCurveTo(0, 25, 25, 15);
        ctx.strokeStyle = '#2a1800';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 鱼眼 (左)
        ctx.beginPath();
        ctx.arc(-18, -10, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#2a1800';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-18, -10, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#2a1800';
        ctx.fill();

        // 鱼眼 (右)
        ctx.beginPath();
        ctx.arc(18, -10, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(18, -10, 3, 0, Math.PI * 2);
        ctx.fill();

        // 顶部把手
        ctx.beginPath();
        ctx.moveTo(-12, -55);
        ctx.quadraticCurveTo(0, -70, 12, -55);
        ctx.strokeStyle = '#5a3a00';
        ctx.lineWidth = 5;
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
        ctx.beginPath();
        ctx.rect(-3, -60, 6, 45);
        ctx.fillStyle = '#8B7355';
        ctx.fill();

        // 棰头
        ctx.beginPath();
        ctx.ellipse(0, -65, 14, 10, 0, 0, Math.PI * 2);
        var grad = ctx.createRadialGradient(0, -65, 2, 0, -65, 14);
        grad.addColorStop(0, '#A0522D');
        grad.addColorStop(1, '#5C3317');
        ctx.fillStyle = grad;
        ctx.fill();

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
            var grad = ctx.createLinearGradient(-28, 0, 28, 0);
            grad.addColorStop(0, '#8B0000');
            grad.addColorStop(0.5, '#CD2626');
            grad.addColorStop(1, '#8B0000');
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = '#5a0000';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else {
            // 反面（弧面朝上）— 木色弧形
            ctx.beginPath();
            ctx.ellipse(0, 5, 28, 12, 0, Math.PI, 0);
            ctx.quadraticCurveTo(0, -20, -28, 5);
            var grad2 = ctx.createLinearGradient(-28, -15, 28, 5);
            grad2.addColorStop(0, '#DEB887');
            grad2.addColorStop(0.5, '#D2B48C');
            grad2.addColorStop(1, '#C4A265');
            ctx.fillStyle = grad2;
            ctx.fill();
            ctx.strokeStyle = '#8B7355';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.restore();
    }

    /* ====== 装饰元素 ====== */

    /** 背景渐变 */
    function drawBackground(ctx, w, h, color1, color2) {
        var grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color1 || '#0a0a2e');
        grad.addColorStop(1, color2 || '#1a0a1e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    /** 祥云 */
    function drawCloud(ctx, x, y, s, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha || 0.15;
        ctx.translate(x, y);
        ctx.scale(s || 1, s || 1);
        ctx.fillStyle = '#FFD700';
        
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.arc(18, -5, 15, 0, Math.PI * 2);
        ctx.arc(-18, -3, 16, 0, Math.PI * 2);
        ctx.arc(8, -15, 12, 0, Math.PI * 2);
        ctx.arc(-8, -13, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /** 绘制光环 */
    function drawHalo(ctx, cx, cy, radius, color, alpha) {
        var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, _colorAlpha(color || '#FFD700', alpha || 0.3));
        grad.addColorStop(1, _colorAlpha(color || '#FFD700', 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    function _colorAlpha(hex, a) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    return {
        drawGuanYu: drawGuanYu,
        drawZhaoGongMing: drawZhaoGongMing,
        drawWenCaiShen: drawWenCaiShen,
        drawBiGan: drawBiGan,
        drawWoodenFish: drawWoodenFish,
        drawMallet: drawMallet,
        drawMoonBlock: drawMoonBlock,
        drawBackground: drawBackground,
        drawCloud: drawCloud,
        drawHalo: drawHalo
    };
})();
