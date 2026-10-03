/* ============================================================
 * 家庭大字体电话本 —— 页面逻辑
 * 一般不用改这个文件，改内容请打开 data.js
 * ============================================================ */

(function () {
  "use strict";

  var ALL = "全部";

  var listEl = document.getElementById("list");
  var tabsEl = document.getElementById("tabs");
  var emptyEl = document.getElementById("empty");
  var sizeBtn = document.getElementById("size-toggle");
  var toastEl = document.getElementById("toast");

  var currentGroup = ALL;
  var toastTimer = null;

  /* ---------------- 小工具 ---------------- */

  function onlyDigits(value) {
    return String(value == null ? "" : value).replace(/[^\d+*#,]/g, "");
  }

  // 13800000002 -> 138 0000 0002 ；075512345678 -> 0755 1234 5678
  function formatPhone(value) {
    var digits = onlyDigits(value);
    if (/^\d{11}$/.test(digits)) {
      return digits.slice(0, 3) + " " + digits.slice(3, 7) + " " + digits.slice(7);
    }
    if (/^0\d{10}$/.test(digits)) {
      return digits.slice(0, 3) + " " + digits.slice(3, 7) + " " + digits.slice(7, 11);
    }
    if (/^0\d{11}$/.test(digits)) {
      return digits.slice(0, 4) + " " + digits.slice(4, 8) + " " + digits.slice(8);
    }
    return digits;
  }

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.hidden = true;
    }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (err) {
        reject(err);
      }
    });
  }

  /* ---------------- 分类 ---------------- */

  function buildGroups() {
    var groups = [];
    var known = CONTACTS.map(function (c) { return c.group; });

    DEFAULT_GROUP_ORDER.forEach(function (g) {
      if (known.indexOf(g) !== -1) groups.push(g);
    });
    CONTACTS.forEach(function (c) {
      if (c.group && groups.indexOf(c.group) === -1) groups.push(c.group);
    });

    return [ALL].concat(groups);
  }

  function renderTabs() {
    tabsEl.innerHTML = "";
    buildGroups().forEach(function (group) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab";
      btn.textContent = group;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(group === currentGroup));
      btn.addEventListener("click", function () {
        currentGroup = group;
        renderTabs();
        renderList();
      });
      tabsEl.appendChild(btn);
    });
  }

  /* ---------------- 联系人卡片 ---------------- */

  function makeAvatar(item) {
    var avatar = document.createElement("div");
    avatar.className = "avatar";

    var emoji = document.createElement("span");
    emoji.textContent = item.emoji || "👤";
    avatar.appendChild(emoji);

    if (item.photo) {
      var img = document.createElement("img");
      img.src = item.photo;
      img.alt = "";
      img.loading = "lazy";
      // 照片打不开时，自动退回小图案，不会出现破图
      img.addEventListener("error", function () {
        img.remove();
        emoji.hidden = false;
      });
      emoji.hidden = true;
      avatar.appendChild(img);
    }

    return avatar;
  }

  function makeCard(item) {
    var wrap = document.createElement("div");
    wrap.className = "card-wrap";

    var card = document.createElement("a");
    card.className = "card";
    card.href = "tel:" + onlyDigits(item.phone);
    card.setAttribute("aria-label", "给" + (item.relation || item.name || "联系人") + "打电话 " + formatPhone(item.phone));

    card.appendChild(makeAvatar(item));

    var info = document.createElement("div");
    info.className = "info";

    var relation = document.createElement("div");
    relation.className = "relation";
    relation.textContent = item.relation || item.name || "联系人";
    info.appendChild(relation);

    if (item.name && item.relation) {
      var name = document.createElement("div");
      name.className = "name";
      name.textContent = item.name;
      info.appendChild(name);
    }

    var dialRow = document.createElement("div");
    dialRow.className = "dial-row";

    var phone = document.createElement("span");
    phone.className = "phone";
    phone.textContent = formatPhone(item.phone);
    dialRow.appendChild(phone);

    var hint = document.createElement("span");
    hint.className = "call-hint";
    hint.textContent = "拨号";
    dialRow.appendChild(hint);

    info.appendChild(dialRow);

    if (item.note) {
      var note = document.createElement("div");
      note.className = "note";
      note.textContent = item.note;
      info.appendChild(note);
    }

    card.appendChild(info);

    wrap.appendChild(card);

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "复制";
    copyBtn.title = "复制号码";
    copyBtn.addEventListener("click", function () {
      var number = onlyDigits(item.phone);
      copyText(number).then(function () {
        toast("号码已复制：" + formatPhone(item.phone));
      }).catch(function () {
        toast("复制失败，号码是：" + formatPhone(item.phone));
      });
    });
    wrap.appendChild(copyBtn);

    return wrap;
  }

  function renderList() {
    var items = CONTACTS.filter(function (c) {
      return currentGroup === ALL || c.group === currentGroup;
    });

    listEl.innerHTML = "";
    items.forEach(function (item) {
      listEl.appendChild(makeCard(item));
    });
    emptyEl.hidden = items.length > 0;
  }

  /* ---------------- 特大字号 ---------------- */

  function applyTextSize(huge) {
    document.body.classList.toggle("huge", huge);
    sizeBtn.setAttribute("aria-pressed", String(huge));
    sizeBtn.textContent = huge ? "普通字号" : "特大字号";
  }

  function initTextSize() {
    var saved = null;
    try {
      saved = localStorage.getItem("phonebook-huge");
    } catch (err) {
      saved = null;
    }
    applyTextSize(saved === "1");

    sizeBtn.addEventListener("click", function () {
      var next = !document.body.classList.contains("huge");
      applyTextSize(next);
      try {
        localStorage.setItem("phonebook-huge", next ? "1" : "0");
      } catch (err) {
        /* 隐私模式下存不了，忽略即可 */
      }
    });
  }

  /* ---------------- 离线缓存 ---------------- */

  function initServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {
        /* 注册失败不影响正常使用 */
      });
    });
  }

  /* ---------------- 启动 ---------------- */

  renderTabs();
  renderList();
  initTextSize();
  initServiceWorker();
})();
