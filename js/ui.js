/**
 * ui.js — Canvas UI 组件（按钮、弹窗、过渡）
 */
var UI = (function () {
    'use strict';

    var _buttons = [];
    var _touchHandler = null;
    var THEME = {
        bg: '#211646',
        ink: '#150a26',
        paper: '#ffffff',
        pink: '#ff007f',
        hotPink: '#ff2a7a',
        cyan: '#00f0ff',
        gold: '#ffea00',
        orange: '#ff8a00',
        red: '#ff2a2a',
        violet: '#8a2be2',
        panel: '#2c1c5e',
        panelDark: '#1a113a'
    };

    function _font(size, isBold) {
        return size + 'px "PoxiaoPixel"';
    }

    function _pixel(n) {
        return Math.round(n);
    }

    function _clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function _hexToRgb(hex) {
        if (!hex || hex.charAt(0) !== '#') return null;
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16)
        };
    }

    function _rgba(hex, alpha) {
        var rgb = _hexToRgb(hex);
        if (!rgb) return hex;
        return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
    }

    function _mix(hex1, hex2, t) {
        var a = _hexToRgb(hex1) || { r: 255, g: 255, b: 255 };
        var b = _hexToRgb(hex2) || { r: 0, g: 0, b: 0 };
        var p = _clamp(t, 0, 1);
        var r = Math.round(a.r + (b.r - a.r) * p);
        var g = Math.round(a.g + (b.g - a.g) * p);
        var bl = Math.round(a.b + (b.b - a.b) * p);
        return '#' + (1 << 24 | r << 16 | g << 8 | bl).toString(16).slice(1);
    }

    function _normalizeColor(color, fallback) {
        return color && color.charAt && color.charAt(0) === '#' ? color : (fallback || THEME.gold);
    }

    function _drawPixelFrame(ctx, x, y, w, h, fill, border, highlight, shadow) {
        x = _pixel(x);
        y = _pixel(y);
        w = _pixel(w);
        h = _pixel(h);

        var b = 4; // pixel size

        // Main Border Outline
        ctx.fillStyle = border || THEME.ink;
        ctx.fillRect(x + b * 2, y, w - b * 4, h);
        ctx.fillRect(x, y + b * 2, w, h - b * 4);
        // Corner pixels for outline
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
            ctx.fillRect(x + b, y + b, b, b); // Highlight corner
        }

        // Shadow
        if (shadow) {
            ctx.fillStyle = shadow;
            ctx.fillRect(x + b * 2, y + h - b * 2, w - b * 4, b);
            ctx.fillRect(x + w - b * 2, y + b * 2, b, h - b * 4);
            ctx.fillRect(x + w - b * 2, y + h - b * 2, b, b); // Shadow corner
        }
    }

    function _drawText(ctx, text, x, y, size, fill, align) {
        ctx.save();
        ctx.font = _font(size, true);
        ctx.textAlign = align || 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'miter';
        var fillColor = fill || THEME.paper;
        var strokeColor = fillColor === THEME.ink ? THEME.paper : THEME.ink;
        ctx.lineWidth = size <= 14 ? 1.5 : (size <= 20 ? 2 : 3);
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = fillColor;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    function _resolveButtonTheme(btn) {
        var accent = _normalizeColor(btn.color, THEME.gold);
        var text = THEME.ink;
        var fill = accent;
        var border = THEME.ink;
        var highlight = _mix(accent, '#ffffff', 0.4);
        var shadow = _mix(accent, '#000000', 0.2);

        if (/返回|首页/.test(btn.text)) {
            fill = '#4de1ff'; // 柔和青色
            text = THEME.ink;
            highlight = _mix('#4de1ff', '#ffffff', 0.4);
            shadow = _mix('#4de1ff', '#000000', 0.2);
        } else if (/开始|再|保存|挑战|参拜|权限/.test(btn.text)) {
            fill = '#ffd966'; // 柔和金色
            text = THEME.ink;
            highlight = _mix('#ffd966', '#ffffff', 0.4);
            shadow = _mix('#ffd966', '#000000', 0.2);
        } else if (/拜财神/.test(btn.text)) {
            fill = '#ff4da6'; // 柔和粉色
            text = THEME.paper;
            highlight = _mix('#ff4da6', '#ffffff', 0.4);
            shadow = _mix('#ff4da6', '#000000', 0.2);
        } else if (/木鱼/.test(btn.text)) {
            fill = '#4de1ff'; // 柔和青色
            text = THEME.ink;
            highlight = _mix('#4de1ff', '#ffffff', 0.4);
            shadow = _mix('#4de1ff', '#000000', 0.2);
        } else if (/杯/.test(btn.text)) {
            fill = '#ffb34d'; // 柔和橙色
            text = THEME.ink;
            highlight = _mix('#ffb34d', '#ffffff', 0.4);
            shadow = _mix('#ffb34d', '#000000', 0.2);
        } else if (/拜年/.test(btn.text)) {
            fill = '#4dffb3'; // 柔和薄荷绿
            text = THEME.ink;
            highlight = _mix('#4dffb3', '#ffffff', 0.4);
            shadow = _mix('#4dffb3', '#000000', 0.2);
        } else if (/签|财神/.test(btn.text)) {
            fill = THEME.pink;
            text = THEME.paper;
            highlight = _mix(THEME.pink, '#ffffff', 0.4);
            shadow = _mix(THEME.pink, '#000000', 0.2);
        }

        return {
            text: text,
            fill: fill,
            border: border,
            highlight: highlight,
            shadow: shadow
        };
    }

    /** 注册触摸事件到 Canvas */
    function bindTouch(canvas) {
        if (_touchHandler) {
            canvas.removeEventListener('touchstart', _touchHandler.down);
            canvas.removeEventListener('mousedown', _touchHandler.down);
            canvas.removeEventListener('touchend', _touchHandler.up);
            canvas.removeEventListener('mouseup', _touchHandler.up);
            canvas.removeEventListener('touchcancel', _touchHandler.up);
            canvas.removeEventListener('mouseleave', _touchHandler.up);
        }

        var _handleDown = function (e) {
            e.preventDefault();
            if (window.Audio && Audio.init) Audio.init(); // 首次交互激活音频
            var rect = canvas.getBoundingClientRect();
            var touch = e.touches ? e.touches[0] : e;
            var x = touch.clientX - rect.left;
            var y = touch.clientY - rect.top;
            for (var i = _buttons.length - 1; i >= 0; i--) {
                var b = _buttons[i];
                if (b.visible !== false && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                    b.isPressed = true;
                    break;
                }
            }
        };

        var _handleUp = function (e) {
            e.preventDefault();
            var rect = canvas.getBoundingClientRect();
            var touch = e.changedTouches ? e.changedTouches[0] : e;
            var x = touch.clientX - rect.left;
            var y = touch.clientY - rect.top;
            for (var i = _buttons.length - 1; i >= 0; i--) {
                var b = _buttons[i];
                if (b.isPressed) {
                    b.isPressed = false;
                    if (b.visible !== false && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                        if (b.onClick) b.onClick();
                    }
                }
            }
        };

        _touchHandler = { down: _handleDown, up: _handleUp };
        canvas.addEventListener('touchstart', _handleDown, { passive: false });
        canvas.addEventListener('mousedown', _handleDown);
        canvas.addEventListener('touchend', _handleUp);
        canvas.addEventListener('mouseup', _handleUp);
        canvas.addEventListener('touchcancel', _handleUp);
        canvas.addEventListener('mouseleave', _handleUp);
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
        if (/返回|首页/.test(btn.text)) {
            btn.fontSize = Math.max(15, btn.fontSize);
            btn.w = Math.max(78, btn.w);
            btn.h = Math.max(40, btn.h);
        }
        _buttons.push(btn);
        return btn;
    }

    /** 绘制所有按钮 */
    function drawButtons(ctx) {
        for (var i = 0; i < _buttons.length; i++) {
            var b = _buttons[i];
            if (b.visible === false) continue;
            var theme = _resolveButtonTheme(b);
            
            var offsetY = b.isPressed ? 4 : 0; // 按下时向下偏移4像素
            var currentH = b.isPressed ? b.h - 4 : b.h; // 按下时高度减少（模拟厚度被压平）
            
            _drawPixelFrame(ctx, b.x, b.y + offsetY, b.w, currentH, theme.fill, theme.border, theme.highlight, theme.shadow);
            _drawText(ctx, b.icon ? (b.icon + ' ' + b.text) : b.text, b.x + b.w / 2, b.y + offsetY + currentH / 2 + 1, b.fontSize || 18, theme.text, 'center');
        }
    }

    function _drawRoundedRect(ctx, x, y, w, h, r, fill, stroke) {
        _drawPixelFrame(ctx, x, y, w, h, fill, stroke, _mix(fill, '#ffffff', 0.3), _mix(fill, '#000000', 0.2));
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

        _drawPixelFrame(ctx, cx, cy, cardW, cardH, THEME.panel, THEME.ink, THEME.cyan, _mix(THEME.panel, '#000000', 0.2));

        // 标题
        if (opts.title) {
            var titleW = 200, titleH = 44;
            _drawPixelFrame(ctx, w / 2 - titleW / 2, cy + 24, titleW, titleH, THEME.pink, THEME.ink);
            _drawText(ctx, opts.title, w / 2, cy + 24 + titleH / 2 + 2, 20, THEME.gold, 'center');
        }

        // 内容
        if (opts.content) {
            ctx.save();
            ctx.font = _font(16, false);
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = THEME.ink;
            ctx.fillStyle = THEME.paper;
            ctx.textAlign = 'center';
            var lines = _wrapText(ctx, opts.content, cardW - 40);
            for (var i = 0; i < lines.length; i++) {
                ctx.strokeText(lines[i], w / 2, cy + 90 + i * 28);
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
        ctx.font = _font(size, true);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'miter';
        ctx.lineWidth = Math.max(3, Math.floor(size / 5));
        ctx.strokeStyle = THEME.ink;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color || THEME.gold;
        ctx.fillText(text, x, y);
        ctx.fillStyle = _mix(color || THEME.gold, '#ffffff', 0.4);
        ctx.fillText(text, x, y - 2);
        ctx.restore();
    }

    /** 绘制说明文字 */
    function drawSubtitle(ctx, text, x, y, size, color) {
        ctx.save();
        ctx.font = _font(size, false);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'miter';
        ctx.lineWidth = 3;
        ctx.strokeStyle = THEME.ink;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color || THEME.cyan;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    /** 绘制进度条 */
    function drawProgressBar(ctx, x, y, w, h, progress, color) {
        var b = 4;
        _drawPixelFrame(ctx, x, y, w, h, THEME.ink, THEME.ink);
        if (progress > 0) {
            var fillW = Math.max(b, (w - b * 2) * Math.min(1, progress));
            ctx.fillStyle = color || THEME.gold;
            ctx.fillRect(x + b, y + b, fillW, h - b * 2);
            ctx.fillStyle = _mix(color || THEME.gold, '#ffffff', 0.4);
            ctx.fillRect(x + b, y + b, fillW, b);
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
