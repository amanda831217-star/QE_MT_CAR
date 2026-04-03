const CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbz9maswBLw__mdsxTAqqgtiizCLO4AJSFviaP9xKo3JB-DXFHWAAUF3fjaS-8uRalHc5Q/exec',
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
  $('#todayText').textContent = now.toLocaleDateString(undefined, {
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
    throw new Error('Missing apiUrl');
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

  const json = await res.json();
  if (!json.ok) throw new Error(json.message || 'Request failed');
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
    $('#matState').textContent = data.summary.materialsLow > 0 ? 'Check' : 'Good';
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
        <div class="small">${escapeHtml(x.returnDate || '')}</div>
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

  holder.innerHTML = items.length ? items.join('') : `<div class="empty">No active items</div>`;
}

function renderEquipment() {
  const holder = $('#equipmentList');

  if (!state.equipment.length) {
    holder.innerHTML = `<div class="empty">No data</div>`;
    return;
  }

  holder.innerHTML = state.equipment.map(item => `
    <section class="item-card">
      <div class="item-top">
        <div>
          <div class="item-title">${escapeHtml(item.name)}</div>
          <div class="item-sub">${escapeHtml(item.id)} · ${escapeHtml(item.location || '-')}</div>
        </div>
        <span class="badge ${item.status}">${escapeHtml(item.status)}</span>
      </div>
      ${item.spec ? `<div class="item-sub">${escapeHtml(item.spec)}</div>` : ''}
      ${item.borrower ? `<div class="item-sub">Borrower: ${escapeHtml(item.borrower)}</div>` : ''}
      ${item.returnDate ? `<div class="item-sub">Return: ${escapeHtml(item.returnDate)}</div>` : ''}
      <div class="action-row">
        ${item.status === 'available'
          ? `<button class="btn btn-primary" type="button" onclick='openBorrowEquipment(${jsonAttr(item)})'>Borrow</button>`
          : `<button class="btn btn-danger" type="button" onclick='openReturnEquipment(${jsonAttr(item)})'>Return</button>`}
      </div>
    </section>
  `).join('');
}

function renderMaterials() {
  const holder = $('#materialList');

  if (!state.materials.length) {
    holder.innerHTML = `<div class="empty">No data</div>`;
    return;
  }

  holder.innerHTML = state.materials.map(item => `
    <section class="item-card">
      <div class="item-top">
        <div>
          <div class="item-title">${escapeHtml(item.name)}</div>
          <div class="item-sub">${escapeHtml(item.category || '-')} · ${escapeHtml(item.location || '-')}</div>
        </div>
        <span class="badge ${item.status}">${escapeHtml(item.status)}</span>
      </div>
      ${item.spec ? `<div class="item-sub">${escapeHtml(item.spec)}</div>` : ''}
      <div class="item-sub">Stock: ${escapeHtml(String(item.qty))} ${escapeHtml(item.unit)}</div>
      <div class="action-row">
        <button class="btn btn-primary" type="button" onclick='openIssueMaterial(${jsonAttr(item)})' ${item.qty <= 0 ? 'disabled' : ''}>Issue</button>
      </div>
    </section>
  `).join('');
}

function renderVehicles() {
  const holder = $('#vehicleList');

  if (!state.vehicles.length) {
    holder.innerHTML = `<div class="empty">No data</div>`;
    return;
  }

  holder.innerHTML = state.vehicles.map(item => `
    <section class="item-card">
      <div class="item-top">
        <div>
          <div class="item-title">${escapeHtml(item.name)}</div>
          <div class="item-sub">${escapeHtml(item.plateNo)} · ${escapeHtml(item.type)}</div>
        </div>
        <span class="badge ${item.reservations.length ? 'partial' : 'available'}">${item.reservations.length ? 'reserved' : 'available'}</span>
      </div>
      <div class="list-stack compact">
        ${item.reservations.length
          ? item.reservations.map(r => `
              <div class="mini-card">
                ${escapeHtml(r.startAt.slice(11,16))} → ${escapeHtml(r.endAt.slice(11,16))} · ${escapeHtml(r.userName)}
                <div class="small">${escapeHtml(r.destination)}</div>
              </div>
            `).join('')
          : `<div class="mini-card">No reservations</div>`}
      </div>
      <div class="action-row">
        <button class="btn btn-primary" type="button" onclick='openReserveVehicle(${jsonAttr(item)})'>Reserve</button>
      </div>
    </section>
  `).join('');
}

function renderMy(my) {
  $('#myEquipment').innerHTML = listOrEmpty((my.equipment || []).map(x => `
    <div class="mini-card">
      ${escapeHtml(x.name)}
      <div class="small">${escapeHtml(x.returnDate || '')}</div>
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
  return items.length ? items.join('') : `<div class="empty">No data</div>`;
}

function openBorrowEquipment(item) {
  openModal(`Borrow · ${item.name}`, `
    <div class="field">
      <div class="label">Return date</div>
      <input id="eqReturnDate" class="input" type="date">
    </div>
    <div class="field">
      <div class="label">Note</div>
      <textarea id="eqNote" class="textarea"></textarea>
    </div>
    <div class="action-row">
      <button class="btn btn-primary" type="button" id="eqBorrowConfirm">Confirm</button>
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
      toast('Success');
      closeModal();
      await loadEquipment();
      await loadHome();
    });
  });
}

