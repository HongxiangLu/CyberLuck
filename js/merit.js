/**
 * merit.js — 全局功德值、持久化、浮层显示与轻提示
 */
var MeritSystem = (function () {
    'use strict';

    var STORAGE_KEY = 'cyberluck_merit_points';
    var _points = 0;
    var _listeners = [];
    var _badgeEl = null;
    var _toastHostEl = null;
    var _initialized = false;

    function init() {
        if (_initialized) return;
        _initialized = true;
        _load();
        _ensureUI();
        _render();
    }

    function _load() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            var parsed = parseInt(raw || '0', 10);
            _points = isNaN(parsed) ? 0 : Math.max(0, parsed);
        } catch (e) {
            _points = 0;
        }
    }

    function _save() {
        try {
            localStorage.setItem(STORAGE_KEY, String(_points));
        } catch (e) {}
    }

    function _ensureUI() {
        if (!_badgeEl) {
            _badgeEl = document.getElementById('meritBadge');
        }
        if (!_toastHostEl) {
            _toastHostEl = document.getElementById('toastHost');
        }
    }

    function _render() {
        _ensureUI();
        if (_badgeEl) {
            _badgeEl.textContent = '🪙 功德: ' + _points;
        }
    }

    function _notify() {
        for (var i = 0; i < _listeners.length; i++) {
            _listeners[i](_points);
        }
    }

    function _setPoints(nextValue) {
        var next = parseInt(nextValue, 10);
        _points = isNaN(next) ? 0 : Math.max(0, next);
        _save();
        _render();
        _notify();
        return _points;
    }

    function getPoints() {
        return _points;
    }

    function canAfford(cost) {
        return _points >= Math.max(0, cost || 0);
    }

    function addPoints(amount) {
        var delta = Math.max(0, parseInt(amount, 10) || 0);
        return _setPoints(_points + delta);
    }

    function deductPoints(amount) {
        var delta = Math.max(0, parseInt(amount, 10) || 0);
        if (_points < delta) return false;
        _setPoints(_points - delta);
        return true;
    }

    function onChange(listener) {
        if (typeof listener !== 'function') {
            return function () {};
        }
        _listeners.push(listener);
        listener(_points);
        return function () {
            for (var i = _listeners.length - 1; i >= 0; i--) {
                if (_listeners[i] === listener) {
                    _listeners.splice(i, 1);
                    break;
                }
            }
        };
    }

    function showToast(text, type) {
        _ensureUI();
        if (!_toastHostEl) return;
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + (type || 'info');
        toast.textContent = text;
        _toastHostEl.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.add('is-visible');
        });

        window.setTimeout(function () {
            toast.classList.remove('is-visible');
            window.setTimeout(function () {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 220);
        }, 1800);
    }

    return {
        init: init,
        getPoints: getPoints,
        canAfford: canAfford,
        addPoints: addPoints,
        deductPoints: deductPoints,
        onChange: onChange,
        showToast: showToast
    };
})();
