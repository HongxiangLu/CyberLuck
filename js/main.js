/**
 * main.js — 应用入口、场景管理、全局错误处理
 */
var App = (function () {
    'use strict';

    var _currentScene = null;
    var _scenes = {};

    /** 全局错误处理 */
    function _setupErrorHandler() {
        window.onerror = function (msg, url, line, col, err) {
            _showError('哎呀，出错了，请重启试试吧~\n(' + (msg || '未知错误') + ')');
            return true;
        };
        window.addEventListener('unhandledrejection', function (e) {
            _showError('哎呀，出错了，请重启试试吧~');
        });
    }

    function _showError(text) {
        try {
            var overlay = document.getElementById('errorOverlay');
            var msgEl = document.getElementById('errorMessage');
            if (overlay && msgEl) {
                msgEl.textContent = text;
                overlay.style.display = 'flex';
            }
        } catch (e) { /* 实在没辙了 */ }
    }

    /** 注册场景 */
    function _registerScenes() {
        _scenes = {
            home: HomeScene,
            worship: WorshipScene,
            woodenfish: WoodenFishScene,
            moonblocks: MoonBlocksScene,
            stickman: StickmanScene
        };
    }

    /** 切换场景 */
    function switchScene(name) {
        try {
            if (_currentScene && _currentScene.destroy) {
                _currentScene.destroy();
            }
            Device.clearAll();
            UI.clearButtons();
            _currentScene = _scenes[name];
            if (_currentScene && _currentScene.init) {
                _currentScene.init();
            }
        } catch (e) {
            _showError('哎呀，切换场景出错了，请重启试试吧~\n' + (e.stack || e.message));
        }
    }

    /** 启动 */
    function start() {
        try {
            _setupErrorHandler();
            Engine.init();
            UI.bindTouch(Engine.getCanvas());
            _registerScenes();
            switchScene('home');
        } catch (e) {
            _showError('哎呀，初始化出错了，请重启试试吧~');
        }
    }

    // 页面加载后启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    return {
        switchScene: switchScene
    };
})();
