/**
 * ui.js — Canvas UI 组件（按钮、弹窗、过渡）
 */
var UI = (function () {
    'use strict';

    var _buttons = [];
    var _touchHandler = null;

    /** 注册触摸事件到 Canvas */
    function bindTouch(canvas) {
        if (_touchHandler) canvas.removeEventListener('touchstart', _touchHandler);
        if (_touchHandler) canvas.removeEventListener('click', _touchHandler);

        _touchHandler = function (e) {
            e.preventDefault();
            Audio.init(); // 首次交互激活音频
            var rect = canvas.getBoundingClientRect();
            var touch = e.touches ? e.touches[0] : e;
            var x = touch.clientX - rect.left;
            var y = touch.clientY - rect.top;
            for (var i = _buttons.length - 1; i >= 0; i--) {
                var b = _buttons[i];
                if (b.visible !== false && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                    if (b.onClick) b.onClick();
                    break;
                }
            }
        };
        canvas.addEventListener('touchstart', _touchHandler, { passive: false });
        canvas.addEventListener('click', _touchHandler);
    }

    /** 创建按钮 */
    function createButton(opts) {
        var btn = {
            x: opts.x || 0,
            y: opts.y || 0,
            w: opts.w || 200,
            h: opts.h || 56,
            text: opts.text || '',
            color: opts.color || '#FFD700',
            bgColor: opts.bgColor || 'rgba(255,215,0,0.15)',
            borderColor: opts.borderColor || 'rgba(255,215,0,0.4)',
            fontSize: opts.fontSize || 18,
            radius: opts.radius || 28,
            onClick: opts.onClick || null,
            visible: opts.visible !== false,
            icon: opts.icon || null
        };
        _buttons.push(btn);
        return btn;
    }

    /** 绘制所有按钮 */
    function drawButtons(ctx) {
        for (var i = 0; i < _buttons.length; i++) {
            var b = _buttons[i];
            if (b.visible === false) continue;
            _drawRoundedRect(ctx, b.x, b.y, b.w, b.h, b.radius, b.bgColor, b.borderColor);
            ctx.save();
            ctx.font = 'bold ' + b.fontSize + 'px -apple-system, "PingFang SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = b.color;
            var textX = b.x + b.w / 2;
            if (b.icon) {
                ctx.font = b.fontSize + 'px -apple-system, sans-serif';
                ctx.fillText(b.icon + ' ' + b.text, textX, b.y + b.h / 2);
            } else {
                ctx.fillText(b.text, textX, b.y + b.h / 2);
            }
            ctx.restore();
        }
    }

    function _drawRoundedRect(ctx, x, y, w, h, r, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
    }

    /** 绘制弹窗卡片 */
    function drawModal(ctx, w, h, opts) {
        opts = opts || {};
        var cardW = Math.min(w * 0.85, 360);
        var cardH = opts.height || 320;
        var cx = (w - cardW) / 2;
        var cy = (h - cardH) / 2;

        // 遮罩
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, w, h);

        // 卡片背景
        var grad = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
        grad.addColorStop(0, '#1a1a3e');
        grad.addColorStop(1, '#0d0d2b');
        _drawRoundedRect(ctx, cx, cy, cardW, cardH, 20, grad, 'rgba(255,215,0,0.3)');

        // 标题
        if (opts.title) {
            ctx.save();
            ctx.font = 'bold 22px -apple-system, "PingFang SC", sans-serif';
            ctx.fillStyle = '#FFD700';
            ctx.textAlign = 'center';
            ctx.fillText(opts.title, w / 2, cy + 50);
            ctx.restore();
        }

        // 内容
        if (opts.content) {
            ctx.save();
            ctx.font = '16px -apple-system, "PingFang SC", sans-serif';
            ctx.fillStyle = '#e0d8c8';
            ctx.textAlign = 'center';
            var lines = _wrapText(ctx, opts.content, cardW - 40);
            for (var i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], w / 2, cy + 90 + i * 28);
            }
            ctx.restore();
        }

        return { x: cx, y: cy, w: cardW, h: cardH };
    }

    function _wrapText(ctx, text, maxWidth) {
        var lines = [];
        var currentLine = '';
        for (var i = 0; i < text.length; i++) {
            var testLine = currentLine + text[i];
            if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = text[i];
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    }

    /** 绘制圆角矩形（公开） */
    function drawRoundedRect(ctx, x, y, w, h, r, fill, stroke) {
        _drawRoundedRect(ctx, x, y, w, h, r, fill, stroke);
    }

    /** 清除所有按钮 */
    function clearButtons() {
        _buttons = [];
    }

    /** 绘制标题文字（带发光） */
    function drawTitle(ctx, text, x, y, size, color) {
        ctx.save();
        ctx.font = 'bold ' + (size || 28) + 'px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = color || '#FFD700';
        ctx.shadowBlur = 20;
        ctx.fillStyle = color || '#FFD700';
        ctx.fillText(text, x, y);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    /** 绘制说明文字 */
    function drawSubtitle(ctx, text, x, y, size, color) {
        ctx.save();
        ctx.font = (size || 15) + 'px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color || 'rgba(255,255,255,0.6)';
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    /** 绘制进度条 */
    function drawProgressBar(ctx, x, y, w, h, progress, color) {
        _drawRoundedRect(ctx, x, y, w, h, h / 2, 'rgba(255,255,255,0.1)', null);
        if (progress > 0) {
            var fillW = Math.max(h, w * Math.min(1, progress));
            _drawRoundedRect(ctx, x, y, fillW, h, h / 2, color || '#FFD700', null);
        }
    }

    return {
        bindTouch: bindTouch,
        createButton: createButton,
        drawButtons: drawButtons,
        drawModal: drawModal,
        drawRoundedRect: drawRoundedRect,
        clearButtons: clearButtons,
        drawTitle: drawTitle,
        drawSubtitle: drawSubtitle,
        drawProgressBar: drawProgressBar
    };
})();
