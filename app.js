const API_URL = 'https://script.google.com/macros/s/AKfycbwarTXauF6qF4Q27XaRzlRF71amQ55VKAO49WHaqhoTuzr3NX-pYTPPu47JyiACHhUr/exec';

const state = {
  currentView: 'home',
  equipmentStatus: '',
  equipment: [],
  materials: [],
  vehicles: [],
  adminTab: 'vehicles',
  equipmentLogs: [],
  materialLogs: [],
  vehicleLogs: []
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
    await refreshCurrentView();
  });

  $('#equipmentSearch').addEventListener('input', debounce(loadEquipment, 250));
  $('#materialSearch').addEventListener('input', debounce(loadMaterials, 250));
  $('#vehicleSearch').addEventListener('input', debounce(loadVehicles, 250));

  $$('.chip[data-eq-status]').forEach(chip => {
    chip.addEventListener('click', async () => {
      state.equipmentStatus = chip.dataset.eqStatus;
      $$('.chip[data-eq-status]').forEach(x => x.classList.remove('active'));
      chip.classList.add('active');
      await loadEquipment();
    });
  });

  $$('.chip[data-admin-tab]').forEach(chip => {
    chip.addEventListener('click', async () => {
      state.adminTab = chip.dataset.adminTab;
      $$('.chip[data-admin-tab]').forEach(x => x.classList.remove('active'));
      chip.classList.add('active');
      showAdminTab(state.adminTab);
      await loadAdminTab(state.adminTab);
    });
  });

  $('#addVehicleBtn').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('addVehicle', {
        name: $('#addVehicleName').value.trim(),
        plateNo: $('#addVehiclePlate').value.trim(),
        type: $('#addVehicleType').value.trim(),
        location: $('#addVehicleLocation').value.trim(),
        note: $('#addVehicleNote').value.trim()
      });
      toast('新增車輛成功');
      clearAddVehicleForm();
      await loadVehicles();
      await loadAdminTab('vehicles');
      await loadHome();
    });
  });

  $('#adminVehicleLogSearch').addEventListener('input', debounce(() => loadAdminTab('vehicleLogs'), 250));
  $('#adminEquipmentLogSearch').addEventListener('input', debounce(() => loadAdminTab('equipmentLogs'), 250));
  $('#adminMaterialLogSearch').addEventListener('input', debounce(() => loadAdminTab('materialLogs'), 250));
  $('#adminMaterialStockSearch').addEventListener('input', debounce(() => loadAdminTab('materialStock'), 250));

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
}

function showView(name) {
  state.currentView = name;

  const map = {
    home: '#homeView',
    equipment: '#equipmentView',
    materials: '#materialsView',
    vehicles: '#vehiclesView',
    admin: '#adminView'
  };

  $$('.view').forEach(v => v.classList.remove('active'));
  $(map[name]).classList.add('active');

  $$('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === name);
  });

  refreshCurrentView();
}

async function refreshCurrentView() {
  if (state.currentView === 'home') await loadHome();
  if (state.currentView === 'equipment') await loadEquipment();
  if (state.currentView === 'materials') await loadMaterials();
  if (state.currentView === 'vehicles') await loadVehicles();
  if (state.currentView === 'admin') {
    showAdminTab(state.adminTab);
    await loadAdminTab(state.adminTab);
  }
}

async function api(action, payload = {}) {
  if (!API_URL || !API_URL.includes('/exec')) {
    throw new Error('API 網址未設定正確');
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({ action, payload })
  });

  const raw = await res.text();

  if (!raw) throw new Error('API 無回應');

  if (raw.trim().startsWith('<')) {
    throw new Error('API 回傳 HTML，請確認 GAS 已部署為 /exec，且權限為 Anyone');
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

    $('#eqAvailable').textContent = data.summary.equipmentAvailable ?? 0;
    $('#eqBorrowed').textContent = data.summary.equipmentBorrowed ?? 0;
    $('#matLow').textContent = data.summary.materialsLow ?? 0;
    $('#matOut').textContent = data.summary.materialsOut ?? 0;
    $('#vhAvailable').textContent = data.summary.vehiclesAvailable ?? 0;
    $('#vhReserved').textContent = data.summary.vehiclesReservedToday ?? 0;
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
      keyword: $('#vehicleSearch').value.trim()
    });
    renderVehicles();
  });
}

