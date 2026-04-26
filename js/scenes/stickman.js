/**
 * stickman.js — 拜年姿势王场景（刚体旋转 FK 模型）
 */
var StickmanScene = (function () {
    'use strict';

    var _phase = 'prepare'; // prepare -> playing -> result
    var _timer = 8;
    var _lastTime = 0;
    var _time = 0;
    var W = 0, H = 0, FLOOR_Y = 0;

    var _segments = [];
    var _segMap = {};
    var _selectedSeg = null;
    var _dragStartAngle = 0;
    var _dragPivotX = 0, _dragPivotY = 0;
    var _dropProgress = 1;
    var _dropDuration = 0.55;
    var _dropFromPose = null;
    var _dropToPose = null;

    var _touchStartH = null, _touchMoveH = null, _touchEndH = null;

    /* ====== 骨骼初始化 ====== */
    function _initSegments() {
        var leftFootX = W * 0.47;
        var shin = 70, thigh = 66, torso = 88, headL = 28;
        var uArm = 54, fArm = 48;

        // angle: 绝对世界角 (0=正上方, PI/2=右, PI=下, -PI/2=左)
        // attachRatio: 在 parent 线段上的比例位置 (0=pivot端, 1=end端)
        // offX: 垂直于 parent 方向的侧偏移 (parent 本地坐标)
        _segments = [
            { id:'lShin',  pid:null,     angle:0,    len:shin,  thick:9,  color:'#3a5f5f', lbl:'左小腿',
              fpx:leftFootX, fpy:0/*FLOOR_Y*/, ar:1, ox:0 },
            { id:'lThigh', pid:'lShin',  angle:0,    len:thigh, thick:11, color:'#3a5f5f', lbl:'左大腿',
              ar:1, ox:0 },
            { id:'torso',  pid:'lThigh', angle:0,    len:torso, thick:14, color:'#c0392b', lbl:'躯干',
              ar:1, ox:0 },
            { id:'head',   pid:'torso',  angle:0,    len:headL, thick:0,  color:'#FFDEAD', lbl:'头部',
              ar:1, ox:0, isHead:true },
            { id:'lUArm',  pid:'torso',  angle:Math.PI*0.85,  len:uArm, thick:8, color:'#c0392b', lbl:'左大臂',
              ar:0.92, ox:-8 },
            { id:'lFArm',  pid:'lUArm',  angle:Math.PI*0.9,   len:fArm, thick:7, color:'#FFDEAD', lbl:'左小臂',
              ar:1, ox:0 },
            { id:'rUArm',  pid:'torso',  angle:Math.PI*1.15,   len:uArm, thick:8, color:'#c0392b', lbl:'右大臂',
              ar:0.92, ox:8 },
            { id:'rFArm',  pid:'rUArm',  angle:Math.PI*1.1,    len:fArm, thick:7, color:'#FFDEAD', lbl:'右小臂',
              ar:1, ox:0 },
            { id:'rThigh', pid:'torso',  angle:Math.PI,        len:thigh,thick:11,color:'#2F4F4F', lbl:'右大腿',
              ar:0, ox:8 },
            { id:'rShin',  pid:'rThigh', angle:Math.PI,        len:shin, thick:9, color:'#2F4F4F', lbl:'右小腿',
              ar:1, ox:0 }
        ];

        _segMap = {};
        for (var i = 0; i < _segments.length; i++) {
            var s = _segments[i];
            s.px = 0; s.py = 0; s.ex = 0; s.ey = 0;
            s.children = [];
            _segMap[s.id] = s;
        }
        for (var j = 0; j < _segments.length; j++) {
            var seg = _segments[j];
            if (seg.pid && _segMap[seg.pid]) {
                _segMap[seg.pid].children.push(seg);
            }
        }
        // 设置 root 的固定 pivot Y
        _segments[0].fpy = FLOOR_Y;
        _computeFK();
    }

    function _buildBowPose() {
        return {
            lShin: 0.03,
            lThigh: 0.12,
            torso: 0.68,
            head: 0.76,
            lUArm: 1.72,
            lFArm: 1.08,
            rUArm: 1.46,
            rFArm: 1.88,
            rThigh: Math.PI - 0.16,
            rShin: Math.PI - 0.06
        };
    }

    function _buildLoosePose() {
        return {
            lShin: 0.04,
            lThigh: -0.12,
            torso: 0.22,
            head: 0.28,
            lUArm: 2.56,
            lFArm: 2.9,
            rUArm: 3.64,
            rFArm: 3.28,
            rThigh: Math.PI + 0.16,
            rShin: Math.PI + 0.04
        };
    }

    function _capturePose() {
        var pose = {};
        for (var i = 0; i < _segments.length; i++) {
            pose[_segments[i].id] = _segments[i].angle;
        }
        return pose;
    }

    function _normalizeAngle(a) {
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        return a;
    }

    function _lerpAngle(a, b, t) {
        return a + _normalizeAngle(b - a) * t;
    }

    function _applyPose(pose) {
        for (var i = 0; i < _segments.length; i++) {
            if (pose[_segments[i].id] == null) continue;
            _segments[i].angle = pose[_segments[i].id];
        }
        _computeFK();
    }

    function _applyPoseBlend(fromPose, toPose, t) {
        for (var i = 0; i < _segments.length; i++) {
            var seg = _segments[i];
            var from = fromPose[seg.id];
            var to = toPose[seg.id];
            if (from == null || to == null) continue;
            seg.angle = _lerpAngle(from, to, t);
        }
        _computeFK();
    }

    function _easeOutCubic(t) {
        return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
    }

    function _getFloatAnchor() {
        return {
            x: W * 0.47,
            y: H * 0.67
        };
    }

    function _getGroundAnchor() {
        return {
            x: W * 0.47,
            y: FLOOR_Y
        };
    }

    function _setRootAnchor(x, y) {
        _segments[0].fpx = x;
        _segments[0].fpy = y;
    }

    function _placePrepareFigure() {
        var anchor = _getFloatAnchor();
        _setRootAnchor(anchor.x, anchor.y);
        _applyPose(_buildBowPose());
        _dropProgress = 1;
    }

    function _startChallenge() {
        Audio.playTap();
        _phase = 'playing';
        _selectedSeg = null;
        _dropProgress = 0;
        _dropFromPose = _capturePose();
        _dropToPose = _buildLoosePose();
        _lastTime = performance.now();
        _setupUI();
    }

    /* ====== 前向运动学 ====== */
    function _computeFK() {
        var rootBob = 0;
        if (_phase === 'prepare' || _phase === 'result') {
            rootBob = Math.sin(_time * 4) * 3; // 待机时的轻微呼吸动效
        }

        for (var i = 0; i < _segments.length; i++) {
            var s = _segments[i];
            if (!s.pid) {
                // 根节点：固定 pivot
                s.px = s.fpx;
                s.py = s.fpy + rootBob;
            } else {
                var p = _segMap[s.pid];
                // attach 点 = p.pivot + (p.end - p.pivot) * attachRatio
                var ax = p.px + (p.ex - p.px) * s.ar;
                var ay = p.py + (p.ey - p.py) * s.ar;
                // 侧偏移：垂直于 parent 方向
                if (s.ox !== 0) {
                    var pdx = p.ex - p.px, pdy = p.ey - p.py;
                    var pLen = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
                    ax += (-pdy / pLen) * s.ox;
                    ay += (pdx / pLen) * s.ox;
                }
                s.px = ax;
                s.py = ay;
            }
            s.ex = s.px + s.len * Math.sin(s.angle);
            s.ey = s.py - s.len * Math.cos(s.angle);
        }
    }

    /* ====== 旋转一个部位 + 所有远地端子代 ====== */
    function _rotateSeg(seg, delta) {
        seg.angle += delta;
        _rotateChildren(seg, delta);
    }
    function _rotateChildren(seg, delta) {
        for (var i = 0; i < seg.children.length; i++) {
            seg.children[i].angle += delta;
            _rotateChildren(seg.children[i], delta);
        }
    }

    /* ====== 场景生命周期 ====== */
    function init() {
        _phase = 'prepare';
        _timer = 8;
        _time = 0;
        _selectedSeg = null;
        _dropProgress = 1;
        W = Engine.width();
        H = Engine.height();
        FLOOR_Y = H * 0.82;

        _initSegments();
        _placePrepareFigure();
        _setupUI();
        _bindTouch();
        _lastTime = performance.now();
        Engine.startLoop(render);
    }

    function _setupUI() {
        UI.clearButtons();
        if (_phase === 'prepare') {
            UI.createButton({ x:15,y:15,w:70,h:36, text:'返回',
                color:'rgba(255,255,255,0.7)', bgColor:'rgba(255,255,255,0.05)',
                borderColor:'rgba(255,255,255,0.15)', fontSize:13, radius:18,
                onClick:function(){ App.switchScene('home'); } });
            var bw = Math.min(W*0.6,220);
            UI.createButton({ x:(W-bw)/2, y:H*0.76, w:bw, h:52, text:'开始挑战',
                color:'#FFF', bgColor:'rgba(250,128,114,0.3)',
                borderColor:'rgba(250,128,114,0.8)', fontSize:18, radius:26,
                onClick:_startChallenge });
        } else if (_phase === 'result') {
            var bw2 = Math.min(W*0.42,155);
            UI.createButton({ x:W/2-bw2-8, y:H*0.88, w:bw2, h:46, text:'重来',
                color:'#FFF', bgColor:'rgba(255,255,255,0.1)',
                borderColor:'rgba(255,255,255,0.3)', fontSize:15, radius:23,
                onClick:function(){ Audio.playTap(); init(); } });
            UI.createButton({ x:W/2+8, y:H*0.88, w:bw2, h:46, text:'保存图片',
                color:'#FFD700', bgColor:'rgba(255,215,0,0.2)',
                borderColor:'rgba(255,215,0,0.6)', fontSize:15, radius:23,
                onClick:function(){ Audio.playSuccess(); _saveImage(); } });
            UI.createButton({ x:15,y:15,w:70,h:36, text:'首页',
                color:'rgba(255,255,255,0.7)', bgColor:'rgba(255,255,255,0.05)',
                borderColor:'rgba(255,255,255,0.15)', fontSize:13, radius:18,
                onClick:function(){ App.switchScene('home'); } });
        }
    }

    /* ====== 触摸交互 ====== */
    function _bindTouch() {
        var canvas = Engine.getCanvas();

        _touchStartH = function (e) {
            e.preventDefault();
            if (_phase !== 'playing' || _dropProgress < 1) return;
            var pos = _touchPos(e);
            // 寻找被点击的肢节
            var best = null, bestD = 30;
            for (var i = 0; i < _segments.length; i++) {
                var s = _segments[i];
                var d = _distToSegment(pos.x, pos.y, s.px, s.py, s.ex, s.ey);
                if (d < bestD) { bestD = d; best = s; }
            }
            if (best) {
                _selectedSeg = best;
                _dragPivotX = best.px;
                _dragPivotY = best.py;
                _dragStartAngle = Math.atan2(pos.x - _dragPivotX, -(pos.y - _dragPivotY));
                Device.tapVibrate();
            }
        };

        _touchMoveH = function (e) {
            e.preventDefault();
            if (!_selectedSeg || _phase !== 'playing' || _dropProgress < 1) return;
            var pos = _touchPos(e);
            var newAngle = Math.atan2(pos.x - _dragPivotX, -(pos.y - _dragPivotY));
            var delta = newAngle - _dragStartAngle;
            // 标准化到 [-PI, PI]
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            if (Math.abs(delta) > 0.003) {
                _rotateSeg(_selectedSeg, delta);
                _computeFK();
                _dragStartAngle = newAngle;
            }
        };

        _touchEndH = function (e) {
            e.preventDefault();
            _selectedSeg = null;
        };

        canvas.addEventListener('touchstart', _touchStartH, { passive: false });
        canvas.addEventListener('touchmove', _touchMoveH, { passive: false });
        canvas.addEventListener('touchend', _touchEndH, { passive: false });
        canvas.addEventListener('mousedown', _touchStartH);
        canvas.addEventListener('mousemove', _touchMoveH);
        canvas.addEventListener('mouseup', _touchEndH);
    }

    function _touchPos(e) {
        var t = e.touches ? e.touches[0] : e;
        var r = Engine.getCanvas().getBoundingClientRect();
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    }

    function _distToSegment(px, py, ax, ay, bx, by) {
        var dx = bx - ax, dy = by - ay;
        var lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.sqrt((px-ax)*(px-ax)+(py-ay)*(py-ay));
        var t = Math.max(0, Math.min(1, ((px-ax)*dx+(py-ay)*dy)/lenSq));
        var cx = ax + t * dx, cy = ay + t * dy;
        return Math.sqrt((px-cx)*(px-cx)+(py-cy)*(py-cy));
    }

    /* ====== 绘制 ====== */
    function _mixColor(hex1, hex2, t) {
        var a = {
            r: parseInt(hex1.slice(1, 3), 16),
            g: parseInt(hex1.slice(3, 5), 16),
            b: parseInt(hex1.slice(5, 7), 16)
        };
        var b = {
            r: parseInt(hex2.slice(1, 3), 16),
            g: parseInt(hex2.slice(3, 5), 16),
            b: parseInt(hex2.slice(5, 7), 16)
        };
        var p = Math.max(0, Math.min(1, t));
        var r = Math.round(a.r + (b.r - a.r) * p);
        var g = Math.round(a.g + (b.g - a.g) * p);
        var bl = Math.round(a.b + (b.b - a.b) * p);
        return '#' + (1 << 24 | r << 16 | g << 8 | bl).toString(16).slice(1);
    }

    function _drawPuppetLimb(ctx, s, opts) {
        if (!s) return;
        opts = opts || {};
        var dx = s.ex - s.px;
        var dy = s.ey - s.py;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ang = Math.atan2(dy, dx);
        var width = opts.width || (s.thick + 12);
        var tailWidth = opts.tailWidth || width * 0.82;
        var border = opts.border || '#150a26';
        var fill = opts.fill || '#5b1d36';
        var trim = opts.trim || '#ffd75e';
        var highlight = opts.highlight || _mixColor(fill, '#ffffff', 0.16);
        var innerInset = Math.max(3, Math.round(width * 0.16));
        var startFlare = opts.startFlare || 1.12;
        var endFlare = opts.endFlare || 0.9;
        var notch = Math.max(4, width * 0.16);

        ctx.save();
        ctx.translate(s.px, s.py);
        ctx.rotate(ang);

        ctx.beginPath();
        ctx.moveTo(-notch, -width * startFlare * 0.46);
        ctx.lineTo(len * 0.18, -width * 0.56);
        ctx.lineTo(len + notch, -tailWidth * endFlare * 0.46);
        ctx.lineTo(len + notch, tailWidth * endFlare * 0.46);
        ctx.lineTo(len * 0.18, width * 0.56);
        ctx.lineTo(-notch, width * startFlare * 0.46);
        ctx.closePath();
        ctx.fillStyle = border;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, -width * 0.38);
        ctx.lineTo(len * 0.2, -width * 0.42);
        ctx.lineTo(len, -tailWidth * 0.34);
        ctx.lineTo(len, tailWidth * 0.34);
        ctx.lineTo(len * 0.2, width * 0.42);
        ctx.lineTo(0, width * 0.38);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.fillStyle = highlight;
        ctx.fillRect(innerInset, -width * 0.26, Math.max(8, len - innerInset * 2), 2);

        ctx.strokeStyle = trim;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, -width * 0.26);
        ctx.lineTo(len - 4, -tailWidth * 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, width * 0.26);
        ctx.lineTo(len - 4, tailWidth * 0.2);
        ctx.stroke();

        if (opts.cutoutCount) {
            ctx.fillStyle = opts.cutout || '#ffefb3';
            for (var i = 0; i < opts.cutoutCount; i++) {
                var t = (i + 1) / (opts.cutoutCount + 1);
                var cx = len * (0.2 + t * 0.56);
                ctx.beginPath();
                ctx.arc(cx, 0, Math.max(2, width * 0.08), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    function _drawPuppetJoint(ctx, x, y, size) {
        var r = Math.max(5, size || 7);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r + 2, 0, Math.PI * 2);
        ctx.fillStyle = '#150a26';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#c68b2b';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - 1, y - 1, Math.max(2, r * 0.35), 0, Math.PI * 2);
        ctx.fillStyle = '#fff3a6';
        ctx.fill();
        ctx.restore();
    }

    function _drawPuppetFoot(ctx, x, y, flip) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(flip ? -1 : 1, 1);
        ctx.fillStyle = '#150a26';
        ctx.beginPath();
        ctx.moveTo(-6, 1);
        ctx.lineTo(18, -2);
        ctx.lineTo(22, 4);
        ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffd75e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(2, 2);
        ctx.lineTo(16, 0);
        ctx.stroke();
        ctx.restore();
    }

    function _drawPuppetHand(ctx, x, y, flip) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(flip ? -1 : 1, 1);
        ctx.fillStyle = '#150a26';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4ddb1';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function _drawPuppetHead(ctx, head, torso) {
        if (!head || !torso) return;
        var hcx = (head.px + head.ex) / 2;
        var hcy = (head.py + head.ey) / 2;
        var faceAngle = Math.atan2(torso.ey - torso.py, torso.ex - torso.px);
        var faceDirX = Math.cos(faceAngle - Math.PI / 2);
        var faceDirY = Math.sin(faceAngle - Math.PI / 2);
        var sideX = -faceDirY;
        var sideY = faceDirX;

        ctx.save();
        ctx.translate(hcx, hcy);

        ctx.beginPath();
        ctx.ellipse(0, 0, 19, 22, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#150a26';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, 1, 14, 18, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f4ddb1';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-20, -10);
        ctx.lineTo(0, -26);
        ctx.lineTo(20, -10);
        ctx.lineTo(18, -2);
        ctx.lineTo(-18, -2);
        ctx.closePath();
        ctx.fillStyle = '#7a1730';
        ctx.fill();

        ctx.fillStyle = '#ffd75e';
        ctx.fillRect(-7, -16, 14, 3);
        ctx.beginPath();
        ctx.arc(-16, -6, 4, 0, Math.PI * 2);
        ctx.arc(16, -6, 4, 0, Math.PI * 2);
        ctx.fill();

        var eyeOffsetX = Math.round(sideX * 4);
        var eyeOffsetY = Math.round(sideY * 4);
        var faceShiftX = Math.round(faceDirX * 2);
        var faceShiftY = Math.round(faceDirY * 2);

        ctx.fillStyle = '#150a26';
        ctx.beginPath();
        ctx.arc(-4 + eyeOffsetX + faceShiftX, -3 + eyeOffsetY + faceShiftY, 1.8, 0, Math.PI * 2);
        ctx.arc(4 + eyeOffsetX + faceShiftX, -3 + eyeOffsetY + faceShiftY, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-4 + faceShiftX, 5 + faceShiftY);
        ctx.quadraticCurveTo(0 + faceShiftX, 8 + faceShiftY, 4 + faceShiftX, 5 + faceShiftY);
        ctx.strokeStyle = '#150a26';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.fillStyle = '#f2ead9';
        ctx.beginPath();
        ctx.moveTo(-10, 10);
        ctx.lineTo(10, 10);
        ctx.lineTo(7, 18);
        ctx.lineTo(-7, 18);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d7cbb5';
        ctx.fillRect(-6, 14, 12, 3);

        ctx.restore();
    }

    function _drawTorsoDetails(ctx, torso) {
        if (!torso) return;
        var dx = torso.ex - torso.px;
        var dy = torso.ey - torso.py;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ang = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(torso.px, torso.py);
        ctx.rotate(ang);

        ctx.fillStyle = '#ffd75e';
        ctx.fillRect(len * 0.16, -4, Math.max(18, len * 0.46), 8);
        ctx.fillStyle = '#fff1a6';
        ctx.fillRect(len * 0.16, -4, Math.max(18, len * 0.46), 2);

        ctx.fillStyle = '#b6314a';
        ctx.fillRect(len * 0.56, -14, 8, 28);
        ctx.fillRect(len * 0.68, -9, 4, 20);
        ctx.fillStyle = '#150a26';
        ctx.fillRect(len * 0.56, -14, 2, 28);

        ctx.restore();
    }

    function _drawCharacterShadow(ctx, cx, y, scale, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha == null ? 0.24 : alpha;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(cx, y, 48 * (scale || 1), 12 * (scale || 1), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function _drawGuideCard(ctx, x, y, w, lines, accent) {
        var h = 18 + lines.length * 18;
        Draw.drawPanel(ctx, x, y, w, h, 'rgba(35,18,68,0.92)', accent || Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);
        ctx.save();
        ctx.font = '13px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        for (var i = 0; i < lines.length; i++) {
            ctx.strokeStyle = '#24113f';
            ctx.strokeText(lines[i], x + w / 2, y + 18 + i * 18);
            ctx.fillStyle = '#fff2c1';
            ctx.fillText(lines[i], x + w / 2, y + 18 + i * 18);
        }
        ctx.restore();
    }

    function _drawSelectionGlow(ctx, s) {
        if (!s) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 234, 0, 0.34)';
        ctx.lineWidth = s.isHead ? 20 : (s.thick + 14);
        ctx.lineCap = 'round';
        if (s.isHead) {
            var hcx = (s.px + s.ex) / 2;
            var hcy = (s.py + s.ey) / 2;
            ctx.beginPath();
            ctx.arc(hcx, hcy, s.len * 0.9, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(s.px, s.py);
            ctx.lineTo(s.ex, s.ey);
            ctx.stroke();
        }
        ctx.restore();
    }

    function _drawSleeveTrail(ctx, shoulder, hand, color) {
        if (!shoulder || !hand) return;
        var dx = hand.ex - shoulder.px;
        var dy = hand.ey - shoulder.py;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = -dy / len;
        var ny = dx / len;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(shoulder.px + nx * 9, shoulder.py + ny * 9);
        ctx.quadraticCurveTo(
            shoulder.px + dx * 0.45 + nx * 16,
            shoulder.py + dy * 0.45 + ny * 16,
            hand.ex + nx * 8,
            hand.ey + ny * 6
        );
        ctx.lineTo(hand.ex - nx * 8, hand.ey - ny * 6);
        ctx.quadraticCurveTo(
            shoulder.px + dx * 0.38 - nx * 12,
            shoulder.py + dy * 0.38 - ny * 12,
            shoulder.px - nx * 8,
            shoulder.py - ny * 8
        );
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffd75e';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    function _drawStickman(ctx) {
        var palette = {
            robe: '#5b1d36',
            robeDeep: '#150a26',
            sleeve: '#6f2242',
            skin: '#f4ddb1',
            leg: '#2d173f',
            legDeep: '#1d0d31'
        };

        var limbStyles = {
            lShin: { fill: palette.leg, width: 18, trim: '#b991ff', cutoutCount: 1 },
            lThigh: { fill: palette.leg, width: 22, trim: '#b991ff', cutoutCount: 1 },
            rThigh: { fill: palette.legDeep, width: 22, trim: '#9f6fff', cutoutCount: 1 },
            rShin: { fill: palette.legDeep, width: 18, trim: '#9f6fff', cutoutCount: 1 },
            torso: { fill: palette.robe, width: 30, tailWidth: 28, trim: '#ffd75e', cutoutCount: 2, highlight: '#8c3857' },
            lUArm: { fill: palette.sleeve, width: 22, trim: '#ffd75e', cutoutCount: 1, startFlare: 1.2, endFlare: 1.08 },
            rUArm: { fill: palette.sleeve, width: 22, trim: '#ffd75e', cutoutCount: 1, startFlare: 1.2, endFlare: 1.08 },
            lFArm: { fill: palette.sleeve, width: 20, trim: '#ff9bc0', cutoutCount: 1, startFlare: 1.18, endFlare: 1.14 },
            rFArm: { fill: palette.sleeve, width: 20, trim: '#ff9bc0', cutoutCount: 1, startFlare: 1.18, endFlare: 1.14 }
        };

        _drawSleeveTrail(ctx, _segMap['lUArm'], _segMap['lFArm'], 'rgba(143, 44, 78, 0.58)');
        _drawSleeveTrail(ctx, _segMap['rUArm'], _segMap['rFArm'], 'rgba(143, 44, 78, 0.58)');

        var drawOrder = ['rThigh','rShin','lShin','lThigh','torso','lUArm','lFArm','rUArm','rFArm'];
        for (var di = 0; di < drawOrder.length; di++) {
            var s = _segMap[drawOrder[di]];
            if (!s) continue;
            if (s === _selectedSeg) _drawSelectionGlow(ctx, s);
            _drawPuppetLimb(ctx, s, limbStyles[s.id]);
            _drawPuppetJoint(ctx, s.px, s.py, s.id === 'torso' ? 9 : 7);
        }

        _drawTorsoDetails(ctx, _segMap['torso']);

        if (_segMap['head'] === _selectedSeg) _drawSelectionGlow(ctx, _segMap['head']);
        _drawPuppetHead(ctx, _segMap['head'], _segMap['torso']);

        var lShin = _segMap['lShin'], rShin = _segMap['rShin'];
        if (lShin) _drawPuppetFoot(ctx, lShin.px, lShin.py, true);
        if (rShin) _drawPuppetFoot(ctx, rShin.ex, rShin.ey, false);

        var lf = _segMap['lFArm'], rf = _segMap['rFArm'];
        if (lf) _drawPuppetHand(ctx, lf.ex, lf.ey, true);
        if (rf) _drawPuppetHand(ctx, rf.ex, rf.ey, false);
    }

    /* ====== 渲染循环 ====== */
    function render(ctx, w, h) {
        var now = performance.now();
        var dt = (now - _lastTime) / 1000;
        _lastTime = now;
        _time += 0.016;

        if (_phase === 'playing') {
            if (_dropProgress < 1) {
                _dropProgress = Math.min(1, _dropProgress + dt / _dropDuration);
                if (_dropProgress >= 1) {
                    var ground = _getGroundAnchor();
                    _setRootAnchor(ground.x, ground.y);
                    _applyPose(_dropToPose || _buildLoosePose());
                }
            } else {
                _timer -= dt;
                if (_timer <= 0) {
                    _timer = 0;
                    _phase = 'result';
                    _selectedSeg = null;
                    _setupUI();
                    Audio.playBlockDrop();
                    Device.mediumVibrate();
                    Engine.addGoldBurst(w / 2, h * 0.4);
                }
            }
        }

        // 背景
        Draw.drawBackground(ctx, w, h);
        Draw.drawFrame(ctx, w, h);
        Draw.drawPanel(ctx, w * 0.08, h * 0.08, w * 0.84, h * 0.76, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);

        // 装饰灯笼
        ctx.fillStyle = 'rgba(255,88,179,0.18)';
        ctx.beginPath(); ctx.arc(w*0.1, h*0.08, 35, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(w*0.9, h*0.08, 35, 0, Math.PI*2); ctx.fill();

        // 地面
        ctx.fillStyle = Draw.THEME.pink;
        ctx.fillRect(0, FLOOR_Y, w, h - FLOOR_Y);
        ctx.strokeStyle = Draw.THEME.ink;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, FLOOR_Y); ctx.lineTo(w, FLOOR_Y); ctx.stroke();

        if (_phase === 'prepare') {
            var floatAnchor = _getFloatAnchor();
            _setRootAnchor(floatAnchor.x, floatAnchor.y + Math.sin(_time * 2.8) * 8);
            _applyPose(_buildBowPose());
            _drawCharacterShadow(ctx, w / 2, FLOOR_Y + 2, 1.2, 0.16);
            Draw.drawHalo(ctx, w / 2, h * 0.42, 120, Draw.THEME.gold, 0.12 + Math.sin(_time * 2.4) * 0.04);
        } else if (_phase === 'playing' && _dropProgress < 1) {
            var eased = _easeOutCubic(_dropProgress);
            var fromAnchor = _getFloatAnchor();
            var toAnchor = _getGroundAnchor();
            _setRootAnchor(
                fromAnchor.x + (toAnchor.x - fromAnchor.x) * eased,
                fromAnchor.y + (toAnchor.y - fromAnchor.y) * eased
            );
            _applyPoseBlend(_dropFromPose || _buildBowPose(), _dropToPose || _buildLoosePose(), eased);
            _drawCharacterShadow(ctx, w / 2, FLOOR_Y + 2, 0.9 + eased * 0.25, 0.12 + eased * 0.12);
        } else {
            if (_phase === 'playing' || _phase === 'result') {
                var groundAnchor = _getGroundAnchor();
                _setRootAnchor(groundAnchor.x, groundAnchor.y);
            }
            _computeFK();
            _drawCharacterShadow(ctx, w / 2, FLOOR_Y + 2, 1.18, 0.24);
        }

        _drawStickman(ctx);

        // --- 阶段 UI ---
        if (_phase === 'prepare') {
            var titleW = 200, titleH = 48;
            UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.06, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
            UI.drawTitle(ctx, '拜年姿势王', w/2, h*0.06 + titleH/2 + 2, 28, Draw.THEME.gold);
            _drawGuideCard(ctx, w * 0.14, h * 0.14, w * 0.72, [
                '空中示范：标准弯腰作揖',
                '双手合拢，低头，含胸前倾',
                '开始后他会落地散开，8 秒内拖回拜年姿势'
            ], Draw.THEME.cyan);
        } else if (_phase === 'playing') {
            // 倒计时
            var timerColor = _timer <= 3 ? Draw.THEME.red : Draw.THEME.gold;
            var titleW = 120, titleH = 60;
            UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.06, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
            UI.drawTitle(ctx, (_dropProgress < 1 ? '...' : Math.ceil(_timer) + 's'), w/2, h*0.06 + titleH/2 + 2, 36, timerColor);
            if (_dropProgress < 1) {
                _drawGuideCard(ctx, w * 0.18, h * 0.15, w * 0.64, [
                    '人物落地中...',
                    '等姿势散开后，立刻开摆'
                ], Draw.THEME.gold);
            } else {
                var hint = _selectedSeg ? ('正在调整：' + _selectedSeg.lbl) : '先扶正躯干，再把双手摆回胸前作揖';
                _drawGuideCard(ctx, w * 0.16, h * 0.14, w * 0.68, [
                    hint,
                    '拖动手臂、腿和头部，拼回标准拜年姿势'
                ], Draw.THEME.cyan);
            }
        } else if (_phase === 'result') {
            Draw.drawHalo(ctx, w/2, h*0.35, 140, Draw.THEME.gold, 0.18);
            ctx.save();
            ctx.translate(w/2, h*0.15);
            ctx.rotate(-0.08);
            var titleW = 260, titleH = 60;
            UI.drawRoundedRect(ctx, -titleW / 2, -titleH / 2, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
            UI.drawTitle(ctx, '新年快乐', 0, 2, 28, Draw.THEME.gold);
            ctx.fillStyle = '#fff2c1';
            ctx.font = '15px "PoxiaoPixel"';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#24113f';
            ctx.strokeText('大吉大利 · 岁岁平安', 0, 46);
            ctx.fillText('大吉大利 · 岁岁平安', 0, 46);
            ctx.restore();
        }

        UI.drawButtons(ctx);
    }

    /* ====== 保存图片 ====== */
    function _saveImage() {
        var ctx = Engine.getCtx();
        UI.clearButtons();
        render(ctx, W, H);
        try {
            var url = Engine.getCanvas().toDataURL('image/png');
            var a = document.createElement('a');
            a.href = url; a.download = '新年拜年.png';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch (e) { alert('保存失败，请截图保存吧~'); }
        _setupUI();
    }

    /* ====== 销毁 ====== */
    function destroy() {
        UI.clearButtons();
        var c = Engine.getCanvas();
        if (_touchStartH) { c.removeEventListener('touchstart',_touchStartH); c.removeEventListener('mousedown',_touchStartH); }
        if (_touchMoveH)  { c.removeEventListener('touchmove',_touchMoveH);  c.removeEventListener('mousemove',_touchMoveH);  }
        if (_touchEndH)   { c.removeEventListener('touchend',_touchEndH);    c.removeEventListener('mouseup',_touchEndH);    }
        _touchStartH = _touchMoveH = _touchEndH = null;
    }

    return { init: init, destroy: destroy };
})();
