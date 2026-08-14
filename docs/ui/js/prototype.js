/**
 * 私域网盘 HTML 原型 · 本地可交互闭环
 * - 登录成功/失败
 * - 目录浏览、新建、重命名、删除
 * - 文件预览、下载、重命名、删除、上传
 * - 传输任务与系统分享导入
 * 状态保存在 sessionStorage，跨页面保持。
 */

const STORE_KEY = 'pdd-prototype-v1';

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function show(el) {
  if (el) el.classList.remove('hidden');
}

function hide(el) {
  if (el) el.classList.add('hidden');
}

function toast(message, hostSelector = '.phone-screen, .desktop-screen') {
  const host = $(hostSelector) || document.body;
  const existing = $('.toast', host);
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (host.classList.contains('desktop-screen') ? ' desktop-toast' : '');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function nowLabel() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fileTypeOf(name, isDirectory) {
  if (isDirectory) return 'folder';
  const lower = name.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic)$/.test(lower)) return 'image';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(txt|md|json|log|csv)$/.test(lower)) return 'text';
  return 'file';
}

function typeLabel(type) {
  return ({ folder: '文件夹', image: '图片', pdf: 'PDF', text: '文本', file: '文件' })[type] || '文件';
}

function formatSize(size) {
  if (size == null) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function displayPath(path) {
  if (!path || path === 'shared/') return '全部文件';
  return path.replace(/^shared\//, '').replace(/\/$/, '') || '全部文件';
}

function parentPath(path) {
  if (!path || path === 'shared/') return 'shared/';
  const normalized = path.endsWith('/') ? path.slice(0, -1) : path;
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return 'shared/';
  return normalized.slice(0, idx + 1);
}

function joinPath(dir, name, isDirectory) {
  const base = dir.endsWith('/') ? dir : `${dir}/`;
  return `${base}${name}${isDirectory ? '/' : ''}`;
}

function defaultTree() {
  return {
    'shared/': [
      { name: 'common', isDirectory: true, updatedAt: '昨天', size: null },
      { name: 'photos', isDirectory: true, updatedAt: '今天', size: null },
      { name: 'docs', isDirectory: true, updatedAt: '2 天前', size: null },
      { name: 'uploads', isDirectory: true, updatedAt: '今天', size: null },
      { name: '家庭合影.jpg', isDirectory: false, updatedAt: '今天 09:12', size: 2516582 },
      { name: '家庭档案说明.pdf', isDirectory: false, updatedAt: '昨天', size: 880640 },
      { name: 'readme.txt', isDirectory: false, updatedAt: '3 天前', size: 4096 },
    ],
    'shared/common/': [
      { name: 'family-rules.pdf', isDirectory: false, updatedAt: '上周', size: 248320 },
      { name: 'receipts', isDirectory: true, updatedAt: '今天', size: null },
      { name: 'access-guide.txt', isDirectory: false, updatedAt: '昨天', size: 4096 },
    ],
    'shared/common/receipts/': [
      { name: '2026-05.pdf', isDirectory: false, updatedAt: '5 月 31 日', size: 156000 },
      { name: '2026-06.pdf', isDirectory: false, updatedAt: '今天', size: 168400 },
    ],
    'shared/photos/': [
      { name: '2026-trip.jpg', isDirectory: false, updatedAt: '今天', size: 3145728 },
      { name: 'beach.png', isDirectory: false, updatedAt: '今天', size: 1843200 },
      { name: 'dinner.jpg', isDirectory: false, updatedAt: '昨天', size: 2237440 },
      { name: 'notes.txt', isDirectory: false, updatedAt: '昨天', size: 2048 },
      { name: 'album-guide.pdf', isDirectory: false, updatedAt: '2 天前', size: 120400 },
      { name: 'portraits', isDirectory: true, updatedAt: '今天', size: null },
    ],
    'shared/photos/portraits/': [
      { name: 'alice.png', isDirectory: false, updatedAt: '今天', size: 1245728 },
      { name: 'bob.jpg', isDirectory: false, updatedAt: '今天', size: 1457280 },
    ],
    'shared/docs/': [
      { name: 'project-plan.md', isDirectory: false, updatedAt: '昨天', size: 8192 },
      { name: 'server-config.json', isDirectory: false, updatedAt: '2 天前', size: 3072 },
    ],
    'shared/uploads/': [],
  };
}

function defaultState() {
  return {
    session: {
      loggedIn: false,
      account: '',
      role: 'admin', // admin | member
      displayName: '',
    },
    currentPath: 'shared/',
    viewMode: 'list', // list | grid
    tree: defaultTree(),
    tasks: [
      {
        id: 't1',
        name: '旅行照片合集.zip',
        kind: 'upload',
        status: 'running',
        progress: 0.68,
        message: '128 MB / 188 MB',
        target: 'shared/uploads/',
      },
      {
        id: 't2',
        name: '家庭档案说明.pdf',
        kind: 'download',
        status: 'running',
        progress: 0.92,
        message: '790 KB / 860 KB',
        target: '本地下载目录',
      },
      {
        id: 't3',
        name: '证件扫描.pdf',
        kind: 'upload',
        status: 'failed',
        progress: 0.34,
        message: '网络波动中断',
        target: 'shared/docs/',
      },
    ],
    pendingShare: null,
  };
}

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
      session: { ...defaultState().session, ...(parsed.session || {}) },
      tree: parsed.tree || defaultTree(),
      tasks: parsed.tasks || defaultState().tasks,
      viewMode: parsed.viewMode === 'grid' ? 'grid' : 'list',
    };
  } catch (e) {
    return defaultState();
  }
}

function saveState(state) {
  sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
}

