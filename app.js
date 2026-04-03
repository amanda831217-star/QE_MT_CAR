const CONFIG = {
  apiUrl: 'https://script.google.com/macros/library/d/1fGFTMbao5va8kVz_rw5gyKNGAxo4faUUPH1M1G8Y9f3HPv8DT-uNqwKC/2',
  userId: 'U001'
};

const state = {
  currentView: 'home',
  equipmentStatus: '',
  equipment: [],
  materials: [],
  vehicles: [],
  my: null
};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();
  setToday();
  await loadHome();
}

function bindEvents() {
  $$('#app [data-nav]').forEach(el => {
    el.addEventListener('click', () => showView(el.dataset.nav));
  });

  $('#refreshBtn').addEventListener('click', async () => {
    if (state.currentView === 'home') await loadHome();
    if (state.currentView === 'equipment') await loadEquipment();
    if (state.currentView === 'materials') await loadMaterials();
    if (state.currentView === 'vehicles') await loadVehicles();
    if (state.currentView === 'my') await loadMy();
  });

  $('#equipmentSearch').addEventListener('input', debounce(loadEquipment, 250));
  $('#materialSearch').addEventListener('input', debounce(loadMaterials, 250));
  $('#vehicleSearch').addEventListener('input', debounce(loadVehicles, 250));
  $('#vehicleDate').addEventListener('change', loadVehicles);

  $$('.chip[data-eq-status]').forEach(chip => {
    chip.addEventListener('click', async () => {
      state.equipmentStatus = chip.dataset.eqStatus;
      $$('.chip[data-eq-status]').forEach(x => x.classList.remove('active'));
      chip.classList.add('active');
      await loadEquipment();
    });
  });

  $('#modalClose').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', e => {
    if (e.target.id === 'modal') closeModal();
  });
}

function setToday() {
  const now = new Date();
  $('#todayText').textContent = now.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  });
  $('#vehicleDate').value = now.toISOString().slice(0, 10);
}

function showView(name) {
  state.currentView = name;

  const map = {
    home: '#homeView',
    equipment: '#equipmentView',
    materials: '#materialsView',
    vehicles: '#vehiclesView',
    my: '#myView'
  };

  $$('.view').forEach(v => v.classList.remove('active'));
  $(map[name]).classList.add('active');

  $$('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === name);
  });

  if (name === 'home') loadHome();
  if (name === 'equipment') loadEquipment();
  if (name === 'materials') loadMaterials();
  if (name === 'vehicles') loadVehicles();
  if (name === 'my') loadMy();
}

async function api(action, payload = {}) {
  if (!CONFIG.apiUrl || CONFIG.apiUrl.includes('PASTE_YOUR_GAS_WEB_APP_URL_HERE')) {
    throw new Error('尚未設定 API 網址');
  }

  const res = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action,
      payload,
      userId: CONFIG.userId
    })
  });

  const raw = await res.text();

  if (!raw) {
    throw new Error('API 無回應');
  }

  if (raw.trim().startsWith('<')) {
    throw new Error('API 回傳 HTML，請確認 GAS 部署網址為 /exec，且權限為 Anyone');
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error('API 回傳格式錯誤，非 JSON');
  }

  if (!json.ok) {
    throw new Error(json.message || '系統處理失敗');
  }

  return json.data;
}

async function loadHome() {
  await withLoading(async () => {
    const data = await api('getDashboard');
    state.my = data.my;

    $('#userName').textContent = CONFIG.userId;
    $('#eqAvailable').textContent = data.summary.equipmentAvailable;
    $('#eqBorrowed').textContent = data.summary.equipmentBorrowed;
    $('#matLow').textContent = data.summary.materialsLow;
    $('#matState').textContent = data.summary.materialsLow > 0 ? '注意' : '正常';
    $('#vhAvailable').textContent = data.summary.vehiclesAvailable;
    $('#vhReserved').textContent = data.summary.vehiclesReserved;

    renderHomeMy(data.my);
  });
}

async function loadEquipment() {
  await withLoading(async () => {
    state.equipment = await api('listEquipment', {
      keyword: $('#equipmentSearch').value.trim(),
      status: state.equipmentStatus
    });
    renderEquipment();
  });
}

async function loadMaterials() {
  await withLoading(async () => {
    state.materials = await api('listMaterials', {
      keyword: $('#materialSearch').value.trim()
    });
    renderMaterials();
  });
}

async function loadVehicles() {
  await withLoading(async () => {
    state.vehicles = await api('listVehicles', {
      keyword: $('#vehicleSearch').value.trim(),
      date: $('#vehicleDate').value
    });
    renderVehicles();
  });
}

async function loadMy() {
  await withLoading(async () => {
    state.my = await api('getMyRecords');
    renderMy(state.my);
  });
}

