/* ============================================================
 * core.js —— 纯逻辑层（不依赖 DOM / localStorage）
 * 包含：配置常量、工具函数、表单校验、信息构造、搜索筛选、状态变更、统计
 * 同时支持浏览器（window.LF）与 Node（module.exports），因此可以直接被单元测试引用
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  root.LF = Object.assign(root.LF || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------------- 1. 配置 ---------------- */

  var CONFIG = {
    APP_NAME: '校园失物招领',
    ITEM_KEY: 'campus_lf_items_v1',
    HISTORY_KEY: 'campus_lf_history_v1',
    USER_KEY: 'campus_lf_user_v1',
    MAX_PHOTOS: 3,
    EXPIRE_DAYS: 30,
    TITLE_MAX: 30,
    DESC_MAX: 200,
    CONTACT_MAX: 40,
    CATEGORIES: [
      { key: 'card', label: '校园卡' },
      { key: 'key', label: '钥匙' },
      { key: 'bottle', label: '水杯' },
      { key: 'umbrella', label: '雨伞' },
      { key: 'earphone', label: '耳机' },
      { key: 'book', label: '书籍' },
      { key: 'cert', label: '证件钱包' },
      { key: 'other', label: '其他' }
    ],
    PLACES: ['教学楼', '图书馆', '食堂', '宿舍区', '体育馆', '运动场', '校医院', '其他'],
    TYPES: {
      lost: { key: 'lost', label: '寻物', doneLabel: '已找到', verb: '丢失' },
      found: { key: 'found', label: '招领', doneLabel: '已归还', verb: '拾获' }
    },
    STATUS: {
      active: { key: 'active', label: '进行中' },
      done: { key: 'done', label: '已完成' }
    }
  };

  /* ---------------- 2. 工具函数 ---------------- */

  var seq = 0;
  function uid(prefix) {
    seq += 1;
    return (prefix || 'item') + '_' + Date.now().toString(36) + '_' + seq.toString(36);
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** 去掉首尾空白；null / undefined 归一为空串 */
  function trim(value) {
    return value == null ? '' : String(value).replace(/^\s+|\s+$/g, '');
  }

  /** 搜索用的归一化：小写 + 去掉所有空白，便于「校园 卡」也能命中「校园卡」 */
  function normalize(value) {
    return trim(value).toLowerCase().replace(/\s+/g, '');
  }

  /** 转义 HTML，所有用户输入进 innerHTML 前都要过一遍，防止 XSS */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function categoryLabel(key) {
    var hit = CONFIG.CATEGORIES.filter(function (c) { return c.key === key; })[0];
    return hit ? hit.label : '其他';
  }

  function typeInfo(key) {
    return CONFIG.TYPES[key] || CONFIG.TYPES.lost;
  }

  function typeLabel(key) {
    return typeInfo(key).label;
  }

  /** 已完成时的文案：寻物叫「已找到」，招领叫「已归还」 */
  function doneLabel(key) {
    return typeInfo(key).doneLabel;
  }

  function statusLabel(item) {
    if (!item) return '';
    return item.status === 'done' ? doneLabel(item.type) : typeLabel(item.type);
  }

  function formatDate(ts) {
    var d = new Date(ts);
    return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /** 相对时间：刚刚 / n 分钟前 / 今天 09:20 / 昨天 18:40 / 10月8日 */
  function timeAgo(ts, now) {
    var n = typeof now === 'number' ? now : Date.now();
    var diff = n - ts;
    if (diff < 0) diff = 0;
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前';
    var d = new Date(ts);
    var today = new Date(n);
    if (d.toDateString() === today.toDateString()) {
      return '今天 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }
    var yest = new Date(n - 24 * 60 * 60 * 1000);
    if (d.toDateString() === yest.toDateString()) {
      return '昨天 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /** 信息是否已超过展示期（默认 30 天） */
  function isExpired(item, now, days) {
    var d = typeof days === 'number' ? days : CONFIG.EXPIRE_DAYS;
    var n = typeof now === 'number' ? now : Date.now();
    return n - item.createdAt > d * 24 * 60 * 60 * 1000;
  }

  /** 距离下架还剩几天，最少为 0 */
  function daysLeft(item, now, days) {
    var d = typeof days === 'number' ? days : CONFIG.EXPIRE_DAYS;
    var n = typeof now === 'number' ? now : Date.now();
    var left = d - Math.floor((n - item.createdAt) / (24 * 60 * 60 * 1000));
    return left > 0 ? left : 0;
  }

  /** 把关键词在文本中高亮（先转义再包 <mark>，避免 XSS） */
  function highlight(text, keyword) {
    var safe = escapeHtml(text);
    var kw = trim(keyword);
    if (!kw) return safe;
    var escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(escaped, 'gi'), function (m) {
      return '<mark>' + m + '</mark>';
    });
  }

  /* ---------------- 3. 表单校验 ---------------- */

  /**
   * 校验发布草稿，返回 { ok, errors }
   * errors 是数组，每项为 { field, message }，便于页面把错误定位到具体输入框
   */
  function validateDraft(draft) {
    var d = draft || {};
    var errors = [];

    if (!d.type || !CONFIG.TYPES[d.type]) {
      errors.push({ field: 'type', message: '请选择信息类型' });
    }

    var title = trim(d.title);
    if (!title) errors.push({ field: 'title', message: '请填写物品名称' });
    else if (title.length < 2) errors.push({ field: 'title', message: '物品名称至少 2 个字' });
    else if (title.length > CONFIG.TITLE_MAX) {
      errors.push({ field: 'title', message: '物品名称不能超过 ' + CONFIG.TITLE_MAX + ' 个字' });
    }

    if (!d.category) {
      errors.push({ field: 'category', message: '请选择物品类别' });
    } else {
      var valid = CONFIG.CATEGORIES.some(function (c) { return c.key === d.category; });
      if (!valid) errors.push({ field: 'category', message: '物品类别不在可选范围内' });
    }

    if (!trim(d.place)) errors.push({ field: 'place', message: '请填写地点' });

    var date = trim(d.date);
    if (!date) errors.push({ field: 'date', message: '请选择日期' });
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push({ field: 'date', message: '日期格式应为 YYYY-MM-DD' });
    }

    var contact = trim(d.contact);
    if (!contact) errors.push({ field: 'contact', message: '请填写联系方式' });
    else if (contact.length > CONFIG.CONTACT_MAX) {
      errors.push({ field: 'contact', message: '联系方式不能超过 ' + CONFIG.CONTACT_MAX + ' 个字符' });
    }

    if (trim(d.desc).length > CONFIG.DESC_MAX) {
      errors.push({ field: 'desc', message: '详细说明不能超过 ' + CONFIG.DESC_MAX + ' 个字' });
    }

    var photos = Array.isArray(d.photos) ? d.photos : [];
    if (photos.length > CONFIG.MAX_PHOTOS) {
      errors.push({ field: 'photos', message: '最多上传 ' + CONFIG.MAX_PHOTOS + ' 张照片' });
    }

    return { ok: errors.length === 0, errors: errors };
  }

  /* ---------------- 4. 构造信息 ---------------- */

  /**
   * 由校验通过的草稿生成一条完整信息
   * 校验不通过时返回 { ok:false, errors, item:null }，不抛异常，方便调用方统一处理
   */
  function createItem(draft, now) {
    var at = typeof now === 'number' ? now : Date.now();
    var checked = validateDraft(draft);
    if (!checked.ok) return { ok: false, errors: checked.errors, item: null };

    var d = draft;
    var item = {
      id: uid('item'),
      type: d.type,
      title: trim(d.title),
      category: d.category,
      place: trim(d.place),
      date: trim(d.date),
      desc: trim(d.desc),
      contact: trim(d.contact),
      photos: (Array.isArray(d.photos) ? d.photos : []).slice(0, CONFIG.MAX_PHOTOS),
      status: 'active',
      ownerId: d.ownerId || 'local-user',
      createdAt: at,
      updatedAt: at
    };
    return { ok: true, errors: [], item: item };
  }

  /* ---------------- 5. 搜索与筛选 ---------------- */

  /**
   * 统一入口：先按条件过滤，再排序
   * query = { keyword, type, category, place, status, sort }
   *   - type/category/place/status 传 'all' 或留空表示不过滤
   *   - sort: 'new'（默认，按发布时间倒序）| 'old'
   * 关键词会同时匹配：物品名称、详细说明、地点、类别名、类型名
   */
  function searchItems(items, query) {
    var q = query || {};
    var kw = normalize(q.keyword);
    var list = (items || []).filter(function (it) {
      if (!it) return false;
      if (q.type && q.type !== 'all' && it.type !== q.type) return false;
      if (q.category && q.category !== 'all' && it.category !== q.category) return false;
      if (q.place && q.place !== 'all' && it.place !== q.place) return false;
      if (q.status && q.status !== 'all' && it.status !== q.status) return false;
      if (kw) {
        var hay = normalize([
          it.title, it.desc, it.place, it.date,
          categoryLabel(it.category), typeLabel(it.type)
        ].join(' '));
        if (hay.indexOf(kw) === -1) return false;
      }
      return true;
    });

    return list.sort(function (a, b) {
      return q.sort === 'old' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
    });
  }

  /* ---------------- 6. 状态变更 ---------------- */

  /**
   * 把某条信息标记为 active / done
   * 返回 { ok, items }：ok 表示是否找到该条信息；items 是新数组（不修改入参，方便测试）
   */
  function setItemStatus(items, id, status, now) {
    if (status !== 'active' && status !== 'done') {
      throw new Error('非法状态：' + status);
    }
    var at = typeof now === 'number' ? now : Date.now();
    var found = false;
    var next = (items || []).map(function (it) {
      if (it.id !== id) return it;
      found = true;
      return Object.assign({}, it, { status: status, updatedAt: at });
    });
    return { ok: found, items: next };
  }

  function removeItem(items, id) {
    var before = (items || []).length;
    var next = (items || []).filter(function (it) { return it.id !== id; });
    return { ok: next.length < before, items: next };
  }

  /* ---------------- 7. 统计 ---------------- */

  function calcStats(items) {
    var list = items || [];
    var stats = { total: list.length, lost: 0, found: 0, active: 0, done: 0 };
    list.forEach(function (it) {
      if (it.type === 'lost') stats.lost += 1;
      if (it.type === 'found') stats.found += 1;
      if (it.status === 'done') stats.done += 1;
      else stats.active += 1;
    });
    return stats;
  }

  /* ---------------- 8. 示例数据 ---------------- */

  /** 搜不到时给用户的「换个说法」建议：先查同义词表，再用热词补齐 */
  var SUGGEST_MAP = [
    { keys: ['校园卡', '饭卡', '一卡通', '学生卡'], words: ['校园卡', '一卡通', '学生卡'] },
    { keys: ['耳机', '蓝牙耳机', '无线耳机', 'airpods'], words: ['耳机', '蓝牙耳机', '无线耳机'] },
    { keys: ['杯', '水杯', '保温杯', '杯子'], words: ['水杯', '保温杯'] },
    { keys: ['充电宝', '移动电源', '电源'], words: ['充电宝', '移动电源', '数据线'] },
    { keys: ['伞', '雨伞', '折叠伞'], words: ['雨伞', '折叠伞'] },
    { keys: ['钥匙', '门钥匙', '钥匙串'], words: ['钥匙', '钥匙串'] },
    { keys: ['书', '课本', '教材'], words: ['书籍', '课本'] },
    { keys: ['钱包', '证件', '身份证'], words: ['证件钱包', '身份证'] }
  ];
  var HOT_WORDS = ['校园卡', '无线耳机', '雨伞', '保温杯', '充电宝', '钥匙'];

  /**
   * 如果这个关键词已经能搜到结果，返回空数组（页面据此决定是否显示「换个说法」模块）
   * @returns {string[]} 建议词，已去掉与关键词完全相同的项
   */
  function suggestKeywords(keyword, items, limit) {
    var kw = normalize(keyword);
    var max = typeof limit === 'number' ? limit : 4;
    if (!kw) return [];
    if (items && searchItems(items, { keyword: kw }).length > 0) return [];

    var out = [];
    SUGGEST_MAP.forEach(function (group) {
      var hit = group.keys.some(function (k) { return kw.indexOf(normalize(k)) !== -1 || normalize(k).indexOf(kw) !== -1; });
      if (hit) out = out.concat(group.words);
    });
    out = out.concat(HOT_WORDS);

    var seen = {};
    return out.filter(function (w) {
      var n = normalize(w);
      if (!n || n === kw || seen[n]) return false;
      seen[n] = true;
      return true;
    }).slice(0, max);
  }

  /* ---------------- 9. 示例数据 ---------------- */

  var DAY = 24 * 60 * 60 * 1000;

  function createSeedItems(now) {
    var n = typeof now === 'number' ? now : Date.now();
    var base = [
      {
        type: 'found', title: '校园卡（李思远）', category: 'card', place: '教学楼',
        date: '2026-09-28', minutes: 45,
        desc: '在 A203 教室最后一排座位上捡到，卡面基本无磨损、姓名可见。已交到第三教学楼一层值班室，值班老师已登记。',
        contact: '微信 xiaoli_2023'
      },
      {
        type: 'lost', title: '黑色长柄雨伞', category: 'umbrella', place: '图书馆',
        date: '2026-09-27', minutes: 260,
        desc: '伞柄上缠了一圈灰色手绳，伞面内侧有一个小破洞。可能落在图书馆一楼大厅的伞架附近。',
        contact: '手机 13800001234'
      },
      {
        type: 'found', title: '钥匙串（挂蓝色挂坠）', category: 'key', place: '食堂',
        date: '2026-09-27', minutes: 900,
        desc: '共 4 把钥匙，挂了一个蓝色的小海豚挂坠，在二食堂一楼靠窗的位置捡到。',
        contact: 'QQ 100200300'
      },
      {
        type: 'lost', title: '白色蓝牙耳机', category: 'earphone', place: '教学楼',
        date: '2026-09-26', minutes: 1500,
        desc: '白色入耳式耳机，充电盒背面贴了一张蓝色贴纸，左耳机有轻微划痕。',
        contact: '微信 earphone_lost'
      },
      {
        type: 'found', title: '银色保温杯', category: 'bottle', place: '体育馆',
        date: '2026-09-20', minutes: 9000,
        desc: '杯身有磨砂质感，杯盖内侧刻了一个「夏」字。已当面归还给失主。',
        contact: '微信 cup_owner',
        status: 'done'
      }
    ];

    return base.map(function (raw, index) {
      return {
        id: 'seed_' + (index + 1),
        type: raw.type,
        title: raw.title,
        category: raw.category,
        place: raw.place,
        date: raw.date,
        desc: raw.desc,
        contact: raw.contact,
        photos: [],
        status: raw.status || 'active',
        ownerId: index % 2 === 0 ? 'local-user' : 'seed-user',
        createdAt: n - raw.minutes * 60 * 1000,
        updatedAt: n - raw.minutes * 60 * 1000
      };
    });
  }

  return {
    CONFIG: CONFIG,
    uid: uid,
    trim: trim,
    normalize: normalize,
    escapeHtml: escapeHtml,
    categoryLabel: categoryLabel,
    typeInfo: typeInfo,
    typeLabel: typeLabel,
    doneLabel: doneLabel,
    statusLabel: statusLabel,
    formatDate: formatDate,
    timeAgo: timeAgo,
    isExpired: isExpired,
    daysLeft: daysLeft,
    highlight: highlight,
    validateDraft: validateDraft,
    createItem: createItem,
    searchItems: searchItems,
    setItemStatus: setItemStatus,
    removeItem: removeItem,
    calcStats: calcStats,
    createSeedItems: createSeedItems,
    suggestKeywords: suggestKeywords,
    HOT_WORDS: HOT_WORDS
  };
});
