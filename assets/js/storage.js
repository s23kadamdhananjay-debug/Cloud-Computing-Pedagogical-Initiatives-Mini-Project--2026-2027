/* CloudBox — Cloud Storage dashboard logic */
(function () {
  "use strict";

  var MAX_BYTES = 100 * 1024 * 1024;
  var STORAGE_KEY = "cloudbox.files.v1";

  var state = { files: [] };

  var el = {
    fileInput: document.getElementById("fileInput"),
    uploadBtn: document.getElementById("uploadBtn"),
    browseBtn: document.getElementById("browseBtn"),
    dropzone: document.getElementById("dropzone"),
    fileList: document.getElementById("fileList"),
    emptyState: document.getElementById("emptyState"),
    searchInput: document.getElementById("searchInput"),
    clearAll: document.getElementById("clearAll"),
    resetBtn: document.getElementById("resetBtn"),
    statFiles: document.getElementById("statFiles"),
    statUsed: document.getElementById("statUsed"),
    statFree: document.getElementById("statFree"),
    storagePct: document.getElementById("storagePct"),
    storageBar: document.getElementById("storageBar"),
    storageProgress: document.getElementById("storageProgress"),
    legendUsed: document.getElementById("legendUsed"),
    legendFree: document.getElementById("legendFree"),
    filesCount: document.getElementById("filesCount"),
    sideUsed: document.getElementById("sideUsed"),
    sideFree: document.getElementById("sideFree"),
    sideBar: document.getElementById("sideBar"),
    toastStack: document.getElementById("toastStack")
  };

  /* ----------------------------- helpers ----------------------------- */

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    var kb = bytes / 1024;
    if (kb < 1024) {
      return (kb < 10 ? kb.toFixed(1) : Math.round(kb)) + " KB";
    }
    var mb = kb / 1024;
    return mb.toFixed(mb < 10 ? 1 : 0) + " MB";
  }

  function usedBytes() {
    return state.files.reduce(function (sum, file) { return sum + file.size; }, 0);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.files));
    } catch (error) {
      /* Storage can be unavailable in private modes — the demo still works in memory. */
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      state.files = parsed.filter(function (item) {
        return item && typeof item.name === "string" && typeof item.size === "number" && item.size >= 0;
      });
    } catch (error) {
      state.files = [];
    }
  }

  function fileKind(name) {
    var ext = (name.split(".").pop() || "").toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].indexOf(ext) !== -1) {
      return { cls: "img", icon: "🖼️", label: "Image" };
    }
    if (ext === "pdf") return { cls: "doc", icon: "📄", label: "PDF" };
    if (["doc", "docx", "txt", "rtf", "md"].indexOf(ext) !== -1) {
      return { cls: "doc", icon: "📝", label: "Document" };
    }
    if (["ppt", "pptx", "key"].indexOf(ext) !== -1) return { cls: "doc", icon: "📊", label: "Presentation" };
    if (["xls", "xlsx", "csv"].indexOf(ext) !== -1) return { cls: "img", icon: "📈", label: "Spreadsheet" };
    if (["zip", "rar", "7z", "tar", "gz"].indexOf(ext) !== -1) return { cls: "arc", icon: "🗜️", label: "Archive" };
    if (["mp3", "wav", "ogg", "m4a"].indexOf(ext) !== -1) return { cls: "doc", icon: "🎵", label: "Audio" };
    if (["mp4", "mov", "mkv", "webm"].indexOf(ext) !== -1) return { cls: "arc", icon: "🎬", label: "Video" };
    return { cls: "", icon: "📄", label: "File" };
  }

  function toast(type, title, message) {
    if (!el.toastStack) return;
    var node = document.createElement("div");
    node.className = "toast " + type;
    var copy = document.createElement("div");
    var strong = document.createElement("strong");
    strong.textContent = title;
    var text = document.createElement("p");
    text.textContent = message;
    copy.appendChild(strong);
    copy.appendChild(text);
    node.appendChild(copy);
    el.toastStack.appendChild(node);

    while (el.toastStack.children.length > 3) {
      el.toastStack.removeChild(el.toastStack.firstElementChild);
    }

    setTimeout(function () {
      node.classList.add("hide");
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 240);
    }, 3600);
  }

  /* ------------------------------ render ------------------------------ */

  function render() {
    var used = usedBytes();
    var free = Math.max(0, MAX_BYTES - used);
    var pct = Math.min(100, (used / MAX_BYTES) * 100);
    var query = (el.searchInput.value || "").trim().toLowerCase();

    el.statFiles.textContent = String(state.files.length);
    el.statUsed.textContent = formatBytes(used);
    el.statFree.textContent = formatBytes(free);
    el.storagePct.textContent = Math.round(pct) + "%";
    el.storageBar.style.width = pct + "%";
    el.storageProgress.setAttribute("aria-valuenow", String(Math.round(pct)));
    el.legendUsed.textContent = formatBytes(used) + " used";
    el.legendFree.textContent = formatBytes(free) + " free";
    el.filesCount.textContent = String(state.files.length);
    el.sideUsed.textContent = formatBytes(used);
    el.sideFree.textContent = formatBytes(free);
    el.sideBar.style.width = pct + "%";

    var level = pct >= 90 ? "danger" : pct >= 75 ? "warn" : "";
    el.storageProgress.classList.remove("warn", "danger");
    if (level) el.storageProgress.classList.add(level);

    var visible = state.files.filter(function (file) {
      return !query || file.name.toLowerCase().indexOf(query) !== -1;
    });

    visible.sort(function (a, b) {
      return (b.addedAt || 0) - (a.addedAt || 0);
    });

    el.fileList.textContent = "";

    visible.forEach(function (file) {
      var kind = fileKind(file.name);

      var row = document.createElement("div");
      row.className = "file-row";

      var ico = document.createElement("span");
      ico.className = "file-ico " + kind.cls;
      ico.textContent = kind.icon;
      ico.setAttribute("aria-hidden", "true");

      var info = document.createElement("div");
      info.style.minWidth = "0";
      var name = document.createElement("div");
      name.className = "file-name";
      name.textContent = file.name;
      name.title = file.name;
      var meta = document.createElement("div");
      meta.className = "file-meta";
      meta.textContent = kind.label + " · Added " + new Date(file.addedAt || Date.now()).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric"
      });
      info.appendChild(name);
      info.appendChild(meta);

      var size = document.createElement("span");
      size.className = "file-size";
      size.textContent = formatBytes(file.size);

      var del = document.createElement("button");
      del.type = "button";
      del.className = "icon-btn";
      del.title = "Delete " + file.name;
      del.setAttribute("aria-label", "Delete " + file.name);
      del.textContent = "🗑";
      del.addEventListener("click", function () {
        removeFile(file.id);
      });

      row.appendChild(ico);
      row.appendChild(info);
      row.appendChild(size);
      row.appendChild(del);
      el.fileList.appendChild(row);
    });

    var hasFiles = state.files.length > 0;
    el.emptyState.style.display = visible.length ? "none" : "block";
    if (hasFiles && !visible.length) {
      el.emptyState.querySelector(".e-ico").textContent = "🔎";
      el.emptyState.querySelector("h3").textContent = "No matching files";
      el.emptyState.querySelector("p").textContent = "Try a different filename or clear the search.";
    } else {
      el.emptyState.querySelector(".e-ico").textContent = "☁️";
      el.emptyState.querySelector("h3").textContent = "No files yet";
      el.emptyState.querySelector("p").textContent = "Upload something to see the dashboard update.";
    }

    el.clearAll.disabled = !hasFiles;
    el.clearAll.style.opacity = hasFiles ? "1" : "0.45";
  }

  function removeFile(id) {
    var target = state.files.find(function (file) { return file.id === id; });
    state.files = state.files.filter(function (file) { return file.id !== id; });
    save();
    render();
    if (target) toast("success", "File removed", target.name + " was deleted from the list.");
  }

  /* ----------------------------- uploads ----------------------------- */

  function addFiles(fileList) {
    if (!fileList || !fileList.length) return;

    var list = Array.prototype.slice.call(fileList);
    var used = usedBytes();
    var added = 0;
    var skipped = 0;

    list.forEach(function (file) {
      if (used + file.size > MAX_BYTES) {
        skipped += 1;
        return;
      }
      state.files.push({
        id: "f_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        addedAt: Date.now()
      });
      used += file.size;
      added += 1;
    });

    if (added) {
      save();
      render();
      toast("success", added + (added === 1 ? " file added" : " files added"), "Storage used is now " + formatBytes(usedBytes()) + " of 100 MB.");
    }

    if (skipped) {
      toast("warn", "Quota limit reached", skipped + (skipped === 1 ? " file was" : " files were") + " skipped because the 100 MB quota would be exceeded.");
    }

    if (!added && !skipped) {
      toast("error", "Nothing selected", "Choose one or more files to upload.");
    }
  }

  /* ----------------------------- events ----------------------------- */

  el.uploadBtn.addEventListener("click", function () { el.fileInput.click(); });
  el.browseBtn.addEventListener("click", function (event) {
    event.stopPropagation();
    el.fileInput.click();
  });

  el.fileInput.addEventListener("change", function () {
    addFiles(el.fileInput.files);
    el.fileInput.value = "";
  });

  el.searchInput.addEventListener("input", render);

  el.clearAll.addEventListener("click", function () {
    if (!state.files.length) return;
    if (!window.confirm("Remove all " + state.files.length + " file entries from the dashboard?")) return;
    state.files = [];
    save();
    render();
    el.searchInput.value = "";
    toast("success", "List cleared", "All file entries have been removed.");
  });

  el.resetBtn.addEventListener("click", function () {
    if (!window.confirm("Reset the demo? This clears all saved file entries.")) return;
    state.files = [];
    save();
    el.searchInput.value = "";
    render();
    toast("success", "Demo reset", "Storage is back to a clean 100 MB.");
  });

  ["dragenter", "dragover"].forEach(function (type) {
    el.dropzone.addEventListener(type, function (event) {
      event.preventDefault();
      el.dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "dragend"].forEach(function (type) {
    el.dropzone.addEventListener(type, function () {
      el.dropzone.classList.remove("dragover");
    });
  });

  el.dropzone.addEventListener("drop", function (event) {
    event.preventDefault();
    el.dropzone.classList.remove("dragover");
    if (event.dataTransfer && event.dataTransfer.files) {
      addFiles(event.dataTransfer.files);
    }
  });

  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) {
      load();
      render();
    }
  });

  /* ------------------------------ start ------------------------------ */

  load();
  render();
})();
