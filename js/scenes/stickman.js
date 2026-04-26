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
    var _resultMeta = null;
    var _spriteLoadToken = 0;
    var _spritesReady = false;
    var _spriteSet = {
        head: null,
        torso: null,
        arm: null,
        armFlipped: null,
        leg: null,
        legFlipped: null,
        foot: null
    };
    var GLOBAL_SPRITE_SCALE = 0.26;
    var TORSO_WIDTH = 56;
    var SHOULDER_EDGE_TUNE = 7;
    var HIP_EDGE_TUNE = 9;
    var COLLAR_TUNE = 10;
    var ARM_REACH_RATIO = 0.84;
    var ARM_PIVOT_X_TUNE = -12;

    var _touchStartH = null, _touchMoveH = null, _touchEndH = null;

    function _loadStickmanSprites(done) {
        if (_spritesReady && _spriteSet.head && _spriteSet.torso && _spriteSet.arm && _spriteSet.armFlipped && _spriteSet.leg && _spriteSet.legFlipped && _spriteSet.foot) {
            done();
            return;
        }

        var token = ++_spriteLoadToken;
        var names = ['head', 'torso', 'arm', 'armFlipped', 'leg', 'legFlipped', 'foot'];
        var remaining = names.length;

        function finish() {
            if (token !== _spriteLoadToken) return;
            remaining--;
            if (remaining <= 0) {
                _spritesReady = true;
                done();
            }
        }

        for (var i = 0; i < names.length; i++) {
            (function (name) {
                var existing = _spriteSet[name];
                if (existing && existing.complete && existing.naturalWidth > 0) {
                    finish();
                    return;
                }

                var img = new Image();
                img.onload = finish;
                img.onerror = finish;
                var fileName = name === 'armFlipped' ? 'arm_flipped.png'
                    : name === 'legFlipped' ? 'leg_flipped.png'
                    : name + '.png';
                img.src = './images/stickman/' + fileName;
                _spriteSet[name] = img;
            })(names[i]);
        }
    }

    /* ====== 骨骼初始化 ====== */
    function _initSegments() {
        // 动态根据贴图实际缩放后的高度设置骨骼长度，彻底消除视觉与物理之间的缝隙
        var scale = _getSpriteGlobalScale();
        var torsoLen = (_spriteSet.torso && _spriteSet.torso.naturalHeight) ? (_spriteSet.torso.naturalHeight * scale * 1.02) : 96;
        var torsoW   = (_spriteSet.torso && _spriteSet.torso.naturalWidth)  ? (_spriteSet.torso.naturalWidth * scale * 1.02) : TORSO_WIDTH;
        // arm.png 是横向拆件，骨长必须按宽度估算，而不是高度。
        var armLen   = (_spriteSet.arm && _spriteSet.arm.naturalWidth)      ? (_spriteSet.arm.naturalWidth * scale * 0.92 * ARM_REACH_RATIO) : 98;
        var legLen   = (_spriteSet.leg && _spriteSet.leg.naturalHeight)     ? (_spriteSet.leg.naturalHeight * scale * 1.02) : 122;
        var headL    = 26;

        // angle: 绝对世界角 (0=正上方, PI/2=右, PI=下, -PI/2=左)
        _segments = [
            { id:'torso',  pid:null, angle:0.02, len:torsoLen, thick:14, color:'#c0392b', lbl:'躯干',
              fpx:W * 0.48, fpy:0, boxW: torsoW },
            { id:'head',   pid:'torso',  angle:0,    len:headL, thick:0,  color:'#FFDEAD', lbl:'头部',
              anchor:'neck', side:0, isHead:true },
            { id:'lArm',   pid:'torso',  angle:2.2, len:armLen, thick:8, color:'#c0392b', lbl:'左手',
              anchor:'shoulder', side:-1 },
            { id:'rArm',   pid:'torso',  angle:-2.2, len:armLen, thick:8, color:'#c0392b', lbl:'右手',
              anchor:'shoulder', side:1 },
            { id:'lLeg',   pid:'torso',  angle:Math.PI, len:legLen, thick:11, color:'#2F4F4F', lbl:'左脚',
              anchor:'hip', side:-1 },
            { id:'rLeg',   pid:'torso',  angle:Math.PI, len:legLen, thick:11, color:'#2F4F4F', lbl:'右脚',
              anchor:'hip', side:1 }
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
        // Root 改为躯干中心点，后续所有肢体都从这里推导锚点。
        _segments[0].fpy = H * 0.56;
        _computeFK();
    }

    function _buildBowPose() {
        return {
            torso: 0,
            head: 0,
            lArm: 2.42,
            rArm: -2.42,
            lLeg: Math.PI,
            rLeg: Math.PI
        };
    }

    function _buildLoosePose() {
        return {
            torso: 0.22,
            head: 0.28,
            lArm: -0.32,
            rArm: 0.32,
            lLeg: -Math.PI + 0.16,
            rLeg: Math.PI - 0.16
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
            x: W / 2,
            y: H * 0.56
        };
    }

    function _getGroundAnchor() {
        var torso = _segMap.torso;
        var leg = _segMap.lLeg || _segMap.rLeg;
        var torsoHalf = torso ? torso.len / 2 : 48;
        var legLen = leg ? leg.len : 122;
        return {
            x: W / 2,
            y: FLOOR_Y - torsoHalf - legLen + 6
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
        _resultMeta = null;
        _dropProgress = 0;
        _dropFromPose = _capturePose();
        _dropToPose = _buildLoosePose();
        _lastTime = performance.now();
        _setupUI();
    }

    /* ====== 前向运动学 ====== */
    function _getTorsoFrame(seg, centerX, centerY) {
        centerX = centerX == null ? seg.fpx : centerX;
        centerY = centerY == null ? seg.fpy : centerY;
        var dirX = Math.sin(seg.angle);
        var dirY = -Math.cos(seg.angle);
        var rightX = -dirY;
        var rightY = dirX;
        var halfLen = seg.len / 2;

        return {
            cx: centerX,
            cy: centerY,
            dirX: dirX,
            dirY: dirY,
            rightX: rightX,
            rightY: rightY,
            halfLen: halfLen,
            halfWidth: (seg.boxW || TORSO_WIDTH) / 2,
            topX: centerX + dirX * halfLen,
            topY: centerY + dirY * halfLen,
            bottomX: centerX - dirX * halfLen,
            bottomY: centerY - dirY * halfLen
        };
    }

    function _getTorsoAnchor(parent, child) {
        var frame = parent._frame || _getTorsoFrame(parent);
        var axial = 0;
        var lateral = 0;

        if (child.anchor === 'neck') {
            axial = frame.halfLen;
        } else if (child.anchor === 'shoulder') {
            axial = frame.halfLen - COLLAR_TUNE;
            lateral = frame.halfWidth - SHOULDER_EDGE_TUNE;
        } else if (child.anchor === 'hip') {
            axial = -frame.halfLen;
            lateral = frame.halfWidth - HIP_EDGE_TUNE;
        }

        return {
            x: frame.cx + frame.dirX * axial + frame.rightX * lateral * (child.side || 0),
            y: frame.cy + frame.dirY * axial + frame.rightY * lateral * (child.side || 0)
        };
    }

    function _computeFK() {
        var rootBob = 0;
        if (_phase === 'prepare' || _phase === 'result') {
            rootBob = Math.sin(_time * 4) * 3; // 待机时的轻微呼吸动效
        }

        for (var i = 0; i < _segments.length; i++) {
            var s = _segments[i];
            if (!s.pid) {
                // Root (躯干) 始终作为父子链的源头
                s._frame = _getTorsoFrame(s, s.fpx, s.fpy + rootBob);
                // 躯干的 px, py 定义为旋转轴心（颈部/顶部中点）
                s.px = s._frame.topX;
                s.py = s._frame.topY;
                // ex, ey 定义为末端（胯部/底部中点）
                s.ex = s._frame.bottomX;
                s.ey = s._frame.bottomY;
            } else {
                var p = _segMap[s.pid];
                var ax = 0;
                var ay = 0;

                if (p.id === 'torso') {
                    // 核心逻辑：子节点（手臂、腿、头）的起点必须锁死在躯干的特定锚点上
                    var torsoAnchor = _getTorsoAnchor(p, s);
                    ax = torsoAnchor.x;
                    ay = torsoAnchor.y;
                } else {
                    // 严格父子链：子节点起点 = 父节点终点
                    ax = p.ex;
                    ay = p.ey;
                }
                
                // 绝对坐标更新
                s.px = ax;
                s.py = ay;
                s.ex = s.px + s.len * Math.sin(s.angle);
                s.ey = s.py - s.len * Math.cos(s.angle);
            }
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
        _resultMeta = null;
        _dropProgress = 1;
        W = Engine.width();
        H = Engine.height();
        FLOOR_Y = H * 0.835;
        _spritesReady = false;

        _loadStickmanSprites(function () {
            _initSegments();
            _placePrepareFigure();
            _setupUI();
            _bindTouch();
            _lastTime = performance.now();
            Engine.startLoop(render);
        });
    }

    function _setupUI() {
        UI.clearButtons();
        if (_phase === 'prepare') {
            UI.createButton({ x:15,y:15,w:70,h:36, text:'返回',
                color:'rgba(255,255,255,0.7)', bgColor:'rgba(255,255,255,0.05)',
                borderColor:'rgba(255,255,255,0.15)', fontSize:13, radius:18,
                onClick:function(){ App.switchScene('home'); } });
            var bw = Math.min(W * 0.62, 232);
            UI.createButton({ x:(W-bw)/2, y:H*0.79, w:bw, h:52, text:'开始挑战',
                color:'#FFF7D6', bgColor:'rgba(255,79,184,0.28)',
                borderColor:'rgba(255,215,94,0.78)', fontSize:18, radius:26,
                onClick:_startChallenge });
        } else if (_phase === 'result') {
            var bw2 = Math.min(W*0.42,155);
            UI.createButton({ x:W/2-bw2-8, y:H*0.88, w:bw2, h:46, text:'重来',
                color:'#D9F9FF', bgColor:'rgba(0,240,255,0.12)',
                borderColor:'rgba(0,240,255,0.42)', fontSize:15, radius:23,
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
            var handles = _getDragHandles();
            var best = null, bestD = 34;
            for (var i = 0; i < handles.length; i++) {
                var h = handles[i];
                var d = _distToPoint(pos.x, pos.y, h.x, h.y);
                if (d < bestD) { bestD = d; best = h; }
            }
            if (best) {
                _selectedSeg = best.seg;
                _dragPivotX = best.seg.px;
                _dragPivotY = best.seg.py;
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

    function _getDragHandles() {
        var handles = [];
        var ids = ['lArm', 'rArm', 'lLeg', 'rLeg'];
        for (var i = 0; i < ids.length; i++) {
            var seg = _segMap[ids[i]];
            if (!seg) continue;
            handles.push({
                seg: seg,
                x: seg.ex,
                y: seg.ey
            });
        }
        return handles;
    }

    function _distToPoint(ax, ay, bx, by) {
        var dx = ax - bx;
        var dy = ay - by;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function _getNodeSnapshot() {
        var head = _segMap.head;
        var lArm = _segMap.lArm;
        var rArm = _segMap.rArm;
        var lLeg = _segMap.lLeg;
        var rLeg = _segMap.rLeg;
        var torso = _segMap.torso;
        var pelvisX = torso ? torso.ex : W * 0.5;
        var pelvisY = torso ? torso.ey : H * 0.6;

        return {
            head: head ? { x: (head.px + head.ex) / 2, y: (head.py + head.ey) / 2 } : null,
            leftHand: lArm ? { x: lArm.ex, y: lArm.ey } : null,
            rightHand: rArm ? { x: rArm.ex, y: rArm.ey } : null,
            leftFoot: lLeg ? { x: lLeg.ex, y: lLeg.ey } : null,
            rightFoot: rLeg ? { x: rLeg.ex, y: rLeg.ey } : null,
            pelvis: { x: pelvisX, y: pelvisY },
            torso: torso ? { x: torso.px, y: torso.py, ex: torso.ex, ey: torso.ey } : null
        };
    }

    function _evaluatePoseResult() {
        var nodes = _getNodeSnapshot();
        var head = nodes.head || { x: W * 0.5, y: H * 0.3 };
        var leftHand = nodes.leftHand || { x: W * 0.45, y: H * 0.45 };
        var rightHand = nodes.rightHand || { x: W * 0.55, y: H * 0.45 };
        var pelvis = nodes.pelvis || { x: W * 0.5, y: H * 0.55 };
        var handJoinThreshold = Math.max(40, W * 0.075);
        var handDistance = Math.sqrt(
            Math.pow(leftHand.x - rightHand.x, 2) +
            Math.pow(leftHand.y - rightHand.y, 2)
        );
        var upperBound = Math.min(head.y, pelvis.y);
        var lowerBound = Math.max(head.y, pelvis.y);
        var handsBetweenHeadAndPelvis =
            leftHand.y > upperBound && leftHand.y < lowerBound &&
            rightHand.y > upperBound && rightHand.y < lowerBound;
        var handsAboveHead = leftHand.y < head.y && rightHand.y < head.y;
        var handsCrossed = leftHand.x > rightHand.x;

        if (handDistance < handJoinThreshold && handsBetweenHeadAndPelvis) {
            return {
                key: 'greeting',
                tag: '拱手贺禧，财源广进',
                quote: '姿势标准，诚意满满，今年必定大发！',
                nodes: nodes
            };
        }

        if (handsAboveHead) {
            return {
                key: 'celebrate',
                tag: '高举双手，拥抱财富',
                quote: '元气满满迎财神，新的一年势不可挡！',
                nodes: nodes
            };
        }

        if (handsCrossed) {
            return {
                key: 'crossed',
                tag: '左右互搏，骨骼惊奇',
                quote: '拜年拜出武林宗师风范，主打一个出其不意。',
                nodes: nodes
            };
        }

        return {
            key: 'loose',
            tag: '随性瘫痪，躺平过年',
            quote: '四肢虽然不受控，但松弛感绝对拿捏了。',
            nodes: nodes
        };
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

    function _getSpriteGlobalScale() {
        return GLOBAL_SPRITE_SCALE;
    }

    function _drawFixedHingeSprite(ctx, img, x1, y1, x2, y2, opts) {
        if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
        opts = opts || {};
        var dx = x2 - x1;
        var dy = y2 - y1;
        var angle = Math.atan2(dy, dx) + (opts.rotationOffset || 0);
        var scale = _getSpriteGlobalScale() * (opts.scaleMul == null ? 1 : opts.scaleMul);
        var drawWidth = img.naturalWidth * scale;
        var drawHeight = img.naturalHeight * scale;

        var drawX = -drawWidth / 2 + (opts.offsetX || 0) * scale;
        var drawY = (opts.offsetY || 0) * scale;

        if (opts.anchorMode === 'left') {
            // 横向拆件（手臂）以左边缘中点作为关节铰链。
            drawX = (opts.offsetX || 0) * scale;
            drawY = -drawHeight / 2 + (opts.offsetY || 0) * scale;
        } else {
            // 纵向拆件（躯干、腿）以顶部中点作为关节铰链。
            drawX = -drawWidth / 2 + (opts.offsetX || 0) * scale;
            drawY = (opts.offsetY || 0) * scale;
        }

        ctx.save();
        ctx.translate(x1, y1);
        ctx.rotate(angle);
        if (opts.flipX || opts.flipY) {
            ctx.scale(opts.flipX ? -1 : 1, opts.flipY ? -1 : 1);
        }
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
    }

    function _drawHeadSprite(ctx, seg) {
        var img = _spriteSet.head;
        if (!seg || !img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
        var scale = _getSpriteGlobalScale() * 0.94;
        var dw = img.naturalWidth * scale;
        var dh = img.naturalHeight * scale;
        // 头部锚点锁定在脖子旋转轴心（seg.px, seg.py）
        var cx = seg.px;
        var cy = seg.py; 
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(seg.angle);
        // 将头部的下边缘（约 85% 高度处）对准脖子
        ctx.drawImage(img, -dw / 2, -dh * 0.85, dw, dh);
        ctx.restore();
    }

    function _drawFootSprite(ctx, x, y, flip) {
        var img = _spriteSet.foot;
        if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
        var scale = _getSpriteGlobalScale() * 0.82;
        var w = img.naturalWidth * scale;
        var h = img.naturalHeight * scale;
        ctx.save();
        ctx.translate(x, y);
        if (flip) ctx.scale(-1, 1);
        // 脚部锚点锁定在脚踝位置（贴图顶部）
        ctx.drawImage(img, -w / 2, 0, w, h);
        ctx.restore();
    }

    function _drawJointPatch(ctx, x, y, radius, color) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color || '#2d1d26';
        ctx.fill();
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

    function _drawDataStream(ctx, x, y, h, colorA, colorB) {
        ctx.save();
        for (var i = 0; i < h; i += 10) {
            ctx.fillStyle = (i / 10) % 2 === 0 ? colorA : colorB;
            ctx.fillRect(x, y + i, 4, 6);
        }
        ctx.restore();
    }

    function _drawTempleBeacon(ctx, x, y, scale) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#150a26';
        ctx.fillRect(-14 * s, -56 * s, 28 * s, 80 * s);
        ctx.fillStyle = '#2a184d';
        ctx.fillRect(-10 * s, -52 * s, 20 * s, 72 * s);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-6 * s, -46 * s, 12 * s, 48 * s);
        ctx.fillStyle = '#ff4fb8';
        ctx.fillRect(-6 * s, 6 * s, 12 * s, 8 * s);
        ctx.fillStyle = '#ffd75e';
        ctx.fillRect(-16 * s, 20 * s, 32 * s, 8 * s);
        ctx.restore();
    }

    function _drawCurtain(ctx, x, y, w, h, side) {
        ctx.save();
        ctx.fillStyle = '#4b0f2f';
        ctx.fillRect(x, y, w, h);
        for (var i = 0; i < w; i += 12) {
            ctx.fillStyle = i % 24 === 0 ? '#8e1d49' : '#6a1538';
            ctx.fillRect(x + i, y, 8, h);
        }
        ctx.fillStyle = '#ffd75e';
        ctx.fillRect(x, y + 14, w, 4);
        ctx.fillRect(x, y + h - 10, w, 4);
        ctx.fillStyle = '#ff4fb8';
        if (side === 'left') {
            ctx.fillRect(x + w - 8, y, 8, h);
        } else {
            ctx.fillRect(x, y, 8, h);
        }
        ctx.restore();
    }

    function _drawStageSpotlight(ctx, cx, topY, bottomY, width, color) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx - 18, topY);
        ctx.lineTo(cx + 18, topY);
        ctx.lineTo(cx + width, bottomY);
        ctx.lineTo(cx - width, bottomY);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }

    function _drawCyberTempleBackdrop(ctx, w, h) {
        var stageX = w * 0.08;
        var stageY = h * 0.08;
        var stageW = w * 0.84;
        var stageH = h * 0.76;
        var screenX = w * 0.17;
        var screenY = h * 0.29;
        var screenW = w * 0.66;
        var screenH = h * 0.38;
        var altarY = stageY + stageH * 0.78;

        ctx.fillStyle = '#130a28';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1c103b';
        ctx.fillRect(0, 0, w, FLOOR_Y);

        _drawStageSpotlight(ctx, w * 0.28, stageY + 4, screenY + screenH * 0.9, 84, 'rgba(0,240,255,0.15)');
        _drawStageSpotlight(ctx, w * 0.72, stageY + 4, screenY + screenH * 0.9, 84, 'rgba(255,79,184,0.14)');

        _drawCurtain(ctx, 0, stageY + 18, 46, stageH - 40, 'left');
        _drawCurtain(ctx, w - 46, stageY + 18, 46, stageH - 40, 'right');

        ctx.fillStyle = '#6a1538';
        ctx.fillRect(stageX + 26, stageY, stageW - 52, 26);
        ctx.fillStyle = '#8f224d';
        for (var vx = stageX + 34; vx < stageX + stageW - 34; vx += 18) {
            ctx.fillRect(vx, stageY + 4, 10, 18);
        }
        ctx.fillStyle = '#ffd75e';
        ctx.fillRect(stageX + 22, stageY + 20, stageW - 44, 4);

        Draw.drawFrame(ctx, w, h);
        Draw.drawPanel(ctx, stageX, stageY + 28, stageW, stageH - 28, '#171032', '#00f0ff', '#ff4fb8', '#0a0615');
        Draw.drawPanel(ctx, screenX, screenY, screenW, screenH, '#160c2c', '#ffd75e', '#ff4fb8', '#0a0615');

        ctx.fillStyle = '#25134a';
        ctx.fillRect(screenX + 12, screenY + 12, screenW - 24, screenH - 24);
        ctx.fillStyle = 'rgba(0,240,255,0.1)';
        for (var gy = screenY + 24; gy < screenY + screenH - 18; gy += 18) {
            ctx.fillRect(screenX + 18, gy, screenW - 36, 2);
        }

        ctx.fillStyle = '#12091f';
        ctx.fillRect(w / 2 - 96, screenY + 26, 192, 30);
        ctx.fillStyle = '#ff4fb8';
        ctx.fillRect(w / 2 - 90, screenY + 32, 180, 18);
        ctx.fillStyle = '#ffd75e';
        ctx.fillRect(w / 2 - 48, screenY + 22, 96, 4);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(w / 2 - 8, screenY + 32, 16, 18);

        _drawTempleBeacon(ctx, screenX + 30, altarY - 28, 1);
        _drawTempleBeacon(ctx, screenX + screenW - 30, altarY - 28, 1);
        _drawDataStream(ctx, screenX + 28, screenY + 10, 86, '#00f0ff', '#ff4fb8');
        _drawDataStream(ctx, screenX + screenW - 32, screenY + 10, 86, '#ff4fb8', '#00f0ff');

        ctx.fillStyle = '#12091f';
        ctx.fillRect(w / 2 - 126, altarY + 2, 252, 36);
        ctx.fillStyle = '#3d225f';
        ctx.fillRect(w / 2 - 108, altarY + 10, 216, 18);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(w / 2 - 102, altarY + 10, 204, 4);
        ctx.fillStyle = '#ff4fb8';
        ctx.fillRect(w / 2 - 88, altarY + 22, 176, 4);

        ctx.fillStyle = 'rgba(255,215,94,0.16)';
        ctx.fillRect(w / 2 - 152, screenY + 102, 22, 22);
        ctx.fillRect(w / 2 + 130, screenY + 122, 18, 18);
        ctx.fillStyle = 'rgba(0,240,255,0.15)';
        ctx.fillRect(w / 2 - 142, screenY + 138, 16, 16);
        ctx.fillRect(w / 2 + 116, screenY + 84, 20, 20);
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

    function _wrapPosterText(ctx, text, maxWidth) {
        var chars = String(text || '').split('');
        var lines = [];
        var current = '';
        for (var i = 0; i < chars.length; i++) {
            var next = current + chars[i];
            if (current && ctx.measureText(next).width > maxWidth) {
                lines.push(current);
                current = chars[i];
            } else {
                current = next;
            }
        }
        if (current) lines.push(current);
        return lines;
    }

    function _drawNeonText(ctx, text, x, y, size, fill, glow) {
        ctx.save();
        ctx.font = size + 'px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.shadowColor = glow || fill || '#00f0ff';
        ctx.shadowBlur = Math.max(8, Math.round(size * 0.45));
        ctx.lineWidth = Math.max(3, Math.round(size * 0.18));
        ctx.strokeStyle = '#170b2d';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = fill || '#fff2c1';
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    function _drawResultPosterText(ctx, w, h) {
        var meta = _resultMeta || _evaluatePoseResult();
        var tag = meta.tag;
        var quote = meta.quote;
        var cardW = Math.min(w * 0.72, 320);
        var cardX = w / 2 - cardW / 2;
        var cardY = h * 0.12;

        Draw.drawPanel(ctx, cardX, cardY, cardW, 118, 'rgba(35,18,68,0.92)', Draw.THEME.gold, Draw.THEME.pink, Draw.THEME.ink);
        _drawNeonText(ctx, tag, w / 2, cardY + 28, 18, '#ffea7a', '#ff58b3');

        ctx.save();
        ctx.font = '14px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        var lines = _wrapPosterText(ctx, quote, cardW - 28);
        for (var i = 0; i < lines.length; i++) {
            ctx.strokeStyle = '#170b2d';
            ctx.strokeText(lines[i], w / 2, cardY + 58 + i * 20);
            ctx.fillStyle = '#7cf7ff';
            ctx.fillText(lines[i], w / 2, cardY + 58 + i * 20);
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
        var torso = _segMap.torso;
        var head = _segMap.head;
        var lLeg = _segMap.lLeg;
        var rLeg = _segMap.rLeg;

        // 严格执行 Painter's Algorithm 遮挡顺序
        // 1. 第一步：绘制双腿和双脚（底层）
        var legIds = ['lLeg', 'rLeg'];
        var legConfig = {
            lLeg: { image: 'legFlipped', start: 'pivot', end: 'end', rotationOffset: -Math.PI / 2, offsetY: 0, scaleMul: 1.02 },
            rLeg: { image: 'leg', start: 'pivot', end: 'end', rotationOffset: -Math.PI / 2, offsetY: 0, scaleMul: 1.02 }
        };

        for (var i = 0; i < legIds.length; i++) {
            var s = _segMap[legIds[i]];
            if (!s) continue;
            if (s === _selectedSeg) _drawSelectionGlow(ctx, s);
            var cfg = legConfig[s.id];
            var img = _spriteSet[cfg.image];
            _drawFixedHingeSprite(ctx, img, s.px, s.py, s.ex, s.ey, cfg);
            // 立即绘制对应的脚，确保脚在腿端点上
            _drawFootSprite(ctx, s.ex, s.ey, s.id === 'lLeg');
        }

        // 2. 第二步：绘制躯干和头部（中层，遮挡大腿根部）
        if (torso) {
            if (torso === _selectedSeg) _drawSelectionGlow(ctx, torso);
            // 将 start 改为 'pivot'，end 改为 'end'，使其从脖子(px)画到胯部(ex)
            var tCfg = { image: 'torso', start: 'pivot', end: 'end', rotationOffset: -Math.PI / 2, offsetY: 0, scaleMul: 1.02 };
            var tImg = _spriteSet.torso;
            _drawFixedHingeSprite(ctx, tImg, torso.px, torso.py, torso.ex, torso.ey, tCfg);
        }
        if (head) {
            if (head === _selectedSeg) _drawSelectionGlow(ctx, head);
            _drawHeadSprite(ctx, head);
        }

        // 3. 第三步：绘制双臂（顶层，遮挡胸口）
        var armIds = ['lArm', 'rArm'];
        var armConfig = {
            // arm.png 是横向素材，关节在左边缘中点，不能再按纵向肢体处理。
            lArm: { image: 'armFlipped', start: 'pivot', end: 'end', rotationOffset: 0, anchorMode: 'left', offsetX: ARM_PIVOT_X_TUNE, offsetY: 0, scaleMul: 0.92 },
            rArm: { image: 'arm', start: 'pivot', end: 'end', rotationOffset: 0, anchorMode: 'left', offsetX: ARM_PIVOT_X_TUNE, offsetY: 0, scaleMul: 0.92 }
        };

        for (var j = 0; j < armIds.length; j++) {
            var s = _segMap[armIds[j]];
            if (!s) continue;
            if (s === _selectedSeg) _drawSelectionGlow(ctx, s);
            var cfg = armConfig[s.id];
            var img = _spriteSet[cfg.image];
            _drawFixedHingeSprite(ctx, img, s.px, s.py, s.ex, s.ey, cfg);
        }
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
                    _resultMeta = _evaluatePoseResult();
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
        _drawCyberTempleBackdrop(ctx, w, h);

        // 地面
        ctx.fillStyle = '#6f153d';
        ctx.fillRect(0, FLOOR_Y, w, h - FLOOR_Y);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(0, FLOOR_Y, w, 6);
        ctx.fillStyle = '#ff4fb8';
        for (var gx = 0; gx < w; gx += 28) {
            ctx.fillRect(gx, FLOOR_Y + 18, 12, 3);
        }
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
                '目标姿势：正面拱手拜年',
                '左右双手拉到胸前，完成合拢定格',
                '将左右双手拉拽至胸前合拢，8 秒内完成定格'
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
                var hint = _selectedSeg ? ('正在调整：' + _selectedSeg.lbl) : '把左右双手拉回胸前，拼出正面拱手拜年';
                _drawGuideCard(ctx, w * 0.16, h * 0.14, w * 0.68, [
                    hint,
                    '只可拖拽手和脚端点，整条肢体会绕肩膀/胯部旋转'
                ], Draw.THEME.cyan);
            }
        } else if (_phase === 'result') {
            Draw.drawHalo(ctx, w/2, h*0.35, 140, Draw.THEME.gold, 0.18);
            _drawResultPosterText(ctx, w, h);
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
            var fileName = ((_resultMeta && _resultMeta.key) || 'new-year') + '-poster.png';
            a.href = url; a.download = fileName;
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