const AppStore = {
  state: loadState(),

  get() {
    return this.state;
  },

  commit(mutator) {
    mutator(this.state);
    saveState(this.state);
    return this.state;
  },

  resetDemo() {
    this.state = defaultState();
    saveState(this.state);
    return this.state;
  },

  requireLogin(redirectTo = './mobile-login.html') {
    if (!this.state.session.loggedIn) {
      const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
      location.href = `${redirectTo}?next=${next}`;
      return false;
    }
    return true;
  },

  login(account, password) {
    const users = {
      'family.admin': { password: 'admin123', role: 'admin', displayName: 'family.admin' },
      'family.member': { password: 'member123', role: 'member', displayName: 'family.member' },
      admin: { password: 'admin123', role: 'admin', displayName: 'family.admin' },
      member: { password: 'member123', role: 'member', displayName: 'family.member' },
    };
    const user = users[String(account || '').trim()];
    if (!user || user.password !== String(password || '')) {
      return { ok: false, message: '账号或口令错误。可试 family.admin / admin123' };
    }
    this.commit((s) => {
      s.session = {
        loggedIn: true,
        account: user.displayName,
        role: user.role,
        displayName: user.displayName,
      };
    });
    return { ok: true, role: user.role };
  },

  logout() {
    this.commit((s) => {
      s.session.loggedIn = false;
      s.session.account = '';
      s.session.displayName = '';
    });
  },

  setRole(role) {
    this.commit((s) => {
      s.session.role = role;
      if (!s.session.displayName) {
        s.session.displayName = role === 'admin' ? 'family.admin' : 'family.member';
        s.session.account = s.session.displayName;
        s.session.loggedIn = true;
      }
    });
  },

  canUpload() {
    return this.state.session.role === 'admin';
  },

  canDelete() {
    return this.state.session.role === 'admin';
  },

  list(path = this.state.currentPath) {
    if (!this.state.tree[path]) this.state.tree[path] = [];
    return this.state.tree[path];
  },

  setPath(path) {
    this.commit((s) => {
      s.currentPath = path;
      if (!s.tree[path]) s.tree[path] = [];
    });
  },

  setViewMode(mode) {
    const next = mode === 'grid' ? 'grid' : 'list';
    this.commit((s) => {
      s.viewMode = next;
    });
    return next;
  },

  ensureDir(path) {
    this.commit((s) => {
      if (!s.tree[path]) s.tree[path] = [];
    });
  },

  findItem(path, name) {
    return (this.state.tree[path] || []).find((item) => item.name === name) || null;
  },

  createFolder(name, path = this.state.currentPath) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { ok: false, message: '文件夹名不能为空' };
    if (/[\\/]/.test(trimmed)) return { ok: false, message: '名称不能包含斜杠' };
    if (!this.canUpload()) return { ok: false, message: '当前身份没有新建权限' };
    const items = this.list(path);
    if (items.some((i) => i.name === trimmed)) return { ok: false, message: '同名项目已存在' };
    const folderPath = joinPath(path, trimmed, true);
    this.commit((s) => {
      s.tree[path] = [
        { name: trimmed, isDirectory: true, updatedAt: nowLabel(), size: null },
        ...s.tree[path],
      ];
      s.tree[folderPath] = s.tree[folderPath] || [];
    });
    return { ok: true, message: `已创建文件夹 ${trimmed}` };
  },

  renameItem(oldName, newName, path = this.state.currentPath) {
    const next = String(newName || '').trim();
    if (!next) return { ok: false, message: '名称不能为空' };
    if (/[\\/]/.test(next)) return { ok: false, message: '名称不能包含斜杠' };
    if (!this.canUpload()) return { ok: false, message: '当前身份没有重命名权限' };
    const items = this.list(path);
    const item = items.find((i) => i.name === oldName);
    if (!item) return { ok: false, message: '未找到目标' };
    if (items.some((i) => i.name === next && i !== item)) return { ok: false, message: '同名项目已存在' };

    this.commit((s) => {
      const list = s.tree[path] || [];
      const target = list.find((i) => i.name === oldName);
      if (!target) return;
      if (target.isDirectory) {
        const oldPath = joinPath(path, oldName, true);
        const newPath = joinPath(path, next, true);
        const moved = {};
        Object.keys(s.tree).forEach((key) => {
          if (key === oldPath || key.startsWith(oldPath)) {
            moved[newPath + key.slice(oldPath.length)] = s.tree[key];
            delete s.tree[key];
          }
        });
        Object.assign(s.tree, moved);
        if (s.currentPath === oldPath || s.currentPath.startsWith(oldPath)) {
          s.currentPath = newPath + s.currentPath.slice(oldPath.length);
        }
      }
      target.name = next;
      target.updatedAt = nowLabel();
    });
    return { ok: true, message: `已重命名为 ${next}` };
  },

  deleteItem(name, path = this.state.currentPath) {
    if (!this.canDelete()) return { ok: false, message: '当前身份没有删除权限' };
    const item = this.findItem(path, name);
    if (!item) return { ok: false, message: '未找到目标' };
    this.commit((s) => {
      s.tree[path] = (s.tree[path] || []).filter((i) => i.name !== name);
      if (item.isDirectory) {
        const dirPath = joinPath(path, name, true);
        Object.keys(s.tree).forEach((key) => {
          if (key === dirPath || key.startsWith(dirPath)) delete s.tree[key];
        });
      }
    });
    return { ok: true, message: `已删除 ${name}` };
  },

  addFiles(fileNames, path = this.state.currentPath) {
    if (!this.canUpload()) return { ok: false, message: '当前身份没有上传权限' };
    const names = (fileNames || []).map((n) => String(n).trim()).filter(Boolean);
    if (!names.length) return { ok: false, message: '没有可上传的文件' };
    this.commit((s) => {
      if (!s.tree[path]) s.tree[path] = [];
      names.forEach((name) => {
        const exists = s.tree[path].some((i) => i.name === name);
        const finalName = exists ? name.replace(/(\.[^.]+)?$/, (m, ext) => `_copy${ext || ''}`) : name;
        s.tree[path].unshift({
          name: finalName,
          isDirectory: false,
          updatedAt: nowLabel(),
          size: 1024 * (200 + Math.floor(Math.random() * 1800)),
        });
        s.tasks.unshift({
          id: `t-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          name: finalName,
          kind: 'upload',
          status: 'success',
          progress: 1,
          message: `已上传到 ${path}`,
          target: path,
        });
      });
    });
    return { ok: true, message: `已上传 ${names.length} 个文件` };
  },

  download(name, path = this.state.currentPath) {
    const item = this.findItem(path, name);
    if (!item || item.isDirectory) return { ok: false, message: '只能下载文件' };
    this.commit((s) => {
      s.tasks.unshift({
        id: `t-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        name,
        kind: 'download',
        status: 'success',
        progress: 1,
        message: '已保存到本地下载目录',
        target: '本地下载目录',
      });
    });
    return { ok: true, message: `已开始下载 ${name}` };
  },

  retryTask(id) {
    this.commit((s) => {
      const task = s.tasks.find((t) => t.id === id);
      if (!task) return;
      task.status = 'running';
      task.progress = Math.min(0.95, (task.progress || 0) + 0.4);
      task.message = '重试中…';
      setTimeout(() => {
        this.commit((ss) => {
          const t = ss.tasks.find((x) => x.id === id);
          if (!t) return;
          t.status = 'success';
          t.progress = 1;
          t.message = t.kind === 'upload' ? `已上传到 ${t.target}` : '已保存到本地下载目录';
        });
        document.dispatchEvent(new CustomEvent('pdd:tasks-updated'));
      }, 900);
    });
    return { ok: true, message: '已重新开始任务' };
  },

  cancelTask(id) {
    this.commit((s) => {
      s.tasks = s.tasks.filter((t) => t.id !== id);
    });
    return { ok: true, message: '已取消任务' };
  },

  setPendingShare(files, targetPath) {
    this.commit((s) => {
      s.pendingShare = {
        files: files.slice(),
        targetPath: targetPath || s.currentPath || 'shared/photos/',
      };
    });
  },

  clearPendingShare() {
    this.commit((s) => {
      s.pendingShare = null;
    });
  },
};

function bindToggles() {
  $all('[data-show]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      show($(btn.getAttribute('data-show')));
    });
  });

  $all('[data-hide]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      hide($(btn.getAttribute('data-hide')));
    });
  });

  $all('[data-toast]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toast(btn.getAttribute('data-toast'));
    });
  });
}

