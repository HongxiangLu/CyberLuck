/**
 * stickman.js — 拜年小人场景
 */
var StickmanScene = (function () {
    'use strict';

    var _phase = 'prepare'; // prepare -> playing -> result
    var _timer = 8;
    var _lastTime = 0;

    var _nodes = [];
    var _constraints = [];
    var _selectedNode = null;
    var _touching = false;
    var _touchX = 0, _touchY = 0;

    var FLOOR_Y = 0;
    var W = 0, H = 0;
    var _touchStartHandler = null, _touchMoveHandler = null, _touchEndHandler = null;

    /** 节点定义 */
    function Node(x, y, radius, pin) {
        this.x = x;
        this.y = y;
        this.oldX = x;
        this.oldY = y;
        this.radius = radius || 5;
        this.pinned = !!pin;
    }

    /** 约束定义 */
    function Constraint(p1, p2, len, thickness, color) {
        this.p1 = p1;
        this.p2 = p2;
        this.len = len || _dist(p1, p2);
        this.thickness = thickness || 8;
        this.color = color || '#FA8072';
    }

    function _dist(p1, p2) {
        var dx = p1.x - p2.x; var dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function _initStickman() {
        _nodes = [];
        _constraints = [];
        
        var cx = W / 2;
        var cy = H * 0.45;
        var scale = 1.0;

        // 节点命名: (仅用作索引标记方便查阅)
        var head = new Node(cx, cy - 100 * scale, 22);
        var neck = new Node(cx, cy - 70 * scale, 10);
        var pelvis = new Node(cx, cy, 15);
        
        var lShoulder = new Node(cx - 20 * scale, cy - 65 * scale, 8);
        var rShoulder = new Node(cx + 20 * scale, cy - 65 * scale, 8);
        var lElbow = new Node(cx - 45 * scale, cy - 25 * scale, 8);
        var rElbow = new Node(cx + 45 * scale, cy - 25 * scale, 8);
        var lHand = new Node(cx - 65 * scale, cy + 15 * scale, 10);
        var rHand = new Node(cx + 65 * scale, cy + 15 * scale, 10);

        var lHip = new Node(cx - 15 * scale, cy + 10 * scale, 12);
        var rHip = new Node(cx + 15 * scale, cy + 10 * scale, 12);
        var lKnee = new Node(cx - 25 * scale, cy + 70 * scale, 9);
        var rKnee = new Node(cx + 25 * scale, cy + 70 * scale, 9);
        var lFoot = new Node(cx - 30 * scale, cy + 130 * scale, 12);
        var rFoot = new Node(cx + 30 * scale, cy + 130 * scale, 12);

        _nodes.push(head, neck, pelvis, lShoulder, rShoulder, lElbow, rElbow, lHand, rHand, lHip, rHip, lKnee, rKnee, lFoot, rFoot);

        // 主干
        _addConstraint(head, neck, null, 14, '#FFDEAD');
        _addConstraint(neck, pelvis, null, 18, '#FA8072');
        _addConstraint(lShoulder, rShoulder, null, 18, '#FA8072');
        _addConstraint(neck, lShoulder, null, 15, '#FA8072');
        _addConstraint(neck, rShoulder, null, 15, '#FA8072');
        _addConstraint(pelvis, lHip, null, 16, '#2F4F4F');
        _addConstraint(pelvis, rHip, null, 16, '#2F4F4F');
        _addConstraint(lHip, rHip, null, 16, '#2F4F4F');

        // 四肢
        _addConstraint(lShoulder, lElbow, null, 12, '#FA8072');
        _addConstraint(lElbow, lHand, null, 10, '#FFDEAD');
        _addConstraint(rShoulder, rElbow, null, 12, '#FA8072');
        _addConstraint(rElbow, rHand, null, 10, '#FFDEAD');

        _addConstraint(lHip, lKnee, null, 14, '#2F4F4F');
        _addConstraint(lKnee, lFoot, null, 12, '#2F4F4F');
        _addConstraint(rHip, rKnee, null, 14, '#2F4F4F');
        _addConstraint(rKnee, rFoot, null, 12, '#2F4F4F');

        // 为保持形态增加一些交叉角度约束
        _addConstraint(lShoulder, pelvis, null, 5, 'rgba(0,0,0,0)'); // 隐形腹部支撑
        _addConstraint(rShoulder, pelvis, null, 5, 'rgba(0,0,0,0)');
    }

    function _addConstraint(n1, n2, len, thick, color) {
        _constraints.push(new Constraint(n1, n2, len, thick, color));
    }

    function init() {
        _phase = 'prepare';
        _timer = 8;
        _touching = false;
        _selectedNode = null;
        W = Engine.width();
        H = Engine.height();
        FLOOR_Y = H * 0.85;

        _initStickman();
        _setupUI();
        _bindTouchEvents();
        _lastTime = performance.now();
        Engine.startLoop(render);
    }

    function _setupUI() {
        UI.clearButtons();

        if (_phase === 'prepare') {
            UI.createButton({
                x: 15, y: 15, w: 70, h: 36,
                text: '← 返回',
                color: 'rgba(255,255,255,0.7)',
                bgColor: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.15)',
                fontSize: 13, radius: 18,
                onClick: function () { App.switchScene('home'); }
            });

            var btnW = Math.min(W * 0.6, 220);
            UI.createButton({
                x: (W - btnW) / 2,
                y: H * 0.72,
                w: btnW, h: 52,
                text: '▶ 准备开始',
                color: '#FFF',
                bgColor: 'rgba(250,128,114,0.3)',
                borderColor: 'rgba(250,128,114,0.8)',
                fontSize: 18, radius: 26,
                onClick: function () {
                    Audio.playTap();
                    _phase = 'playing';
                    _lastTime = performance.now();
                    _setupUI();
                }
            });
        } else if (_phase === 'playing') {
            // 没有按键
        } else if (_phase === 'result') {
            var btnW = Math.min(W * 0.45, 160);
            
            // 重来
            UI.createButton({
                x: W / 2 - btnW - 10,
                y: H * 0.88,
                w: btnW, h: 48,
                text: '↺ 重来',
                color: '#FFF',
                bgColor: 'rgba(255,255,255,0.1)',
                borderColor: 'rgba(255,255,255,0.3)',
                fontSize: 16, radius: 24,
                onClick: function () {
                    Audio.playTap();
                    init();
                }
            });

            // 保存图片
            UI.createButton({
                x: W / 2 + 10,
                y: H * 0.88,
                w: btnW, h: 48,
                text: '⬇ 保存图片',
                color: '#FFD700',
                bgColor: 'rgba(255,215,0,0.2)',
                borderColor: 'rgba(255,215,0,0.6)',
                fontSize: 16, radius: 24,
                onClick: function () {
                    Audio.playSuccess();
                    _saveImage();
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
    }

    function _bindTouchEvents() {
        var canvas = Engine.getCanvas();

        _touchStartHandler = function (e) {
            e.preventDefault();
            if (_phase !== 'playing') return;
            var touch = e.touches ? e.touches[0] : e;
            var rect = canvas.getBoundingClientRect();
            _touchX = touch.clientX - rect.left;
            _touchY = touch.clientY - rect.top;
            _touching = true;

            // 查找最近的节点
            var minDist = Infinity;
            _selectedNode = null;
            for (var i = 0; i < _nodes.length; i++) {
                var d = _dist(_nodes[i], { x: _touchX, y: _touchY });
                if (d < 40 && d < minDist) {
                    minDist = d;
                    _selectedNode = _nodes[i];
                }
            }
            if (_selectedNode) Device.tapVibrate();
        };

        _touchMoveHandler = function (e) {
            e.preventDefault();
            if (!_touching || _phase !== 'playing') return;
            var touch = e.touches ? e.touches[0] : e;
            var rect = canvas.getBoundingClientRect();
            _touchX = touch.clientX - rect.left;
            _touchY = touch.clientY - rect.top;
        };

        _touchEndHandler = function (e) {
            e.preventDefault();
            _touching = false;
            _selectedNode = null;
        };

        canvas.addEventListener('touchstart', _touchStartHandler, { passive: false });
        canvas.addEventListener('touchmove', _touchMoveHandler, { passive: false });
        canvas.addEventListener('touchend', _touchEndHandler, { passive: false });
        canvas.addEventListener('mousedown', _touchStartHandler);
        canvas.addEventListener('mousemove', _touchMoveHandler);
        canvas.addEventListener('mouseup', _touchEndHandler);
    }

    function _updatePhysics(dt) {
        // Verlet 积分
        for (var i = 0; i < _nodes.length; i++) {
            var p = _nodes[i];
            if (p.pinned) continue;
            
            var vx = (p.x - p.oldX) * 0.95; // 摩擦/阻尼
            var vy = (p.y - p.oldY) * 0.95;

            vy += 0.5; // 轻微重力

            p.oldX = p.x;
            p.oldY = p.y;
            p.x += vx;
            p.y += vy;

            // 地面碰撞
            if (p.y > FLOOR_Y - p.radius) {
                p.y = FLOOR_Y - p.radius;
                // p.oldX = p.x + vx * 0.5; 
            }
            // 边缘反弹
            if (p.x < p.radius) p.x = p.radius;
            if (p.x > W - p.radius) p.x = W - p.radius;
        }

        // 手指牵引
        if (_selectedNode && _touching) {
            _selectedNode.x += (_touchX - _selectedNode.x) * 0.3;
            _selectedNode.y += (_touchY - _selectedNode.y) * 0.3;
            // 立即满足一次地面约束防止直接拖入地下
            if (_selectedNode.y > FLOOR_Y - _selectedNode.radius) {
                _selectedNode.y = FLOOR_Y - _selectedNode.radius;
            }
        }

        // 约束解算迭代 (降低穿插, 增加刚性)
        for (var iter = 0; iter < 5; iter++) {
            for (var c = 0; c < _constraints.length; c++) {
                var cst = _constraints[c];
                var dx = cst.p2.x - cst.p1.x;
                var dy = cst.p2.y - cst.p1.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                var diff = (cst.len - dist) / dist;

                var ox = dx * 0.5 * diff;
                var oy = dy * 0.5 * diff;

                if (!cst.p1.pinned) { cst.p1.x -= ox; cst.p1.y -= oy; }
                if (!cst.p2.pinned) { cst.p2.x += ox; cst.p2.y += oy; }
            }
        }
    }

    function _drawStickman(ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 绘制连线
        for (var i = 0; i < _constraints.length; i++) {
            var c = _constraints[i];
            if (c.color === 'rgba(0,0,0,0)') continue;
            ctx.beginPath();
            ctx.moveTo(c.p1.x, c.p1.y);
            ctx.lineTo(c.p2.x, c.p2.y);
            ctx.strokeStyle = c.color;
            ctx.lineWidth = c.thickness;
            ctx.stroke();

            // 衣服阴影/高光轮廓
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = c.thickness + 2;
            ctx.stroke();
        }

        // 绘制节点关节
        for (var j = 0; j < _nodes.length; j++) {
            var p = _nodes[j];
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            // 头部特殊绘制
            if (j === 0) {
                ctx.fillStyle = '#FFDEAD';
                ctx.fill();
                ctx.strokeStyle = '#CD853F';
                ctx.lineWidth = 1;
                ctx.stroke();
                // 脸
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.arc(p.x - 6, p.y - 2, 2, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(p.x + 6, p.y - 2, 2, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(p.x, p.y + 6, 4, 0, Math.PI); ctx.stroke();
            } else if (j >= 7 && j <= 8) { // 手
                ctx.fillStyle = '#FFDEAD';
                ctx.fill();
            } else if (j >= 13 && j <= 14) { // 鞋
                ctx.fillStyle = '#000';
                ctx.fill();
            } else {
                ctx.fillStyle = '#fff'; // 隐藏内关节，让连线显得顺滑
                // 只在选中时高亮
                if (p === _selectedNode) {
                    ctx.fillStyle = 'rgba(255,255,255, 0.5)';
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2); ctx.fill();
                }
            }
        }
    }

    function render(ctx, w, h) {
        var now = performance.now();
        var dt = (now - _lastTime) / 1000;
        _lastTime = now;

        if (_phase === 'playing') {
            _timer -= dt;
            _updatePhysics();
            if (_timer <= 0) {
                _timer = 0;
                _phase = 'result';
                _setupUI();
                Audio.playBlockDrop(); // 落地定格音效
                Device.mediumVibrate();
                Engine.addGoldBurst(w / 2, h / 2);
            }
        }

        Draw.drawBackground(ctx, w, h, '#be1e2d', '#7d0013'); // 年味红

        // 装饰灯笼
        ctx.fillStyle = 'rgba(255,215,0,0.15)';
        ctx.beginPath(); ctx.arc(w * 0.1, h * 0.1, 40, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.9, h * 0.1, 40, 0, Math.PI * 2); ctx.fill();

        // 地面
        ctx.fillStyle = '#3a0808';
        ctx.fillRect(0, FLOOR_Y, w, h - FLOOR_Y);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, FLOOR_Y); ctx.lineTo(w, FLOOR_Y); ctx.stroke();

        _drawStickman(ctx);

        if (_phase === 'prepare') {
            UI.drawTitle(ctx, '拜年小人', w / 2, h * 0.15, 36, '#FFD700');
            
            ctx.save();
            ctx.font = '16px -apple-system, sans-serif';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText('拖拽四肢，摆出拜年姿势！', w / 2, h * 0.25);
            ctx.fillText('限时 8 秒', w / 2, h * 0.3);
            ctx.restore();
        } else if (_phase === 'playing') {
            UI.drawTitle(ctx, Math.ceil(_timer) + 's', w / 2, h * 0.12, 48, '#FFD700');
            UI.drawSubtitle(ctx, '拖住身体并拉长为作揖状~', w / 2, h * 0.18, 14, 'rgba(255,255,255,0.7)');
        } else if (_phase === 'result') {
            Draw.drawHalo(ctx, w / 2, h * 0.4, 150, '#FFD700', 0.2);
            
            // 水印金字
            ctx.save();
            ctx.translate(w / 2, h * 0.2);
            ctx.rotate(-0.1);
            UI.drawTitle(ctx, '🎉 新年快乐 🎉', 0, 0, 42, '#FFD700');
            ctx.fillStyle = '#fff';
            ctx.font = '16px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('大吉大利 · 岁岁平安', 0, 40);
            ctx.restore();
        }

        UI.drawButtons(ctx);
    }

    function _saveImage() {
        var ctx = Engine.getCtx();
        var cvs = Engine.getCanvas();
        
        UI.clearButtons(); 
        
        // 手动再渲染一帧（没有UI按键）
        render(ctx, W, H);

        try {
            var dataUrl = cvs.toDataURL('image/png');
            var a = document.createElement('a');
            a.href = dataUrl;
            a.download = '新年拜年.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            alert('保存失败，请截图保存吧~');
        }

        // 恢复按键
        _setupUI();
    }

    function destroy() {
        UI.clearButtons();
        var canvas = Engine.getCanvas();
        if (_touchStartHandler) {
            canvas.removeEventListener('touchstart', _touchStartHandler);
            canvas.removeEventListener('mousedown', _touchStartHandler);
        }
        if (_touchMoveHandler) {
            canvas.removeEventListener('touchmove', _touchMoveHandler);
            canvas.removeEventListener('mousemove', _touchMoveHandler);
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
