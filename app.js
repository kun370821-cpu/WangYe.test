/* ============================================================
 * 家庭大字体电话本 —— 页面逻辑
 *
 * 联系人数据有两个来源：
 *   1. 在这台电脑上编辑过的（存在浏览器里，见 STORAGE_KEY）
 *   2. 没有编辑过，就用 data.js 里写的
 * 编辑完点「导出 data.js」，用它替换项目里的 data.js，再推送到 GitHub，
 * 长辈那边下次联网打开就是新的。
 * ============================================================ */

(function () {
  "use strict";

  var ALL = "全部";
  var STORAGE_KEY = "phonebook-contacts-v1";
  var PHOTO_MAX = 400;          // 照片最长边压缩到这个像素
  var PHOTO_QUALITY = 0.82;
  var EMOJI_CHOICES = ["👤", "👴", "👵", "👨", "👩", "👧", "👦", "🩺", "💊", "🏥", "🏢", "🔧", "📦", "🚚", "☎️", "❤️"];

  /* data.js 里的默认数据（编辑过以后就不用它了，但可以随时恢复） */
  var DEFAULT_CONTACTS = (typeof CONTACTS !== "undefined") ? CONTACTS.slice() : [];
  var GROUP_ORDER_DEFAULT = (typeof DEFAULT_GROUP_ORDER !== "undefined")
    ? DEFAULT_GROUP_ORDER
    : ["家人", "医生", "物业", "快递"];

  /* ---------------- 页面上的元素 ---------------- */

  var listEl = document.getElementById("list");
  var tabsEl = document.getElementById("tabs");
  var emptyEl = document.getElementById("empty");
  var sizeBtn = document.getElementById("size-toggle");
  var toastEl = document.getElementById("toast");

  var editBtn = document.getElementById("edit-toggle");
  var editBar = document.getElementById("edit-bar");
  var addBtn = document.getElementById("add-contact");
  var exportBtn = document.getElementById("export-data");
  var importBtn = document.getElementById("import-data");
  var importInput = document.getElementById("import-input");
  var resetBtn = document.getElementById("reset-data");

  var overlay = document.getElementById("form-overlay");
  var form = document.getElementById("contact-form");
  var formTitle = document.getElementById("form-title");
  var deleteBtn = document.getElementById("form-delete");
  var cancelBtn = document.getElementById("form-cancel");
  var photoPreview = document.getElementById("photo-preview");
  var pickPhotoBtn = document.getElementById("pick-photo");
  var clearPhotoBtn = document.getElementById("clear-photo");
  var photoInput = document.getElementById("photo-input");
  var emojiPicker = document.getElementById("emoji-picker");
  var groupOptions = document.getElementById("group-options");
  var fRelation = document.getElementById("f-relation");
  var fName = document.getElementById("f-name");
  var fPhone = document.getElementById("f-phone");
  var fGroup = document.getElementById("f-group");
  var fNote = document.getElementById("f-note");

  /* ---------------- 状态 ---------------- */

  var contacts = [];
  var currentGroup = ALL;
  var editing = false;
  var editingIndex = -1;      // -1 = 正在新增
  var formPhoto = "";
  var formEmoji = "👤";
  var toastTimer = null;

  /* 手机/平板点卡片直接拨号；电脑上点了会弹出"用哪个应用打开"，
   * 所以电脑上改成"点一下复制号码"。 */
  var isMobileDevice = (function () {
    var ua = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod|HarmonyOS|Windows Phone|Mobile/i.test(ua)) return true;
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
    return false;
  })();

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
    }, 2400);
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

  function copyNumber(phone, prefix) {
    var shown = formatPhone(phone);
    copyText(onlyDigits(phone)).then(function () {
      toast(prefix + shown);
    }).catch(function () {
      toast("复制不了，号码是：" + shown);
    });
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: "text/javascript;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------- 数据存取 ---------------- */

  function normalize(item) {
    return {
      group: String(item && item.group || "").trim() || "家人",
      relation: String(item && item.relation || "").trim(),
      name: String(item && item.name || "").trim(),
      phone: String(item && item.phone || "").trim(),
      emoji: String(item && item.emoji || "👤"),
      photo: String(item && item.photo || ""),
      note: String(item && item.note || "").trim()
    };
  }

  function loadContacts() {
    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      saved = null;
    }
    if (saved) {
      try {
        var arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr.map(normalize);
      } catch (err) {
        /* 数据坏了就退回默认数据 */
      }
    }
    return DEFAULT_CONTACTS.map(normalize);
  }

  function saveContacts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    } catch (err) {
      toast("保存失败：浏览器存储空间可能不够，照片少放几张试试");
    }
  }

  /* 改完直接写进 data.js。
   * 本地服务（serve.py）开着的时候这一步会成功，就不用再手动导出了；
   * 如果页面是部署在网上的（没有本地服务），会失败，那就用「导出 data.js」。 */
  function syncToFile() {
    if (!window.fetch) return;
    fetch("api/save-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: contacts })
    }).then(function (resp) {
      if (!resp.ok) throw new Error("save failed");
      return resp.json();
    }).then(function (result) {
      toast("已保存，并直接写进了 data.js（" + result.count + " 位联系人）");
    }).catch(function () {
      toast("已保存，但只存在这台电脑的浏览器里；要写进文件请点「导出 data.js」");
    });
  }

  function groupOrder() {
    var out = [];
    GROUP_ORDER_DEFAULT.forEach(function (g) {
      if (contacts.some(function (c) { return c.group === g; })) out.push(g);
    });
    contacts.forEach(function (c) {
      if (c.group && out.indexOf(c.group) === -1) out.push(c.group);
    });
    return out;
  }

  /* ---------------- 分类 ---------------- */

  function buildGroups() {
    return [ALL].concat(groupOrder());
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

  function fillGroupOptions() {
    groupOptions.innerHTML = "";
    groupOrder().forEach(function (g) {
      var opt = document.createElement("option");
      opt.value = g;
      groupOptions.appendChild(opt);
    });
    GROUP_ORDER_DEFAULT.forEach(function (g) {
      if (groupOrder().indexOf(g) === -1) {
        var opt = document.createElement("option");
        opt.value = g;
        groupOptions.appendChild(opt);
      }
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
      img.addEventListener("error", function () {
        img.remove();
        emoji.hidden = false;
      });
      emoji.hidden = true;
      avatar.appendChild(img);
    }

    return avatar;
  }

  function makeCard(item, index) {
    var wrap = document.createElement("div");
    wrap.className = "card-wrap";

    var card = document.createElement("a");
    card.className = "card";
    card.href = "tel:" + onlyDigits(item.phone);
    card.setAttribute(
      "aria-label",
      (isMobileDevice ? "给" + (item.relation || item.name || "联系人") + "打电话 " : "复制") + formatPhone(item.phone)
    );

    card.addEventListener("click", function (event) {
      if (editing) {
        // 编辑模式下点卡片不拨号也不复制，免得误触
        event.preventDefault();
        return;
      }
      if (!isMobileDevice) {
        // 电脑上没有电话功能，改成复制号码
        event.preventDefault();
        copyNumber(item.phone, "电脑上不能直接拨号，号码已复制：");
      }
    });

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
    hint.textContent = isMobileDevice ? "拨号" : "复制号码";
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
      copyNumber(item.phone, "号码已复制：");
    });
    wrap.appendChild(copyBtn);

    if (editing) {
      var actions = document.createElement("div");
      actions.className = "card-actions";

      var editOne = document.createElement("button");
      editOne.type = "button";
      editOne.textContent = "修改";
      editOne.addEventListener("click", function () { openForm(index); });
      actions.appendChild(editOne);

      var del = document.createElement("button");
      del.type = "button";
      del.className = "del";
      del.textContent = "删除";
      del.addEventListener("click", function () { removeContact(index); });
      actions.appendChild(del);

      wrap.appendChild(actions);
    }

    return wrap;
  }

  function renderList() {
    var items = contacts.filter(function (c) {
      return currentGroup === ALL || c.group === currentGroup;
    });

    listEl.innerHTML = "";
    items.forEach(function (item) {
      listEl.appendChild(makeCard(item, contacts.indexOf(item)));
    });
    emptyEl.hidden = items.length > 0;
  }

  /* ---------------- 编辑模式 ---------------- */

  function setEditMode(on) {
    editing = on;
    document.body.classList.toggle("editing", on);
    editBtn.setAttribute("aria-pressed", String(on));
    editBtn.textContent = on ? "完成" : "编辑";
    editBar.hidden = !on;
    renderList();
  }

  function renderEmojiPicker() {
    emojiPicker.innerHTML = "";
    EMOJI_CHOICES.forEach(function (e) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = e;
      b.setAttribute("aria-pressed", String(e === formEmoji));
      b.addEventListener("click", function () {
        formEmoji = e;
        renderEmojiPicker();
        updatePreview();
      });
      emojiPicker.appendChild(b);
    });
  }

  function updatePreview() {
    photoPreview.innerHTML = "";
    if (formPhoto) {
      var img = document.createElement("img");
      img.src = formPhoto;
      img.alt = "";
      photoPreview.appendChild(img);
    } else {
      photoPreview.textContent = formEmoji;
    }
  }

  function openForm(index) {
    editingIndex = (typeof index === "number") ? index : -1;
    var item = editingIndex >= 0 ? contacts[editingIndex] : null;

    formTitle.textContent = item ? "修改联系人" : "添加联系人";
    fRelation.value = item ? item.relation : "";
    fName.value = item ? item.name : "";
    fPhone.value = item ? item.phone : "";
    fGroup.value = item ? item.group : (currentGroup === ALL ? "" : currentGroup);
    fNote.value = item ? item.note : "";
    formPhoto = item ? item.photo : "";
    formEmoji = (item && item.emoji) ? item.emoji : "👤";
    deleteBtn.hidden = !item;

    fillGroupOptions();
    renderEmojiPicker();
    updatePreview();

    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    fRelation.focus();
  }

  function closeForm() {
    overlay.hidden = true;
    document.body.style.overflow = "";
    editingIndex = -1;
  }

  function removeContact(index) {
    var item = contacts[index];
    if (!item) return;
    var label = item.relation || item.name || "这位联系人";
    if (!window.confirm("确定要删除「" + label + "」吗？")) return;
    contacts.splice(index, 1);
    saveContacts();
    syncToFile();
    renderTabs();
    renderList();
    toast("已删除「" + label + "」");
  }

  /* 把照片压到 400 像素以内，再转成可以直接写进文件的图片数据 */
  function compressPhoto(file, done) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, PHOTO_MAX / Math.max(img.width, img.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";     // JPEG 没有透明，先铺一层白底
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
      };
      img.onerror = function () {
        toast("这张照片浏览器读不了，请换成 JPG 或 PNG 格式");
      };
      img.src = reader.result;
    };
    reader.onerror = function () {
      toast("读取照片失败，换一张试试");
    };
    reader.readAsDataURL(file);
  }

  /* ---------------- 导入 / 导出 ---------------- */

  function exportData() {
    var lines = [];
    lines.push("/* ============================================================");
    lines.push(" * 家庭大字体电话本 —— 联系人数据");
    lines.push(" * 由网页上的「编辑」功能导出，生成时间：" + new Date().toLocaleString("zh-CN"));
    lines.push(" *");
    lines.push(" * 用法：用这个文件替换项目里的 data.js，然后推送到 GitHub。");
    lines.push(" * 照片已经压缩并内嵌在里面，不需要额外的图片文件。");
    lines.push(" * 也可以直接在记事本里改文字，格式照着下面照抄即可。");
    lines.push(" * ============================================================ */");
    lines.push("");
    lines.push("const CONTACTS = [");
    contacts.forEach(function (c) {
      lines.push("  " + JSON.stringify(normalize(c)) + ",");
    });
    lines.push("];");
    lines.push("");
    lines.push("/* 分类在页面上的先后顺序 */");
    lines.push("const DEFAULT_GROUP_ORDER = " + JSON.stringify(groupOrder()) + ";");
    lines.push("");

    download("data.js", lines.join("\n"));
    toast("已导出 data.js，用它替换项目里的同名文件即可");
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var text = String(reader.result);
        var arr = null;
        if (/^\s*\[/.test(text)) {
          arr = JSON.parse(text);
        } else {
          // 读的是本项目导出的 data.js 格式
          var pick = new Function(text + "\nreturn (typeof CONTACTS !== 'undefined') ? CONTACTS : null;");
          arr = pick();
        }
        if (!Array.isArray(arr)) throw new Error("没有找到联系人数组");
        contacts = arr.map(normalize);
        saveContacts();
        syncToFile();
        currentGroup = ALL;
        renderTabs();
        renderList();
        toast("已导入 " + contacts.length + " 位联系人");
      } catch (err) {
        toast("这个文件读不出来，请选导出的 data.js");
      }
    };
    reader.onerror = function () {
      toast("读文件失败");
    };
    reader.readAsText(file);
  }

  function resetData() {
    if (!window.confirm("恢复到 data.js 里最初的联系人？你后来改的和加的照片都会没掉。")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      /* 忽略 */
    }
    contacts = DEFAULT_CONTACTS.map(normalize);
    saveContacts();
    syncToFile();
    currentGroup = ALL;
    renderTabs();
    renderList();
    toast("已恢复成 data.js 里的联系人");
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

  /* ---------------- 事件绑定 ---------------- */

  editBtn.addEventListener("click", function () {
    setEditMode(!editing);
  });

  addBtn.addEventListener("click", function () {
    openForm(-1);
  });

  exportBtn.addEventListener("click", exportData);
  resetBtn.addEventListener("click", resetData);

  importBtn.addEventListener("click", function () {
    importInput.click();
  });

  importInput.addEventListener("change", function () {
    var file = importInput.files && importInput.files[0];
    importInput.value = "";
    if (file) importData(file);
  });

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) closeForm();
  });

  cancelBtn.addEventListener("click", closeForm);

  deleteBtn.addEventListener("click", function () {
    if (editingIndex < 0) return;
    var index = editingIndex;
    closeForm();
    removeContact(index);
  });

  pickPhotoBtn.addEventListener("click", function () {
    photoInput.click();
  });

  photoInput.addEventListener("change", function () {
    var file = photoInput.files && photoInput.files[0];
    photoInput.value = "";
    if (!file) return;
    compressPhoto(file, function (dataUrl) {
      formPhoto = dataUrl;
      updatePreview();
      toast("照片已压缩好，点保存就生效");
    });
  });

  clearPhotoBtn.addEventListener("click", function () {
    formPhoto = "";
    updatePreview();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var relation = fRelation.value.trim();
    var name = fName.value.trim();
    var phone = fPhone.value.trim();
    var group = fGroup.value.trim() || "家人";
    var note = fNote.value.trim();

    if (!relation && !name) {
      toast("请先填一个称呼，比如「大女儿」");
      fRelation.focus();
      return;
    }
    if (onlyDigits(phone).length < 5) {
      toast("电话号码好像没填或太短了");
      fPhone.focus();
      return;
    }

    var item = normalize({
      group: group,
      relation: relation,
      name: name,
      phone: phone,
      emoji: formEmoji,
      photo: formPhoto,
      note: note
    });

    if (editingIndex >= 0) {
      contacts[editingIndex] = item;
      saveContacts();
      syncToFile();
      renderTabs();
      renderList();
      closeForm();
      toast("已保存修改");
    } else {
      contacts.push(item);
      saveContacts();
      syncToFile();
      currentGroup = ALL;      // 回到"全部"，保证能看到刚加的人
      renderTabs();
      renderList();
      closeForm();
      toast("已添加「" + (relation || name) + "」");
    }
  });

  /* ---------------- 启动 ---------------- */

  contacts = loadContacts();
  renderTabs();
  renderList();
  fillGroupOptions();
  initTextSize();
  initServiceWorker();
})();