function bindDropzone() {
  const zone = $('#dropzone');
  if (!zone) return;
  ['dragenter', 'dragover'].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (evt === 'drop') {
        const result = AppStore.addFiles(['拖拽示例.pdf']);
        toast(result.message);
        document.dispatchEvent(new CustomEvent('pdd:files-updated'));
      }
    });
  });
  zone.addEventListener('click', () => {
    const result = AppStore.addFiles([`upload-${Date.now().toString().slice(-4)}.txt`]);
    toast(result.message);
    document.dispatchEvent(new CustomEvent('pdd:files-updated'));
  });
}

function bindRoleSwitch() {
  const switcher = $('#role-switch');
  if (!switcher) return;
  const state = AppStore.get();
  switcher.value = state.session.role || 'admin';
  const apply = () => {
    const role = switcher.value;
    AppStore.setRole(role);
    $all('[data-role-admin]').forEach((el) => {
      el.classList.toggle('hidden', role !== 'admin');
    });
    $all('[data-role-member]').forEach((el) => {
      el.classList.toggle('hidden', role !== 'member');
    });
    $all('[data-role-label]').forEach((el) => {
      el.textContent = role === 'admin' ? '管理员' : '普通成员';
      el.className = 'chip ' + (role === 'admin' ? 'admin' : 'member');
    });
    document.dispatchEvent(new CustomEvent('pdd:role-updated'));
  };
  switcher.addEventListener('change', apply);
  apply();
}

function bindPreviewTabs() {
  $all('[data-preview]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-preview');
      $all('[data-preview-panel]').forEach((panel) => {
        panel.classList.toggle('hidden', panel.getAttribute('data-preview-panel') !== type);
      });
      $all('[data-preview]').forEach((item) => {
        item.classList.toggle('active', item === btn);
      });
      const title = $('#preview-title');
      const params = new URLSearchParams(location.search);
      const fileName = params.get('name');
      if (title) {
        title.textContent = fileName || {
          image: '家庭合影.jpg',
          pdf: '家庭档案说明.pdf',
          text: 'readme.txt',
        }[type] || '预览';
      }
    });
  });
}

function pathBreadcrumb(path) {
  const parts = path.replace(/\/$/, '').split('/').filter(Boolean);
  return parts.join(' / ') || 'shared';
}

/** 路径过长时省略左侧前缀：.../tail/path */
function truncatePathFront(path, maxLen = 36) {
  const raw = String(path || '');
  if (raw.length <= maxLen) return raw;

  const endsWithSlash = raw.endsWith('/');
  const parts = (raw.endsWith('/') ? raw.slice(0, -1) : raw).split('/').filter(Boolean);
  if (!parts.length) return '...' + raw.slice(-(Math.max(4, maxLen - 3)));

  let startIdx = 0;
  while (startIdx < parts.length) {
    const tail = parts.slice(startIdx).join('/') + (endsWithSlash ? '/' : '');
    const candidate = startIdx === 0 ? tail : ('.../' + tail);
    if (candidate.length <= maxLen) return candidate;
    startIdx += 1;
  }

  // 只剩最后一段仍超长：保留右侧字符
  const last = parts[parts.length - 1] + (endsWithSlash ? '/' : '');
  const keep = Math.max(4, maxLen - 3);
  return '...' + last.slice(-keep);
}

/** 按元素实际宽度做左侧省略，避免 CSS 截右侧 */
function fitPathWithFrontEllipsis(el, fullPath) {
  if (!el) return;
  const full = String(fullPath || '');
  // 桌面路径用 CSS 左侧 ellipsis（rtl 容器 + ltr 文本）；这里只写入完整路径
  el.title = full;
  const textEl = el.querySelector('.cup-path-title-text');
  if (textEl) {
    textEl.textContent = full;
    return;
  }
  // 移动端 path-chip：完整路径 + CSS 左侧 ellipsis
  el.textContent = full;
}

function thumbStyleFor(name, type) {
  if (type !== 'image') return '';
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hues = [210, 160, 28, 330, 250, 190];
  const h1 = hues[hash % hues.length];
  const h2 = hues[(hash >> 3) % hues.length];
  return `style="background: linear-gradient(145deg, hsl(${h1} 72% 72%), hsl(${h2} 65% 48%));"`;
}