function renderHomeMy(my) {
  const holder = $('#myActiveList');
  const items = [];

  (my.equipment || []).forEach(x => {
    items.push(`
      <div class="mini-card">
        ${escapeHtml(x.name)}
        <div class="small">預計歸還：${escapeHtml(x.returnDate || '')}</div>
      </div>
    `);
  });

  (my.vehicles || []).slice(0, 3).forEach(x => {
    items.push(`
      <div class="mini-card">
        ${escapeHtml(x.name)}
        <div class="small">${escapeHtml(x.startAt)} → ${escapeHtml(x.endAt)}</div>
      </div>
    `);
  });

  holder.innerHTML = items.length ? items.join('') : `<div class="empty">目前沒有使用中項目</div>`;
}

function renderEquipment() {
  const holder = $('#equipmentList');

  if (!state.equipment.length) {
    holder.innerHTML = `<div class="empty">查無資料</div>`;
    return;
  }

  holder.innerHTML = state.equipment.map(item => `
    <section class="item-card">
      <div class="item-top">
        <div>
          <div class="item-title">${escapeHtml(item.name)}</div>
          <div class="item-sub">${escapeHtml(item.id)} · ${escapeHtml(item.location || '-')}</div>
        </div>
        <span class="badge ${item.status}">${item.status === 'available' ? '可借用' : '借出中'}</span>
      </div>
      ${item.spec ? `<div class="item-sub">${escapeHtml(item.spec)}</div>` : ''}
      ${item.borrower ? `<div class="item-sub">借用人：${escapeHtml(item.borrower)}</div>` : ''}
      ${item.returnDate ? `<div class="item-sub">預計歸還：${escapeHtml(item.returnDate)}</div>` : ''}
      <div class="action-row">
        ${item.status === 'available'
          ? `<button class="btn btn-primary" type="button" onclick='openBorrowEquipment(${jsonAttr(item)})'>借用</button>`
          : `<button class="btn btn-danger" type="button" onclick='openReturnEquipment(${jsonAttr(item)})'>歸還</button>`}
      </div>
    </section>
  `).join('');
}

function renderMaterials() {
  const holder = $('#materialList');

  if (!state.materials.length) {
    holder.innerHTML = `<div class="empty">查無資料</div>`;
    return;
  }

  holder.innerHTML = state.materials.map(item => `
    <section class="item-card">
      <div class="item-top">
        <div>
          <div class="item-title">${escapeHtml(item.name)}</div>
          <div class="item-sub">${escapeHtml(item.category || '-')} · ${escapeHtml(item.location || '-')}</div>
        </div>
        <span class="badge ${item.status}">${materialStatusText(item.status)}</span>
      </div>
      ${item.spec ? `<div class="item-sub">${escapeHtml(item.spec)}</div>` : ''}
      <div class="item-sub">庫存：${escapeHtml(String(item.qty))} ${escapeHtml(item.unit)}</div>
      <div class="action-row">
        <button class="btn btn-primary" type="button" onclick='openIssueMaterial(${jsonAttr(item)})' ${item.qty <= 0 ? 'disabled' : ''}>領用</button>
      </div>
    </section>
  `).join('');
}

function renderVehicles() {
  const holder = $('#vehicleList');

  if (!state.vehicles.length) {
    holder.innerHTML = `<div class="empty">查無資料</div>`;
    return;
  }

  holder.innerHTML = state.vehicles.map(item => `
    <section class="item-card">
      <div class="item-top">
        <div>
          <div class="item-title">${escapeHtml(item.name)}</div>
          <div class="item-sub">${escapeHtml(item.plateNo)} · ${escapeHtml(item.type)}</div>
        </div>
        <span class="badge ${item.reservations.length ? 'partial' : 'available'}">${item.reservations.length ? '已預約' : '可使用'}</span>
      </div>
      <div class="list-stack compact">
        ${item.reservations.length
          ? item.reservations.map(r => `
              <div class="mini-card">
                ${escapeHtml(r.startAt.slice(11,16))} → ${escapeHtml(r.endAt.slice(11,16))} · ${escapeHtml(r.userName)}
                <div class="small">${escapeHtml(r.destination)}</div>
              </div>
            `).join('')
          : `<div class="mini-card">目前無預約</div>`}
      </div>
      <div class="action-row">
        <button class="btn btn-primary" type="button" onclick='openReserveVehicle(${jsonAttr(item)})'>預約</button>
      </div>
    </section>
  `).join('');
}

function renderMy(my) {
  $('#myEquipment').innerHTML = listOrEmpty((my.equipment || []).map(x => `
    <div class="mini-card">
      ${escapeHtml(x.name)}
      <div class="small">預計歸還：${escapeHtml(x.returnDate || '')}</div>
    </div>
  `));

  $('#myMaterials').innerHTML = listOrEmpty((my.materials || []).map(x => `
    <div class="mini-card">
      ${escapeHtml(x.name)} · ${escapeHtml(String(x.qty))} ${escapeHtml(x.unit)}
      <div class="small">${escapeHtml(x.createdAt || '')}</div>
    </div>
  `));

  $('#myVehicles').innerHTML = listOrEmpty((my.vehicles || []).map(x => `
    <div class="mini-card">
      ${escapeHtml(x.name)}
      <div class="small">${escapeHtml(x.startAt)} → ${escapeHtml(x.endAt)}</div>
    </div>
  `));
}

function listOrEmpty(items) {
  return items.length ? items.join('') : `<div class="empty">查無資料</div>`;
}