function showAdminTab(tab) {
  $$('.admin-tab').forEach(el => el.classList.remove('active'));
  if (tab === 'vehicles') $('#adminVehiclesTab').classList.add('active');
  if (tab === 'vehicleLogs') $('#adminVehicleLogsTab').classList.add('active');
  if (tab === 'equipmentLogs') $('#adminEquipmentLogsTab').classList.add('active');
  if (tab === 'materialLogs') $('#adminMaterialLogsTab').classList.add('active');
  if (tab === 'materialStock') $('#adminMaterialStockTab').classList.add('active');
}

async function loadAdminTab(tab) {
  if (tab === 'vehicles') return;

  if (tab === 'vehicleLogs') {
    await withLoading(async () => {
      state.vehicleLogs = await api('listVehicleLogs', {
        keyword: $('#adminVehicleLogSearch').value.trim()
      });
      renderAdminVehicleLogs();
    });
  }

  if (tab === 'equipmentLogs') {
    await withLoading(async () => {
      state.equipmentLogs = await api('listEquipmentLogs', {
        keyword: $('#adminEquipmentLogSearch').value.trim()
      });
      renderAdminEquipmentLogs();
    });
  }

  if (tab === 'materialLogs') {
    await withLoading(async () => {
      state.materialLogs = await api('listMaterialLogs', {
        keyword: $('#adminMaterialLogSearch').value.trim()
      });
      renderAdminMaterialLogs();
    });
  }

  if (tab === 'materialStock') {
    await withLoading(async () => {
      state.materials = await api('listMaterials', {
        keyword: $('#adminMaterialStockSearch').value.trim()
      });
      renderAdminMaterialStock();
    });
  }
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
      <div class="item-sub">庫存：${escapeHtml(String(item.qty))} ${escapeHtml(item.unit)} ｜ 安全庫存：${escapeHtml(String(item.safeQty))}</div>
      <div class="item-sub">補料狀態：${escapeHtml(item.restockStatus || '未設定')}</div>
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

  holder.innerHTML = state.vehicles.map(item => {
    const active = item.activeReservation;
    const badgeClass = item.currentStatus === 'disabled'
      ? 'disabled'
      : item.currentStatus === 'borrowed'
        ? 'borrowed'
        : 'available';
    const badgeText = item.currentStatus === 'disabled'
      ? '停用'
      : item.currentStatus === 'borrowed'
        ? '借用中'
        : '可使用';

    return `
      <section class="item-card">
        <div class="item-top">
          <div>
            <div class="item-title">${escapeHtml(item.name)}</div>
            <div class="item-sub">${escapeHtml(item.plateNo)} · ${escapeHtml(item.type)} · ${escapeHtml(item.location || '-')}</div>
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>

        ${active ? `
          <div class="item-sub">申請人：${escapeHtml(active.applicant)}</div>
          <div class="item-sub">駕駛人：${escapeHtml(active.driver)}</div>
          <div class="item-sub">期間：${escapeHtml(active.startAt)} → ${escapeHtml(active.endAt)}</div>
          <div class="item-sub">用途：${escapeHtml(active.purpose || '-')} ｜ 目的地：${escapeHtml(active.destination || '-')}</div>
        ` : `
          <div class="item-sub">目前無有效借用，可預約。</div>
        `}

        <div class="action-row">
          <button class="btn btn-primary" type="button" onclick='openReserveVehicle(${jsonAttr(item)})' ${item.currentStatus !== 'available' ? 'disabled' : ''}>預約</button>
        </div>
      </section>
    `;
  }).join('');
}

function renderAdminVehicleLogs() {
  const holder = $('#adminVehicleLogs');

  if (!state.vehicleLogs.length) {
    holder.innerHTML = `<div class="empty">查無紀錄</div>`;
    return;
  }

  holder.innerHTML = state.vehicleLogs.map(item => `
    <section class="item-card">
      <div class="item-top">
        <div>
          <div class="item-title">${escapeHtml(item.vehicleName)} (${escapeHtml(item.vehicleId)})</div>
          <div class="item-sub">${escapeHtml(item.startAt)} → ${escapeHtml(item.endAt)}</div>
        </div>
        <span class="badge ${vehicleLogBadge(item.status)}">${escapeHtml(item.status)}</span>
      </div>
      <div class="item-sub">申請人：${escapeHtml(item.applicant)} ｜ 駕駛人：${escapeHtml(item.driver)}</div>
      <div class="item-sub">用途：${escapeHtml(item.purpose)} ｜ 目的地：${escapeHtml(item.destination)}</div>
      <div class="item-sub">備註：${escapeHtml(item.note || '-')}</div>
      <div class="action-row">
        <button class="btn btn-secondary" type="button" onclick='openEditVehicleReservation(${jsonAttr(item)})'>修改</button>
        ${item.status !== '已取消' ? `<button class="btn btn-danger" type="button" onclick='cancelVehicleReservation(${item.rowNumber})'>取消</button>` : ''}
      </div>
    </section>
  `).join('');
}