function openReturnEquipment(item) {
  openModal(`Return · ${item.name}`, `
    <div class="field">
      <div class="label">Note</div>
      <textarea id="eqReturnNote" class="textarea"></textarea>
    </div>
    <div class="action-row">
      <button class="btn btn-danger" type="button" id="eqReturnConfirm">Confirm</button>
    </div>
  `);

  $('#eqReturnConfirm').addEventListener('click', async e => {
    await submitButton(e.currentTarget, async () => {
      await api('returnEquipment', {
        rowNumber: item.rowNumber,
        note: $('#eqReturnNote').value.trim()
      });
      toast('Success');
      closeModal();
      await loadEquipment();
      await loadHome();
    });
  });
}

function openIssueMaterial(item) {
  openModal(`Issue · ${item.name}`, `
    <div class="field">
      <div class="label">Quantity</div>
      <input id="matQty" class="input" type="number" min="1" step="1" value="1">
    </div>
    <div class="field">
      <div class="label">Purpose</div>
      <input id="matPurpose" class="input">
    </div>
    <div class="field">
      <div class="label">Note</div>
      <textarea id="matNote" class="textarea"></textarea>
    </div>
    <div class="action-row">
      <button class="btn btn-primary" type="button" id="matIssueConfirm">Confirm</button>
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
      toast('Success');
      closeModal();
      await loadMaterials();
      await loadHome();
      if (state.currentView === 'my') await loadMy();
    });
  });
}

function openReserveVehicle(item) {
  const date = $('#vehicleDate').value || new Date().toISOString().slice(0, 10);

  openModal(`Reserve · ${item.name}`, `
    <div class="field">
      <div class="label">Driver</div>
      <input id="vhDriver" class="input">
    </div>
    <div class="field">
      <div class="label">Purpose</div>
      <select id="vhPurpose" class="select">
        <option value="Site Visit">Site Visit</option>
        <option value="Material Delivery">Material Delivery</option>
        <option value="Meeting">Meeting</option>
      </select>
    </div>
    <div class="field">
      <div class="label">Destination</div>
      <input id="vhDestination" class="input">
    </div>
    <div class="field">
      <div class="label">Start</div>
      <input id="vhStart" class="input" type="datetime-local" value="${date}T08:00">
    </div>
    <div class="field">
      <div class="label">End</div>
      <input id="vhEnd" class="input" type="datetime-local" value="${date}T12:00">
    </div>
    <div class="field">
      <div class="label">Note</div>
      <textarea id="vhNote" class="textarea"></textarea>
    </div>
    <div class="action-row">
      <button class="btn btn-primary" type="button" id="vhReserveConfirm">Confirm</button>
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
      toast('Success');
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
  const text = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Processing';
  try {
    await withLoading(fn);
  } finally {
    btn.disabled = false;
    btn.textContent = text;
  }
}

async function withLoading(fn) {
  try {
    $('#loading').classList.remove('hidden');
    await fn();
  } catch (err) {
    toast(err.message || 'Error');
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
  toast._timer = setTimeout(() => el.classList.add('hidden'), 2200);
}

function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
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