function renderMobileFilesPage() {
  const root = $('#file-list');
  if (!root) return;
  if (!AppStore.requireLogin()) return;

  const state = AppStore.get();
  const path = state.currentPath;
  const viewMode = state.viewMode === 'grid' ? 'grid' : 'list';
  const items = AppStore.list(path).slice().sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh');
  });

  const pathEl = $('#current-path-label');
  if (pathEl) {
    fitPathWithFrontEllipsis(pathEl, pathBreadcrumb(path));
  }

  const titleEl = $('#files-title');
  if (titleEl) {
    const segs = path.replace(/\/$/, '').split('/');
    titleEl.textContent = segs[segs.length - 1] || '共享空间';
  }

  const backBtn = $('#btn-go-up');
  if (backBtn) {
    backBtn.classList.toggle('hidden', path === 'shared/');
  }

  // view mode toggle UI state
  $all('[data-view-mode]').forEach((btn) => {
    const active = btn.getAttribute('data-view-mode') === viewMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const modeHint = $('#view-mode-hint');
  if (modeHint) {
    modeHint.textContent = viewMode === 'grid'
      ? '缩略图：图片显示预览，其他类型使用默认图标'
      : '列表：展示名称、类型、大小与更新时间';
  }

  const empty = $('#empty-panel');
  if (empty) empty.classList.toggle('hidden', items.length > 0);
  root.classList.toggle('hidden', items.length === 0);
  root.classList.toggle('file-list', viewMode === 'list');
  root.classList.toggle('file-grid', viewMode === 'grid');
  root.classList.remove(viewMode === 'grid' ? 'file-list' : 'file-grid');
  // ensure correct classes
  if (viewMode === 'grid') {
    root.classList.add('file-grid');
    root.classList.remove('file-list');
  } else {
    root.classList.add('file-list');
    root.classList.remove('file-grid');
  }

  if (viewMode === 'grid') {
    root.innerHTML = items.map((item) => {
      const type = fileTypeOf(item.name, item.isDirectory);
      const meta = item.isDirectory
        ? `${typeLabel(type)}`
        : `${typeLabel(type)} · ${formatSize(item.size)}`;
      const previewClass = type === 'image' ? 'is-image' : `is-icon ${type}`;
      return `
        <div class="grid-item" data-name="${item.name}" data-dir="${item.isDirectory ? '1' : '0'}">
          <div class="grid-thumb ${previewClass}" ${thumbStyleFor(item.name, type)}>
            <span class="grid-type-badge">${typeLabel(type)}</span>
          </div>
          <div class="grid-meta">
            <strong title="${item.name}">${item.name}</strong>
            <span>${meta}</span>
          </div>
          <button class="icon-btn grid-more" data-action="more" aria-label="更多">⋯</button>
        </div>`;
    }).join('');
  } else {
    root.innerHTML = items.map((item) => {
      const type = fileTypeOf(item.name, item.isDirectory);
      const meta = item.isDirectory
        ? `${typeLabel(type)} · ${item.updatedAt || ''}`
        : `${typeLabel(type)} · ${formatSize(item.size)} · ${item.updatedAt || ''}`;
      return `
        <div class="file-item" data-name="${item.name}" data-dir="${item.isDirectory ? '1' : '0'}">
          <div class="file-icon ${type}"></div>
          <div class="file-meta"><strong>${item.name}</strong><span>${meta}</span></div>
          <div class="file-actions">
            <button class="icon-btn" data-action="more" aria-label="更多">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  root.querySelectorAll('.file-item, .grid-item').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      const name = row.getAttribute('data-name');
      const isDir = row.getAttribute('data-dir') === '1';
      if (isDir) {
        AppStore.setPath(joinPath(path, name, true));
        renderMobileFilesPage();
        toast(`已进入 ${name}`);
      } else {
        const type = fileTypeOf(name, false);
        location.href = `./mobile-preview.html?name=${encodeURIComponent(name)}&path=${encodeURIComponent(path)}&type=${type}`;
      }
    });
    const more = row.querySelector('[data-action="more"]');
    if (more) {
      more.addEventListener('click', (e) => {
        e.stopPropagation();
        openItemSheet(row.getAttribute('data-name'), row.getAttribute('data-dir') === '1');
      });
    }
  });
}

function openItemSheet(name, isDirectory) {
  const sheet = $('#item-sheet');
  if (!sheet) return;
  sheet.dataset.name = name;
  sheet.dataset.dir = isDirectory ? '1' : '0';
  const title = $('#item-sheet-title');
  if (title) title.textContent = name;
  $all('[data-item-action="preview"], [data-item-action="download"]', sheet).forEach((el) => {
    el.classList.toggle('hidden', isDirectory);
  });
  show(sheet);
}

function bindMobileFilesActions() {
  if (!$('#file-list')) return;

  const up = $('#btn-go-up');
  if (up) {
    up.addEventListener('click', () => {
      const path = AppStore.get().currentPath;
      AppStore.setPath(parentPath(path));
      renderMobileFilesPage();
    });
  }

  const refresh = $('#btn-refresh');
  if (refresh) {
    refresh.addEventListener('click', () => {
      renderMobileFilesPage();
      toast('已刷新文件列表');
    });
  }

  $all('[data-view-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-view-mode');
      AppStore.setViewMode(mode);
      renderMobileFilesPage();
      toast(mode === 'grid' ? '已切换到缩略图浏览' : '已切换到列表浏览');
    });
  });

  // create folder
  const createBtn = $('#btn-create-folder');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      hide($('#upload-sheet'));
      const modal = $('#mkdir-modal');
      const input = $('#mkdir-input');
      const error = $('#mkdir-error');
      if (!modal || !input) return;
      input.value = '新建文件夹';
      if (error) {
        error.textContent = '';
        error.classList.add('hidden');
      }
      show(modal);
      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    });
  }

  const confirmMkdirMobile = $('#btn-confirm-mkdir');
  if (confirmMkdirMobile) {
    const submitMobileMkdir = () => {
      const modal = $('#mkdir-modal');
      const input = $('#mkdir-input');
      const error = $('#mkdir-error');
      const name = (input?.value || '').trim();
      if (!name) {
        if (error) {
          error.textContent = '文件夹名不能为空';
          error.classList.remove('hidden');
        }
        return;
      }
      const result = AppStore.createFolder(name);
      if (!result.ok) {
        if (error) {
          error.textContent = result.message;
          error.classList.remove('hidden');
        }
        toast(result.message);
        return;
      }
      hide(modal);
      toast(result.message);
      renderMobileFilesPage();
    };
    confirmMkdirMobile.addEventListener('click', submitMobileMkdir);
    const mkdirInputMobile = $('#mkdir-input');
    if (mkdirInputMobile) {
      mkdirInputMobile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitMobileMkdir();
        } else if (e.key === 'Escape') {
          hide($('#mkdir-modal'));
        }
      });
    }
  }

  const uploadFileBtn = $('#btn-upload-file');
  if (uploadFileBtn) {
    uploadFileBtn.addEventListener('click', () => {
      hide($('#upload-sheet'));
      const name = prompt('模拟上传文件名', `photo-${Date.now().toString().slice(-4)}.jpg`);
      if (name == null) return;
      const result = AppStore.addFiles([name]);
      toast(result.message);
      if (result.ok) renderMobileFilesPage();
    });
  }

  const uploadAlbumBtn = $('#btn-upload-album');
  if (uploadAlbumBtn) {
    uploadAlbumBtn.addEventListener('click', () => {
      hide($('#upload-sheet'));
      const result = AppStore.addFiles([
        `IMG_${Date.now().toString().slice(-6)}.jpg`,
        `IMG_${(Date.now() + 1).toString().slice(-6)}.jpg`,
      ]);
      toast(result.message);
      if (result.ok) renderMobileFilesPage();
    });
  }

  // item sheet actions
  $all('[data-item-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sheet = $('#item-sheet');
      const name = sheet?.dataset.name;
      const isDir = sheet?.dataset.dir === '1';
      const action = btn.getAttribute('data-item-action');
      if (!name) return;
      hide(sheet);

      if (action === 'open') {
        if (isDir) {
          AppStore.setPath(joinPath(AppStore.get().currentPath, name, true));
          renderMobileFilesPage();
        } else {
          const type = fileTypeOf(name, false);
          location.href = `./mobile-preview.html?name=${encodeURIComponent(name)}&path=${encodeURIComponent(AppStore.get().currentPath)}&type=${type}`;
        }
        return;
      }
      if (action === 'preview') {
        const type = fileTypeOf(name, false);
        location.href = `./mobile-preview.html?name=${encodeURIComponent(name)}&path=${encodeURIComponent(AppStore.get().currentPath)}&type=${type}`;
        return;
      }
      if (action === 'download') {
        const result = AppStore.download(name);
        toast(result.message);
        return;
      }
      if (action === 'rename') {
        const next = prompt('重命名为', name);
        if (next == null) return;
        const result = AppStore.renameItem(name, next);
        toast(result.message);
        if (result.ok) renderMobileFilesPage();
        return;
      }
      if (action === 'delete') {
        const modal = $('#delete-modal');
        if (modal) {
          modal.dataset.name = name;
          const desc = $('#delete-desc');
          if (desc) desc.textContent = `将删除“${name}”。一期没有回收站，请确认。`;
          show(modal);
        }
      }
    });
  });

  const confirmDelete = $('#btn-confirm-delete');
  if (confirmDelete) {
    confirmDelete.addEventListener('click', () => {
      const modal = $('#delete-modal');
      const name = modal?.dataset.name;
      hide(modal);
      if (!name) return;
      const result = AppStore.deleteItem(name);
      toast(result.message);
      if (result.ok) renderMobileFilesPage();
    });
  }

  document.addEventListener('pdd:files-updated', renderMobileFilesPage);
  document.addEventListener('pdd:role-updated', renderMobileFilesPage);
  renderMobileFilesPage();
}

function bindLoginPage() {
  const form = $('#login-form');
  if (!form) return;

  const accountInput = $('#login-account');
  const passwordInput = $('#login-password');
  const errorEl = $('#login-error');
  const loading = $('#login-loading');
  const btn = $('#login-btn');
  const demoAdmin = $('#demo-admin');
  const demoMember = $('#demo-member');
  const demoFail = $('#demo-fail');

  const params = new URLSearchParams(location.search);
  const next = params.get('next') || 'mobile-files.html';

  if (AppStore.get().session.loggedIn) {
    // already logged in
  }

  function setError(msg) {
    if (!errorEl) return;
    if (!msg) {
      errorEl.classList.add('hidden');
      errorEl.textContent = '';
      return;
    }
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function doLogin(account, password, { forceFail = false } = {}) {
    setError('');
    hide(form);
    show(loading);
    setTimeout(() => {
      if (forceFail) {
        hide(loading);
        show(form);
        setError('登录失败：账号或口令错误');
        toast('登录失败');
        return;
      }
      const result = AppStore.login(account, password);
      if (!result.ok) {
        hide(loading);
        show(form);
        setError(result.message);
        toast('登录失败');
        return;
      }
      toast(result.role === 'admin' ? '管理员登录成功' : '成员登录成功');
      location.href = `./${next.replace(/^\.\//, '')}`;
    }, 700);
  }

  if (btn) {
    btn.addEventListener('click', () => {
      doLogin(accountInput?.value, passwordInput?.value);
    });
  }
  if (demoAdmin) demoAdmin.addEventListener('click', () => {
    if (accountInput) accountInput.value = 'family.admin';
    if (passwordInput) passwordInput.value = 'admin123';
    doLogin('family.admin', 'admin123');
  });
  if (demoMember) demoMember.addEventListener('click', () => {
    if (accountInput) accountInput.value = 'family.member';
    if (passwordInput) passwordInput.value = 'member123';
    doLogin('family.member', 'member123');
  });
  if (demoFail) demoFail.addEventListener('click', () => {
    if (accountInput) accountInput.value = 'family.admin';
    if (passwordInput) passwordInput.value = 'wrong-password';
    doLogin('family.admin', 'wrong-password', { forceFail: true });
  });
}

function bindTasksPage() {
  const list = $('#task-list');
  if (!list) return;

  // 桌面原型默认已登录；移动端仍走登录校验
  const isDesktop = !!$('.desktop-screen') || list.classList.contains('cup-task-list');
  if (!isDesktop && !AppStore.requireLogin()) return;
  if (isDesktop && !AppStore.get().session.loggedIn) {
    AppStore.commit((s) => {
      s.session = { loggedIn: true, account: 'family.admin', role: 'admin', displayName: 'family.admin' };
    });
  }

  const cupMode = list.classList.contains('cup-task-list') || !!$('.cup');

  function render() {
    const tasks = AppStore.get().tasks;
    if (!tasks.length) {
      list.innerHTML = cupMode
        ? '<div class="cup-empty"><h3>暂无传输任务</h3><p>上传、下载或系统分享后会显示在这里。</p></div>'
        : '<div class="empty-state"><div class="emoji"></div><h3>暂无传输任务</h3><p>上传、下载或系统分享后会显示在这里。</p></div>';
      return;
    }
    list.innerHTML = tasks.map((task) => {
      const statusText = {
        pending: '等待中',
        running: task.kind === 'upload' ? '上传中' : '下载中',
        success: '已完成',
        failed: '失败',
      }[task.status] || task.status;
      const statusClass = task.status === 'failed' ? 'text-danger' : task.status === 'success' ? 'text-success' : '';
      const fillClass = task.status === 'failed' ? 'danger' : task.status === 'success' ? 'success' : '';
      const primaryBtn = cupMode ? 'cup-btn primary' : 'btn btn-primary';
      const secondaryBtn = cupMode ? 'cup-btn' : 'btn btn-secondary';
      const actions = task.status === 'failed'
        ? '<div class="inline-actions mt-12">'
          + '<button class="' + primaryBtn + '" data-retry="' + task.id + '">重试</button>'
          + '<button class="' + secondaryBtn + '" data-cancel="' + task.id + '">取消</button>'
          + '</div>'
        : task.status === 'running'
          ? '<div class="inline-actions mt-12"><button class="' + secondaryBtn + '" data-cancel="' + task.id + '">取消</button></div>'
          : '';
      const cardClass = cupMode ? 'cup-task' : 'progress-card';
      return (
        '<div class="' + cardClass + '">'
        + '<div class="progress-head"><strong>' + (task.kind === 'upload' ? '上传' : '下载') + ' · ' + task.name + '</strong>'
        + '<span class="' + statusClass + '">' + statusText + '</span></div>'
        + '<div class="progress-track"><div class="progress-fill ' + fillClass + '" style="width:' + Math.round((task.progress || 0) * 100) + '%"></div></div>'
        + '<div class="progress-meta"><span>' + (task.message || '') + '</span><span>' + (task.target || '') + '</span></div>'
        + actions
        + '</div>'
      );
    }).join('');

    list.querySelectorAll('[data-retry]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const result = AppStore.retryTask(btn.getAttribute('data-retry'));
        toast(result.message);
        render();
      });
    });
    list.querySelectorAll('[data-cancel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const result = AppStore.cancelTask(btn.getAttribute('data-cancel'));
        toast(result.message);
        render();
      });
    });
  }

  document.addEventListener('pdd:tasks-updated', render);
  render();
}