function openBorrowEquipment(item) {
  openModal(`借用 · ${item.name}`, `
    <div class="field">
      <div class="label">預計歸還日</div>
      <input id="eqReturnDate" class="input" type="date">
    </div>
    <div class="field">
      <div class="label">備註</div>
      <textarea id="eqNote" class="textarea"></textarea>
    </div>
    <div class="action-row">
      <button class="btn btn-primary" type="button" id="eqBorrowConfirm">確認借用</button>
    </div>
  `);

  $('#eqReturnDate').value = new Date().toISOString().slice(0, 10);

  $('#eqBorrowConfirm').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('borrowEquipment', {
        rowNumber: item.rowNumber,
        returnDate: $('#eqReturnDate').value,
        note: $('#eqNote').value.trim()
      });
      toast('操作成功');
      closeModal();
      await loadEquipment();
      await loadHome();
    });
  });
}

function openReturnEquipment(item) {
  openModal(`歸還 · ${item.name}`, `
    <div class="field">
      <div class="label">備註</div>
      <textarea id="eqReturnNote" class="textarea"></textarea>
    </div>
    <div class="action-row">
      <button class="btn btn-danger" type="button" id="eqReturnConfirm">確認歸還</button>
    </div>
  `);

  $('#eqReturnConfirm').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('returnEquipment', {
        rowNumber: item.rowNumber,
        note: $('#eqReturnNote').value.trim()
      });
      toast('操作成功');
      closeModal();
      await loadEquipment();
      await loadHome();
    });
  });
}

function openIssueMaterial(item) {
  openModal(`領用 · ${item.name}`, `
    <div class="field">
      <div class="label">數量</div>
      <input id="matQty" class="input" type="number" min="1" step="1" value="1">
    </div>
    <div class="field">
      <div class="label">用途</div>
      <input id="matPurpose" class="input">
    </div>
    <div class="field">
      <div class="label">備註</div>
      <textarea id="matNote" class="textarea"></textarea>
    </div>
    <div class="action-row">
      <button class="btn btn-primary" type="button" id="matIssueConfirm">確認領用</button>
    </div>
  `);

  $('#matIssueConfirm').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('issueMaterial', {
        rowNumber: item.rowNumber,
        qty: Number($('#matQty').value),
        purpose: $('#matPurpose').value.trim(),
        note: $('#matNote').value.trim()
      });
      toast('操作成功');
      closeModal();
      await loadMaterials();
      await loadHome();
      if (state.currentView === 'my') await loadMy();
    });
  });
}

function openReserveVehicle(item) {
  const date = $('#vehicleDate').value || new Date().toISOString().slice(0, 10);

  openModal(`預約 · ${item.name}`, `
    <div class="field">
      <div class="label">駕駛人</div>
      <input id="vhDriver" class="input">
    </div>
    <div class="field">
      <div class="label">用途</div>
      <select id="vhPurpose" class="select">
        <option value="現場巡檢">現場巡檢</option>
        <option value="材料運送">材料運送</option>
        <option value="會勘會議">會勘會議</option>
      </select>
    </div>
    <div class="field">
      <div class="label">目的地</div>
      <input id="vhDestination" class="input">
    </div>
    <div class="field">
      <div class="label">開始時間</div>
      <input id="vhStart" class="input" type="datetime-local" value="${date}T08:00">
    </div>
    <div class="field">
      <div class="label">結束時間</div>
      <input id="vhEnd" class="input" type="datetime-local" value="${date}T12:00">
    </div>
    <div class="field">
      <div class="label">備註</div>
      <textarea id="vhNote" class="textarea"></textarea>
    </div>
    <div class="action-row">
      <button class="btn btn-primary" type="button" id="vhReserveConfirm">確認預約</button>
    </div>
  `);

  $('#vhReserveConfirm').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('reserveVehicle', {
        vehicleId: item.id,
        driverName: $('#vhDriver').value.trim(),
        purpose: $('#vhPurpose').value,
        destination: $('#vhDestination').value.trim(),
        startAt: $('#vhStart').value,
        endAt: $('#vhEnd').value,
        note: $('#vhNote').value.trim()
      });
      toast('操作成功');
      closeModal();
      await loadVehicles();
      await loadHome();
      if (state.currentView === 'my') await loadMy();
    });
  });
}

function openModal(title, body) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  $('#modal').classList.remove('hidden');
}

function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modalBody').innerHTML = '';
}

async function submitButton(btn, fn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '處理中...';

  try {
    await withLoading(fn);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function withLoading(fn) {
  try {
    $('#loading').classList.remove('hidden');
    await fn();
  } catch (err) {
    toast(err.message || '系統錯誤');
    throw err;
  } finally {
    $('#loading').classList.add('hidden');
  }
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    el.classList.add('hidden');
  }, 2600);
}

function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function materialStatusText(status) {
  if (status === 'low') return '低庫存';
  if (status === 'out') return '缺料';
  return '正常';
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, s => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[s]);
}

function jsonAttr(obj) {
  return JSON.stringify(obj).replace(/"/g, '&quot;');
}
