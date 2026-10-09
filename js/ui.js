/* ============================================================
 * ui.js —— 浏览器端 UI 工具层
 * 负责：图标、页面外壳（顶栏 / 底部导航）、物品卡片、提示条、弹层、图片压缩
 * 只依赖 DOM 与 core.js，不含任何业务规则
 * ============================================================ */
(function (root) {
  'use strict';

  var LF = root.LF = root.LF || {};
  var core = LF;
  var esc = core.escapeHtml;

  /* ---------------- 图标（全部内联 SVG，不依赖任何图片文件） ---------------- */

  var PATHS = {
    home: '<path d="M4 10.6L12 4.2l8 6.4V19a1.4 1.4 0 01-1.4 1.4H15v-6H9v6H5.4A1.4 1.4 0 014 19z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    user: '<circle cx="12" cy="8.2" r="3.9"/><path d="M4.8 19.6a7.4 7.4 0 0114.4 0z"/>',
    search: '<circle cx="11" cy="11" r="6.6"/><path d="M16.2 16.2L20.5 20.5"/>',
    back: '<path d="M15 4.5L7.5 12l7.5 7.5"/>',
    more: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    location: '<path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 1.9"/>',
    check: '<path d="M5 12.6l4.6 4.6L19 7.4"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.6"/><path d="M5.5 15H5a1.5 1.5 0 01-1.5-1.5v-8A1.5 1.5 0 015 4h8A1.5 1.5 0 0114.5 5.5V6"/>',
    bell: '<path d="M6.5 10a5.5 5.5 0 1111 0v4l1.5 2.5H5L6.5 14z"/><path d="M10 19.5a2 2 0 004 0"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.6v5.2"/><circle cx="12" cy="16.4" r=".7" fill="currentColor" stroke="none"/>',
    trash: '<path d="M5 7h14M9.5 7V5.4A1.4 1.4 0 0110.9 4h2.2a1.4 1.4 0 011.4 1.4V7M7.5 7l.8 12a1.4 1.4 0 001.4 1.3h4.6a1.4 1.4 0 001.4-1.3L16.5 7"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><circle cx="8.6" cy="9.6" r="1.6"/><path d="M4 17.4l4.6-4.6L12 16l3.1-3.1 4.9 4.9"/>',
    empty: '<circle cx="11" cy="11" r="6.6"/><path d="M16.2 16.2L20.5 20.5"/>',
    /* 分类图标 */
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2.6"/><path d="M3 10h18M6.6 14.4h4"/>',
    key: '<circle cx="8.4" cy="8.4" r="3.6"/><path d="M11 11l7.4 7.4M15.6 15.6l1.8-1.8M17.4 17.4l1.6-1.6"/>',
    bottle: '<path d="M9.4 3.6h5.2v2.2H9.4z"/><path d="M8.4 6.6h7.2l-.7 2.4V19a1.4 1.4 0 01-1.4 1.4H10.5A1.4 1.4 0 019.1 19V9z"/>',
    umbrella: '<path d="M4 12a8 8 0 0116 0z"/><path d="M12 12v6.2a2 2 0 01-4 0"/>',
    earphone: '<path d="M5.5 14V11a6.5 6.5 0 0113 0v3"/><rect x="3.6" y="13.4" width="3.6" height="5.6" rx="1.6"/><rect x="16.8" y="13.4" width="3.6" height="5.6" rx="1.6"/>',
    book: '<path d="M4.5 5.2h6.2a2 2 0 012 2V19a1.6 1.6 0 00-1.6-1.6H4.5z"/><path d="M19.5 5.2h-6.2a2 2 0 00-2 2V19a1.6 1.6 0 011.6-1.6h6.6z"/>',
    cert: '<rect x="3" y="5" width="18" height="14" rx="2.6"/><circle cx="9" cy="11.4" r="2.2"/><path d="M5.6 16.4a3.6 3.6 0 016.8 0M14.6 10h4M14.6 13.4h4"/>',
    other: '<path d="M12 3.4l7.4 4.2v8.8L12 20.6 4.6 16.4V7.6z"/><path d="M4.6 7.6L12 11.8l7.4-4.2M12 11.8v8.8"/>'
  };

  function icon(name, size, cls) {
    var body = PATHS[name] || PATHS.other;
    var s = size || 20;
    return '<svg class="' + (cls || '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      body + '</svg>';
  }

  var CATEGORY_ICON = {
    card: 'card', key: 'key', bottle: 'bottle', umbrella: 'umbrella',
    earphone: 'earphone', book: 'book', cert: 'cert', other: 'other'
  };

  function categoryIcon(key, size) {
    return icon(CATEGORY_ICON[key] || 'other', size);
  }

  /* ---------------- 页面外壳：顶栏 + 底部导航 ---------------- */

  var TABS = [
    { key: 'home', label: '首页', href: 'index.html', icon: 'home' },
    { key: 'publish', label: '发布', href: 'publish.html', icon: 'plus' },
    { key: 'mine', label: '我的', href: 'mine.html', icon: 'user' }
  ];

  function mountShell(options) {
    var opt = options || {};

    var top = document.getElementById('topbar');
    if (top) {
      if (opt.title) {
        top.className = 'topbar';
        top.innerHTML =
          (opt.back
            ? '<button class="back" type="button" onclick="location.href=\'' + opt.back + '\'" aria-label="返回">' + icon('back', 22) + '</button>'
            : '') +
          '<span class="title">' + esc(opt.title) + '</span>' +
          '<span class="spacer"></span>' +
          (opt.actions || '');
      } else {
        top.className = '';
        top.innerHTML = '';
      }
    }

    var bar = document.getElementById('tabbar');
    if (bar) {
      if (!opt.tab) {
        bar.className = '';
        bar.innerHTML = '';
      } else {
        bar.className = 'tabbar';
        bar.innerHTML = TABS.map(function (t) {
          return '<a class="tab' + (t.key === opt.tab ? ' on' : '') + '" href="' + t.href + '">' +
            icon(t.icon, 22) + '<span>' + t.label + '</span></a>';
        }).join('');
      }
    }
  }

  /* ---------------- 物品卡片 ---------------- */

  /**
   * @param {Object} item
   * @param {Object} opts { keyword, showStatus }
   */
  function itemCard(item, opts) {
    var o = opts || {};
    var type = core.typeInfo(item.type);
    var done = item.status === 'done';
    var tagCls = done ? 'tag-done' : (item.type === 'lost' ? 'tag-lost' : 'tag-found');
    var tagText = done ? core.doneLabel(item.type) : type.label;
    var thumb = item.photos && item.photos[0]
      ? '<img src="' + item.photos[0] + '" alt="">'
      : categoryIcon(item.category, 26);
    var expired = core.isExpired(item) ? '<span>已过期</span>' : '';

    return '' +
      '<article class="item' + (done ? ' is-done' : '') + '" data-id="' + item.id + '" tabindex="0">' +
        '<div class="thumb t-' + item.type + '">' + thumb + '</div>' +
        '<div class="info">' +
          '<div class="line1">' +
            '<span class="title">' + core.highlight(item.title, o.keyword) + '</span>' +
            '<span class="tag ' + tagCls + '">' + tagText + '</span>' +
          '</div>' +
          '<p class="desc">' + esc(item.desc || '暂无补充说明') + '</p>' +
          '<div class="meta">' +
            '<span>' + icon('location', 12) + esc(item.place) + '</span>' +
            '<span>' + icon('clock', 12) + core.timeAgo(item.createdAt) + '</span>' +
            expired +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /** 给列表容器绑定「点击卡片跳详情」 */
  function bindItemList(container) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      var card = e.target.closest('.item');
      if (card) location.href = 'detail.html?id=' + encodeURIComponent(card.dataset.id);
    });
    container.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var card = e.target.closest('.item');
      if (card) location.href = 'detail.html?id=' + encodeURIComponent(card.dataset.id);
    });
  }

  /* ---------------- 提示与弹层 ---------------- */

  var toastTimer = null;
  function toast(message) {
    var el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1600);
  }

  function openSheet(html) {
    closeSheet();
    var mask = document.createElement('div');
    mask.className = 'mask';
    mask.innerHTML = '<div class="sheet">' + html + '</div>';
    mask.addEventListener('click', function (e) { if (e.target === mask) closeSheet(); });
    document.body.appendChild(mask);
    return mask;
  }

  function closeSheet() {
    var old = document.querySelector('.mask');
    if (old) old.remove();
  }

  /** 复制到剪贴板，兼容 file:// 打开的情况 */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext !== false) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) { reject(e); }
    });
  }

  /* ---------------- 图片：读入并压缩 ---------------- */

  /**
   * 把用户选择的图片读成 dataURL，并按最长边压缩
   * 目的：localStorage 只有约 5MB，原图直接存会写不进去
   */
  function readImage(file, maxSide) {
    var limit = maxSide || 720;
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('没有选择文件'));
      if (!/^image\//.test(file.type)) return reject(new Error('请选择图片文件'));

      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('图片读取失败')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('图片解析失败')); };
        img.onload = function () {
          var scale = Math.min(1, limit / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- URL 参数 ---------------- */

  function param(name, fallback) {
    var v = new URLSearchParams(location.search).get(name);
    return v == null ? (fallback === undefined ? '' : fallback) : v;
  }

  LF.UI = {
    icon: icon,
    categoryIcon: categoryIcon,
    CATEGORY_ICON: CATEGORY_ICON,
    mountShell: mountShell,
    itemCard: itemCard,
    bindItemList: bindItemList,
    toast: toast,
    openSheet: openSheet,
    closeSheet: closeSheet,
    copyText: copyText,
    readImage: readImage,
    param: param,
    escapeHtml: esc
  };
})(typeof window !== 'undefined' ? window : this);