function bindPreviewPage() {
  if (!$('#preview-title') && !$('[data-preview-panel]')) return;
  if (!AppStore.requireLogin()) return;
  const params = new URLSearchParams(location.search);
  const name = params.get('name');
  const path = params.get('path') || AppStore.get().currentPath;
  const type = params.get('type') || (name ? fileTypeOf(name, false) : 'image');
  const title = $('#preview-title');
  if (title && name) title.textContent = name;
  const pathLabel = $('#preview-path');
  if (pathLabel) pathLabel.textContent = pathBreadcrumb(path) + (name ? ` / ${name}` : '');

  $all('[data-preview-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.getAttribute('data-preview-panel') !== type);
  });
  $all('[data-preview]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-preview') === type);
  });

  const downloadBtn = $('#preview-download');
  if (downloadBtn && name) {
    downloadBtn.addEventListener('click', () => {
      const result = AppStore.download(name, path);
      toast(result.message);
    });
  }
}

function bindSharePage() {
  const list = $('#share-list');
  if (!list) return;
  if (!AppStore.requireLogin()) return;

  const state = AppStore.get();
  if (!state.pendingShare) {
    AppStore.setPendingShare(
      ['IMG_20260810_0912.jpg', 'IMG_20260810_0915.jpg', '家庭合影.jpg'],
      state.currentPath && state.currentPath !== 'shared/' ? state.currentPath : 'shared/photos/'
    );
  }

  function render() {
    const pending = AppStore.get().pendingShare;
    if (!pending) return;
    const target = $('#target-path');
    if (target) target.textContent = pathBreadcrumb(pending.targetPath);
    const count = $('#share-count');
    if (count) count.textContent = `${pending.files.length} 项`;
    const subtitle = $('#share-subtitle');
    if (subtitle) subtitle.textContent = `来自系统相册分享 · ${pending.files.length} 张图片`;

    list.innerHTML = pending.files.map((name, idx) => `
      <div class="share-file-item" data-idx="${idx}">
        <div class="share-thumb image"></div>
        <div class="file-meta"><strong>${name}</strong><span>图片 · 待上传</span></div>
        <button class="icon-btn" data-remove="${idx}" aria-label="移除">×</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-remove'));
        AppStore.commit((s) => {
          if (!s.pendingShare) return;
          s.pendingShare.files.splice(idx, 1);
        });
        toast('已从待上传列表移除');
        render();
      });
    });
  }

  $all('.folder-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const path = btn.getAttribute('data-path-value') || 'shared/photos/';
      AppStore.commit((s) => {
        if (!s.pendingShare) return;
        s.pendingShare.targetPath = path;
      });
      hide($('#folder-sheet'));
      toast('已选择目录：' + pathBreadcrumb(path));
      render();
    });
  });

  const confirmBtn = $('#confirm-upload');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const pending = AppStore.get().pendingShare;
      if (!pending || !pending.files.length) {
        toast('没有可上传的文件');
        return;
      }
      if (!AppStore.canUpload()) {
        show($('#permission-modal'));
        return;
      }
      AppStore.setPath(pending.targetPath);
      const result = AppStore.addFiles(pending.files, pending.targetPath);
      AppStore.clearPendingShare();
      toast(result.message);
      setTimeout(() => { location.href = './mobile-tasks.html'; }, 500);
    });
  }

  const memberBtn = $('#confirm-upload-member');
  if (memberBtn) {
    memberBtn.addEventListener('click', () => show($('#permission-modal')));
  }

  render();
}

function bindStatesPage() {
  if (!$('.profile-card') && !$('#btn-logout')) return;
  if (!AppStore.requireLogin()) return;
  const session = AppStore.get().session;
  const nameEl = $('#profile-name');
  const roleEl = $('#profile-role');
  if (nameEl) nameEl.textContent = session.displayName || session.account || '未登录';
  if (roleEl) {
    const caps = session.role === 'admin' ? '可浏览 / 下载 / 上传 / 删除' : '可浏览 / 下载';
    roleEl.textContent = `${session.role === 'admin' ? '管理员' : '普通成员'} · ${caps}`;
  }
  const avatar = $('#profile-avatar');
  if (avatar) avatar.textContent = (session.displayName || 'U').slice(0, 1).toUpperCase();

  const logout = $('#btn-logout');
  if (logout) {
    logout.addEventListener('click', (e) => {
      e.preventDefault();
      AppStore.logout();
      location.href = './mobile-login.html';
    });
  }

  const reset = $('#btn-reset-demo');
  if (reset) {
    reset.addEventListener('click', () => {
      AppStore.resetDemo();
      toast('已重置原型数据');
      setTimeout(() => location.href = './mobile-login.html', 500);
    });
  }
}

function bindDesktopFilesPage() {
  const listHost = $('#desktop-file-body');
  const gridHost = $('#desktop-file-grid');
  if (!listHost && !gridHost) return;

  // desktop prototype assumes logged-in demo session
  if (!AppStore.get().session.loggedIn) {
    AppStore.commit((s) => {
      s.session = { loggedIn: true, account: 'family.admin', role: 'admin', displayName: 'family.admin' };
    });
  }

  let selectedName = null;

  function iconClass(type) {
    if (type === 'folder') return 'folder';
    if (type === 'image') return 'image';
    if (type === 'pdf') return 'pdf';
    return 'text';
  }

  function iconText(type) {
    if (type === 'folder') return 'DIR';
    if (type === 'image') return 'IMG';
    if (type === 'pdf') return 'PDF';
    if (type === 'text') return 'TXT';
    return 'FILE';
  }

  function updatePreview(item, path) {
    if (!item) return;
    const type = fileTypeOf(item.name, item.isDirectory);
    selectedName = item.name;
    const art = $('#desktop-preview-art');
    const nameEl = $('#desktop-preview-name');
    const typeEl = $('#desktop-preview-type');
    const sizeEl = $('#desktop-preview-size');
    const pathEl = $('#desktop-preview-path');
    const timeEl = $('#desktop-preview-time');
    if (art) {
      art.textContent = iconText(type);
      art.className = 'cup-preview-art ' + iconClass(type);
    }
    if (nameEl) nameEl.textContent = item.name;
    if (typeEl) typeEl.textContent = typeLabel(type);
    if (sizeEl) sizeEl.textContent = item.isDirectory ? '—' : formatSize(item.size);
    if (pathEl) pathEl.textContent = displayPath(path);
    if (timeEl) timeEl.textContent = item.updatedAt || '—';
  }

  function render() {
    const state = AppStore.get();
    const path = state.currentPath;
    const items = AppStore.list(path).slice().sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh');
    });
    const title = $('#desktop-path-title');
    if (title) {
      // 路径独占一行；过长时省略左侧，保留右侧目录名
      fitPathWithFrontEllipsis(title, path);
    }
    const goUp = $('#desktop-go-up');
    if (goUp) goUp.classList.toggle('hidden', path === 'shared/');
    const pathHint = $('#desktop-path-hint');
    if (pathHint) {
      pathHint.textContent = path === 'shared/'
        ? '按目录浏览 · 支持列表 / 缩略图 · 拖拽上传'
        : '可点「上级」返回上一层，或双击文件夹进入';
    }
    const userName = $('#desktop-user-name');
    if (userName) userName.textContent = state.session.displayName || state.session.account || 'family.admin';

    const viewMode = state.viewMode === 'grid' ? 'grid' : 'list';
    $all('[data-view-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-view-mode') === viewMode);
    });
    const tableWrap = $('#desktop-table-wrap');
    if (tableWrap) tableWrap.classList.toggle('hidden', viewMode !== 'list');
    if (listHost) listHost.classList.toggle('hide', viewMode !== 'list');
    if (gridHost) {
      gridHost.classList.toggle('hidden', viewMode !== 'grid');
      gridHost.classList.toggle('show', viewMode === 'grid');
    }

    $all('[data-desktop-nav]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-desktop-nav') === path);
    });

    if (!selectedName || !items.some((i) => i.name === selectedName)) {
      selectedName = items[0] ? items[0].name : null;
    }
    const selected = items.find((i) => i.name === selectedName) || null;
    if (selected) updatePreview(selected, path);

    if (viewMode === 'grid' && gridHost) {
      gridHost.innerHTML = items.map((item) => {
        const type = fileTypeOf(item.name, item.isDirectory);
        const active = item.name === selectedName ? ' active' : '';
        const actions = item.isDirectory
          ? '<button class="cup-btn ghost" data-open="' + item.name + '">打开</button>'
          : '<button class="cup-btn ghost" data-download="' + item.name + '">下载</button>'
            + '<button class="cup-btn ghost" data-rename="' + item.name + '" data-role-admin>重命名</button>'
            + '<button class="cup-btn ghost" data-delete="' + item.name + '" data-role-admin>删除</button>';
        return (
          '<div class="cup-card' + active + '" data-name="' + item.name + '" data-dir="' + (item.isDirectory ? '1' : '0') + '">'
          + '<div class="thumb ' + iconClass(type) + '">' + iconText(type) + '</div>'
          + '<strong title="' + item.name + '">' + item.name + '</strong>'
          + '<span>' + (item.isDirectory ? '文件夹' : typeLabel(type) + ' · ' + formatSize(item.size)) + '</span>'
          + '<div class="actions">' + actions + '</div>'
          + '</div>'
        );
      }).join('') || '<div class="cup-empty"><h3>当前目录为空</h3><p>可以新建文件夹或上传文件。</p></div>';
    }

    if (listHost) {
      // cup list container may itself be the host
      const useCupRows = listHost.classList.contains('cup-list') || listHost.tagName !== 'TBODY';
      if (useCupRows) {
        listHost.innerHTML = items.map((item) => {
          const type = fileTypeOf(item.name, item.isDirectory);
          const active = item.name === selectedName ? ' active' : '';
          const actions = item.isDirectory
            ? '<button class="cup-btn ghost" data-open="' + item.name + '">打开</button>'
            : '<button class="cup-btn ghost" data-download="' + item.name + '">下载</button>'
              + '<button class="cup-btn ghost" data-rename="' + item.name + '" data-role-admin>重命名</button>'
              + '<button class="cup-btn ghost" data-delete="' + item.name + '" data-role-admin>删除</button>';
          return (
            '<div class="cup-row' + active + '" data-name="' + item.name + '" data-dir="' + (item.isDirectory ? '1' : '0') + '">'
            + '<div class="cup-file-ico ' + iconClass(type) + '">' + iconText(type) + '</div>'
            + '<div><strong>' + item.name + '</strong><span>' + typeLabel(type) + (item.isDirectory ? '' : ' · ' + formatSize(item.size)) + '</span></div>'
            + '<div class="meta">' + (item.updatedAt || '—') + '<div class="actions">' + actions + '</div></div>'
            + '</div>'
          );
        }).join('') || '<div class="cup-empty"><h3>当前目录为空</h3><p>可以新建文件夹或上传文件。</p></div>';
      } else {
        listHost.innerHTML = items.map((item) => {
          const type = fileTypeOf(item.name, item.isDirectory);
          const actions = item.isDirectory
            ? '<button class="btn btn-ghost btn-sm" data-open="' + item.name + '">打开</button>'
            : '<span class="inline-actions">'
              + '<button class="btn btn-ghost btn-sm" data-download="' + item.name + '">下载</button>'
              + '<button class="btn btn-ghost btn-sm" data-rename="' + item.name + '" data-role-admin>重命名</button>'
              + '<button class="btn btn-ghost btn-sm" data-delete="' + item.name + '" data-role-admin>删除</button>'
              + '</span>';
          return '<tr>'
            + '<td><div class="name-cell"><span class="file-icon ' + type + '">' + (item.isDirectory ? 'DIR' : type.slice(0,3).toUpperCase()) + '</span>' + item.name + '</div></td>'
            + '<td>' + typeLabel(type) + '</td>'
            + '<td>' + (item.isDirectory ? '—' : formatSize(item.size)) + '</td>'
            + '<td>' + (item.updatedAt || '—') + '</td>'
            + '<td>' + actions + '</td>'
            + '</tr>';
        }).join('') || '<tr><td colspan="5">当前目录为空</td></tr>';
      }
    }

    // re-apply role visibility
    const role = AppStore.get().session.role;
    $all('[data-role-admin]').forEach((el) => el.classList.toggle('hidden', role !== 'admin'));
    $all('[data-role-member]').forEach((el) => el.classList.toggle('hidden', role !== 'member'));

    const bindActions = (scope) => {
      if (!scope) return;
      scope.querySelectorAll('[data-open]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          AppStore.setPath(joinPath(path, btn.getAttribute('data-open'), true));
          selectedName = null;
          render();
        });
      });
      scope.querySelectorAll('[data-download]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          toast(AppStore.download(btn.getAttribute('data-download')).message);
        });
      });
      scope.querySelectorAll('[data-rename]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const oldName = btn.getAttribute('data-rename');
          const next = prompt('重命名为', oldName);
          if (next == null) return;
          const result = AppStore.renameItem(oldName, next);
          toast(result.message);
          if (result.ok) {
            selectedName = next;
            render();
          }
        });
      });
      scope.querySelectorAll('[data-delete]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const name = btn.getAttribute('data-delete');
          const modal = $('#delete-modal');
          if (modal) {
            modal.dataset.name = name;
            const desc = $('#delete-desc');
            if (desc) desc.textContent = '将删除“' + name + '”。一期没有回收站，请确认。';
            show(modal);
            return;
          }
          if (!confirm('删除 ' + name + '？')) return;
          const result = AppStore.deleteItem(name);
          toast(result.message);
          if (result.ok) {
            selectedName = null;
            render();
          }
        });
      });
      scope.querySelectorAll('.cup-row, .cup-card, .desktop-grid-item').forEach((row) => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          const name = row.getAttribute('data-name');
          const isDir = row.getAttribute('data-dir') === '1';
          const item = items.find((i) => i.name === name);
          if (item) updatePreview(item, path);
          scope.querySelectorAll('.cup-row, .cup-card, .desktop-grid-item').forEach((n) => {
            n.classList.toggle('active', n.getAttribute('data-name') === name);
          });
          if (isDir && e.detail === 2) {
            AppStore.setPath(joinPath(path, name, true));
            selectedName = null;
            render();
          } else if (!isDir && e.detail === 2) {
            toast('预览 ' + name + '（桌面原型示意）');
          }
        });
      });
    };
    bindActions(listHost);
    bindActions(gridHost);
  }

  $all('[data-desktop-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      AppStore.setPath(btn.getAttribute('data-desktop-nav'));
      selectedName = null;
      render();
    });
  });

  const desktopGoUp = $('#desktop-go-up');
  if (desktopGoUp) {
    desktopGoUp.addEventListener('click', () => {
      const path = AppStore.get().currentPath;
      if (path === 'shared/') return;
      AppStore.setPath(parentPath(path));
      selectedName = null;
      render();
    });
  }

  const uploadHandler = () => {
    const result = AppStore.addFiles(['desktop-upload-' + Date.now().toString().slice(-4) + '.pdf']);
    toast(result.message);
    render();
  };
  const uploadBtn = $('#desktop-upload');
  if (uploadBtn) uploadBtn.addEventListener('click', uploadHandler);
  const uploadTop = $('#desktop-upload-top');
  if (uploadTop) uploadTop.addEventListener('click', uploadHandler);

  const refreshBtn = $('#desktop-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', () => { render(); toast('已刷新文件列表'); });

  const mkdirBtn = $('#desktop-mkdir');
  if (mkdirBtn) {
    mkdirBtn.addEventListener('click', () => {
      const modal = $('#mkdir-modal');
      const input = $('#mkdir-input');
      const error = $('#mkdir-error');
      if (!modal || !input) return;
      input.value = '新建文件夹';
      if (error) {
        error.textContent = '';
        error.classList.add('hidden');
      }
      show(modal);
      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    });
  }

  const confirmMkdir = $('#desktop-confirm-mkdir');
  if (confirmMkdir) {
    const submitMkdir = () => {
      const modal = $('#mkdir-modal');
      const input = $('#mkdir-input');
      const error = $('#mkdir-error');
      const name = (input?.value || '').trim();
      if (!name) {
        if (error) {
          error.textContent = '文件夹名不能为空';
          error.classList.remove('hidden');
        }
        return;
      }
      const result = AppStore.createFolder(name);
      if (!result.ok) {
        if (error) {
          error.textContent = result.message;
          error.classList.remove('hidden');
        }
        toast(result.message);
        return;
      }
      hide(modal);
      toast(result.message);
      selectedName = name;
      render();
    };
    confirmMkdir.addEventListener('click', submitMkdir);
    const mkdirInput = $('#mkdir-input');
    if (mkdirInput) {
      mkdirInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitMkdir();
        } else if (e.key === 'Escape') {
          hide($('#mkdir-modal'));
        }
      });
    }
  }

  $all('[data-view-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      AppStore.setViewMode(btn.getAttribute('data-view-mode'));
      render();
      toast(btn.getAttribute('data-view-mode') === 'grid' ? '已切换到缩略图浏览' : '已切换到列表浏览');
    });
  });

  const confirmDelete = $('#desktop-confirm-delete');
  if (confirmDelete) {
    confirmDelete.addEventListener('click', () => {
      const modal = $('#delete-modal');
      const name = modal?.dataset.name;
      hide(modal);
      if (!name) return;
      const result = AppStore.deleteItem(name);
      toast(result.message);
      if (result.ok) {
        selectedName = null;
        render();
      }
    });
  }

  const previewDownload = $('#desktop-preview-download');
  if (previewDownload) {
    previewDownload.addEventListener('click', () => {
      if (!selectedName) return;
      const item = AppStore.findItem(AppStore.get().currentPath, selectedName);
      if (!item || item.isDirectory) {
        toast('只能下载文件');
        return;
      }
      toast(AppStore.download(selectedName).message);
    });
  }

  const previewOpen = $('#desktop-preview-open');
  if (previewOpen) {
    previewOpen.addEventListener('click', () => {
      if (!selectedName) return;
      const path = AppStore.get().currentPath;
      const item = AppStore.findItem(path, selectedName);
      if (!item) return;
      if (item.isDirectory) {
        AppStore.setPath(joinPath(path, selectedName, true));
        selectedName = null;
        render();
        return;
      }
      toast('预览 ' + selectedName + '（桌面原型示意）');
    });
  }

  const previewDelete = $('#desktop-preview-delete');
  if (previewDelete) {
    previewDelete.addEventListener('click', () => {
      if (!selectedName) return;
      const modal = $('#delete-modal');
      if (modal) {
        modal.dataset.name = selectedName;
        const desc = $('#delete-desc');
        if (desc) desc.textContent = '将删除“' + selectedName + '”。一期没有回收站，请确认。';
        show(modal);
      }
    });
  }

  document.addEventListener('pdd:files-updated', render);
  document.addEventListener('pdd:role-updated', render);
  window.addEventListener('resize', () => {
    const title = $('#desktop-path-title');
    if (title) fitPathWithFrontEllipsis(title, AppStore.get().currentPath);
  });
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  bindToggles();
  bindDropzone();
  bindRoleSwitch();
  bindPreviewTabs();
  bindLoginPage();
  bindMobileFilesActions();
  bindTasksPage();
  bindPreviewPage();
  bindSharePage();
  bindStatesPage();
  bindDesktopFilesPage();
});

// export for inline scripts if needed
window.AppStore = AppStore;
window.pddToast = toast;
