/* ============================================================
 * repo.js —— 数据仓库层
 * 负责：把 core.js 的纯函数与「存储介质」连接起来
 *   - 浏览器：localStorage
 *   - Node 单元测试：不传 storage，自动退化为内存存储
 * ============================================================ */
(function (root) {
  'use strict';

  var LF = root.LF = root.LF || {};
  var core = (typeof module !== 'undefined' && module.exports)
    ? require('./core.js')
    : LF;

  /**
   * @param {Object} options
   *   storage  —— 具备 getItem/setItem 的对象，传 null 表示只用内存
   *   key      —— localStorage 的键名
   *   seed     —— 首次打开时写入的示例数据
   */
  function createRepo(options) {
    var opt = options || {};
    var storage = opt.storage || null;
    var key = opt.key || core.CONFIG.ITEM_KEY;
    var seed = opt.seed || null;

    var items = [];
    var loaded = false;

    function readStore() {
      if (!storage) return null;
      try {
        var raw = storage.getItem(key);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
      } catch (e) {
        return null; // 存储被禁用或数据损坏时，退化为内存模式
      }
    }

    function writeStore() {
      if (!storage) return false;
      try {
        storage.setItem(key, JSON.stringify(items));
        return true;
      } catch (e) {
        return false; // 例如超出配额，此时数据仍保留在内存里
      }
    }

    function load(seedList) {
      var fromStore = readStore();
      if (fromStore) {
        items = fromStore;
      } else {
        items = (seedList || seed || (core.createSeedItems ? core.createSeedItems() : [])).slice();
        writeStore();
      }
      loaded = true;
      return items;
    }

    function ensure() {
      if (!loaded) load();
    }

    return {
      /** 首次读取数据（页面初始化时调用） */
      load: load,
      /** 手动把当前数据写回存储 */
      save: writeStore,

      all: function () { ensure(); return items.slice(); },

      find: function (id) {
        ensure();
        for (var i = 0; i < items.length; i++) {
          if (items[i].id === id) return items[i];
        }
        return null;
      },

      /** 新增：校验失败时原样返回 { ok:false, errors }，不写库 */
      add: function (draft, now) {
        ensure();
        var result = core.createItem(draft, now);
        if (result.ok) {
          items = [result.item].concat(items);
          writeStore();
        }
        return result;
      },

      /** 标记状态：active（进行中）/ done（已找到、已归还） */
      setStatus: function (id, status, now) {
        ensure();
        var result = core.setItemStatus(items, id, status, now);
        if (result.ok) {
          items = result.items;
          writeStore();
        }
        return result;
      },

      remove: function (id) {
        ensure();
        var result = core.removeItem(items, id);
        if (result.ok) {
          items = result.items;
          writeStore();
        }
        return result.ok;
      },

      search: function (query) { ensure(); return core.searchItems(items, query); },

      stats: function () { ensure(); return core.calcStats(items); },

      size: function () { ensure(); return items.length; },

      /** 用指定数据整体替换（测试或「清空重来」时使用） */
      reset: function (list) {
        items = (list || []).slice();
        loaded = true;
        writeStore();
        return items;
      }
    };
  }

  /** 浏览器端：包一层 try/catch，某些环境下 localStorage 会直接抛错 */
  function browserStorage() {
    try {
      var t = '__lf_test__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return window.localStorage;
    } catch (e) {
      return null;
    }
  }

  LF.createRepo = createRepo;
  LF.browserStorage = browserStorage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createRepo: createRepo };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