function renderAdminEquipmentLogs() {
  const holder = $('#adminEquipmentLogs');

  if (!state.equipmentLogs.length) {
    holder.innerHTML = `<div class="empty">查無紀錄</div>`;
    return;
  }

  holder.innerHTML = state.equipmentLogs.map(item => `
    <section class="item-card">
      <div class="item-top">
        <div>
          <div class="item-title">${escapeHtml(item.name)} (${escapeHtml(item.assetId)})</div>
          <div class="item-sub">申請人：${escapeHtml(item.applicant)} ｜ 動作：${escapeHtml(item.action)}</div>
        </div>
        <span class="badge ${item.action === 'borrow' ? 'partial' : 'done'}">${item.action === 'borrow' ? '借用' : '歸還'}</span>
      </div>
      <div class="item-sub">借出日：${escapeHtml(item.borrowDate || '-')} ｜ 預計歸還：${escapeHtml(item.dueDate || '-')}</div>
      <div class="item-sub">實際歸還：${escapeHtml(item.returnDate || '-')}</div>
      <div class="item-sub">備註：${escapeHtml(item.note || '-')}</div>
    </section>
  `).join('');
}

function renderAdminMaterialLogs() {
  const holder = $('#adminMaterialLogs');

  if (!state.materialLogs.length) {
    holder.innerHTML = `<div class="empty">查無紀錄</div>`;
    return;
  }

  holder.innerHTML = state.materialLogs.map(item => `
    <section class="item-card">
      <div class="item-top">
        <div>
          <div class="item-title">${escapeHtml(item.name)}</div>
          <div class="item-sub">申請人：${escapeHtml(item.applicant)} ｜ 類別：${escapeHtml(item.category)}</div>
        </div>
        <span class="badge normal">${escapeHtml(String(item.qty))} ${escapeHtml(item.unit)}</span>
      </div>
      <div class="item-sub">用途：${escapeHtml(item.purpose || '-')}</div>
      <div class="item-sub">備註：${escapeHtml(item.note || '-')}</div>
      <div class="item-sub">建立時間：${escapeHtml(item.createdAt || '-')}</div>
    </section>
  `).join('');
}

function renderAdminMaterialStock() {
  const holder = $('#adminMaterialStockList');

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
      <div class="item-sub">目前庫存：${escapeHtml(String(item.qty))} ${escapeHtml(item.unit)} ｜ 安全庫存：${escapeHtml(String(item.safeQty))}</div>
      <div class="item-sub">補料狀態：${escapeHtml(item.restockStatus || '-')}</div>
      <div class="action-row">
        <button class="btn btn-secondary" type="button" onclick='openEditMaterialStock(${jsonAttr(item)})'>調整</button>
      </div>
    </section>
  `).join('');
}

function openBorrowEquipment(item) {
  openModal(`借用 · ${item.name}`, `
    <div class="field">
      <div class="label">借用人</div>
      <input id="eqBorrower" class="input">
    </div>
    <div class="field">
      <div class="label">預計歸還日</div>
      <input id="eqReturnDate" class="input" type="date">
    </div>
    <div class="field">
      <div class="label">備註</div>
      <textarea id="eqNote" class="textarea"></textarea>
    </div>
    <div class="action-row">
      <button id="eqBorrowConfirm" class="btn btn-primary" type="button">確認借用</button>
    </div>
  `);

  $('#eqReturnDate').value = new Date().toISOString().slice(0, 10);

  $('#eqBorrowConfirm').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('borrowEquipment', {
        rowNumber: item.rowNumber,
        borrower: $('#eqBorrower').value.trim(),
        returnDate: $('#eqReturnDate').value,
        note: $('#eqNote').value.trim()
      });
      toast('借用成功');
      closeModal();
      await loadEquipment();
      await loadHome();
    });
  });
}

function openReturnEquipment(item) {
  openModal(`歸還 · ${item.name}`, `
    <div class="field">
      <div class="label">歸還人</div>
      <input id="eqReturner" class="input">
    </div>
    <div class="field">
      <div class="label">備註</div>
      <textarea id="eqReturnNote" class="textarea"></textarea>
    </div>
    <div class="action-row">
      <button id="eqReturnConfirm" class="btn btn-danger" type="button">確認歸還</button>
    </div>
  `);

  $('#eqReturnConfirm').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('returnEquipment', {
        rowNumber: item.rowNumber,
        returner: $('#eqReturner').value.trim(),
        note: $('#eqReturnNote').value.trim()
      });
      toast('歸還成功');
      closeModal();
      await loadEquipment();
      await loadHome();
    });
  });
}

function openIssueMaterial(item) {
  openModal(`領用 · ${item.name}`, `
    <div class="field">
      <div class="label">領用人</div>
      <input id="matApplicant" class="input">
    </div>
    <div class="field">
      <div class="label">領用數量</div>
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
      <button id="matIssueConfirm" class="btn btn-primary" type="button">確認領用</button>
    </div>
  `);

  $('#matIssueConfirm').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('issueMaterial', {
        rowNumber: item.rowNumber,
        applicant: $('#matApplicant').value.trim(),
        qty: Number($('#matQty').value),
        purpose: $('#matPurpose').value.trim(),
        note: $('#matNote').value.trim()
      });
      toast('領用成功');
      closeModal();
      await loadMaterials();
      await loadHome();
      if (state.currentView === 'admin' && state.adminTab === 'materialStock') {
        await loadAdminTab('materialStock');
      }
    });
  });
}

function openReserveVehicle(item) {
  openModal(`預約 · ${item.name}`, `
    <div class="field">
      <div class="label">申請人</div>
      <input id="vhApplicant" class="input">
    </div>
    <div class="field">
      <div class="label">駕駛人</div>
      <input id="vhDriver" class="input">
    </div>
    <div class="field">
      <div class="label">用途</div>
      <input id="vhPurpose" class="input">
    </div>
    <div class="field">
      <div class="label">目的地</div>
      <input id="vhDestination" class="input">
    </div>
    <div class="field">
      <div class="label">開始時間</div>
      <input id="vhStart" class="input" type="datetime-local">
    </div>
    <div class="field">
      <div class="label">結束時間</div>
      <input id="vhEnd" class="input" type="datetime-local">
    </div>
    <div class="field">
      <div class="label">備註</div>
      <textarea id="vhNote" class="textarea"></textarea>
    </div>
    <div class="action-row">
      <button id="vhReserveConfirm" class="btn btn-primary" type="button">確認預約</button>
    </div>
  `);

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);
  $('#vhStart').value = toDatetimeLocal(start);
  $('#vhEnd').value = toDatetimeLocal(end);

  $('#vhReserveConfirm').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('reserveVehicle', {
        vehicleId: item.id,
        applicant: $('#vhApplicant').value.trim(),
        driver: $('#vhDriver').value.trim(),
        purpose: $('#vhPurpose').value.trim(),
        destination: $('#vhDestination').value.trim(),
        startAt: $('#vhStart').value,
        endAt: $('#vhEnd').value,
        note: $('#vhNote').value.trim()
      });
      toast('預約成功');
      closeModal();
      await loadVehicles();
      await loadHome();
      if (state.currentView === 'admin' && state.adminTab === 'vehicleLogs') {
        await loadAdminTab('vehicleLogs');
      }
    });
  });
}

function openEditVehicleReservation(item) {
  openModal(`修改預約 · ${item.vehicleName || item.vehicleId}`, `
    <div class="field">
      <div class="label">申請人</div>
      <input id="editVhApplicant" class="input" value="${escapeAttr(item.applicant)}">
    </div>
    <div class="field">
      <div class="label">駕駛人</div>
      <input id="editVhDriver" class="input" value="${escapeAttr(item.driver)}">
    </div>
    <div class="field">
      <div class="label">用途</div>
      <input id="editVhPurpose" class="input" value="${escapeAttr(item.purpose)}">
    </div>
    <div class="field">
      <div class="label">目的地</div>
      <input id="editVhDestination" class="input" value="${escapeAttr(item.destination)}">
    </div>
    <div class="field">
      <div class="label">開始時間</div>
      <input id="editVhStart" class="input" type="datetime-local" value="${item.startAt}">
    </div>
    <div class="field">
      <div class="label">結束時間</div>
      <input id="editVhEnd" class="input" type="datetime-local" value="${item.endAt}">
    </div>
    <div class="field">
      <div class="label">狀態</div>
      <select id="editVhStatus" class="select">
        <option value="預約中" ${item.status === '預約中' ? 'selected' : ''}>預約中</option>
        <option value="已完成" ${item.status === '已完成' ? 'selected' : ''}>已完成</option>
        <option value="已取消" ${item.status === '已取消' ? 'selected' : ''}>已取消</option>
      </select>
    </div>
    <div class="field">
      <div class="label">備註</div>
      <textarea id="editVhNote" class="textarea">${escapeHtml(item.note || '')}</textarea>
    </div>
    <div class="action-row">
      <button id="editVhConfirm" class="btn btn-primary" type="button">確認修改</button>
    </div>
  `);

  $('#editVhConfirm').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('updateVehicleReservation', {
        rowNumber: item.rowNumber,
        applicant: $('#editVhApplicant').value.trim(),
        driver: $('#editVhDriver').value.trim(),
        purpose: $('#editVhPurpose').value.trim(),
        destination: $('#editVhDestination').value.trim(),
        startAt: $('#editVhStart').value,
        endAt: $('#editVhEnd').value,
        status: $('#editVhStatus').value,
        note: $('#editVhNote').value.trim()
      });
      toast('修改成功');
      closeModal();
      await loadAdminTab('vehicleLogs');
      await loadVehicles();
      await loadHome();
    });
  });
}

async function cancelVehicleReservation(rowNumber) {
  if (!confirm('確定要取消這筆預約嗎？')) return;

  await withLoading(async () => {
    await api('cancelVehicleReservation', { rowNumber });
    toast('已取消預約');
    await loadAdminTab('vehicleLogs');
    await loadVehicles();
    await loadHome();
  });
}

function openEditMaterialStock(item) {
  openModal(`材料調整 · ${item.name}`, `
    <div class="field">
      <div class="label">數量</div>
      <input id="editMatQty" class="input" type="number" min="0" step="1" value="${item.qty}">
    </div>
    <div class="field">
      <div class="label">安全庫存</div>
      <input id="editMatSafeQty" class="input" type="number" min="0" step="1" value="${item.safeQty}">
    </div>
    <div class="field">
      <div class="label">補料狀態</div>
      <select id="editMatRestockStatus" class="select">
        <option value="未補" ${item.restockStatus === '未補' ? 'selected' : ''}>未補</option>
        <option value="補料中" ${item.restockStatus === '補料中' ? 'selected' : ''}>補料中</option>
        <option value="已補" ${item.restockStatus === '已補' ? 'selected' : ''}>已補</option>
      </select>
    </div>
    <div class="field">
      <div class="label">備註</div>
      <textarea id="editMatNote" class="textarea">${escapeHtml(item.note || '')}</textarea>
    </div>
    <div class="action-row">
      <button id="editMatConfirm" class="btn btn-primary" type="button">確認調整</button>
    </div>
  `);

  $('#editMatConfirm').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('updateMaterialStock', {
        rowNumber: item.rowNumber,
        qty: Number($('#editMatQty').value),
        safeQty: Number($('#editMatSafeQty').value),
        restockStatus: $('#editMatRestockStatus').value,
        note: $('#editMatNote').value.trim()
      });
      toast('材料調整成功');
      closeModal();
      await loadAdminTab('materialStock');
      await loadMaterials();
      await loadHome();
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

function clearAddVehicleForm() {
  $('#addVehicleName').value = '';
  $('#addVehiclePlate').value = '';
  $('#addVehicleType').value = '';
  $('#addVehicleLocation').value = '';
  $('#addVehicleNote').value = '';
}

function toDatetimeLocal(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  toast._timer = setTimeout(() => el.classList.add('hidden'), 2600);
}

function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function materialStatusText(status) {
  if (status === 'none') return '不控管';
  if (status === 'low') return '低庫存';
  if (status === 'out') return '缺料';
  return '正常';
}

function vehicleLogBadge(status) {
  if (status === '已取消') return 'cancel';
  if (status === '已完成') return 'done';
  return 'active';
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

function escapeAttr(v) {
  return String(v ?? '').replace(/"/g, '&quot;');
}

function jsonAttr(obj) {
  return JSON.stringify(obj).replace(/"/g, '&quot;');
}
