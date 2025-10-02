// app.js - Lógica de monitoreo de ventas por cuadrillas
(function(){
  const lsKey = 'salesDashboardDataV1';
  const app = document.getElementById('app');
  const squadTpl = document.getElementById('squadTemplate');
  const rowTpl = document.getElementById('rowTemplate');

  const addSquadBtn = document.getElementById('addSquadBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const importPdfInput = document.getElementById('importPdfInput');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const grandTotalEl = document.getElementById('grandTotal');
  // Search inputs
  const searchNumberEl = document.getElementById('searchNumber');
  const searchSellerEl = document.getElementById('searchSeller');
  // Back to top button
  const backToTopBtn = document.getElementById('backToTopBtn');
  // Report modal elements
  const reportIssueBtn = document.getElementById('reportIssueBtn');
  const reportModal = document.getElementById('reportModal');
  const closeReportModalBtn = document.getElementById('closeReportModal');
  const cancelReportBtn = document.getElementById('cancelReportBtn');
  const submitReportBtn = document.getElementById('submitReportBtn');
  const reportDateEl = document.getElementById('reportDate');
  const reportNameEl = document.getElementById('reportName');
  const reportDescEl = document.getElementById('reportDesc');

  const state = {
    squads: [],
    filters: { number: '', seller: '' },
    reports: []
  };

  // Utils
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const parseNumber = (v) => {
    const n = parseFloat(String(v).replace(/,/g, '.'));
    return isNaN(n) ? 0 : n;
  };
  const fmtCurrency = (n) => {
    try {
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n);
    } catch {
      const fixed = (n || 0).toFixed(2).replace('.', ',');
      return `$ ${fixed}`;
    }
  };

  const save = () => localStorage.setItem(lsKey, JSON.stringify(state));
  const load = () => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.squads)) {
        state.squads = data.squads;
      }
      if (data && data.filters) {
        state.filters.number = (data.filters.number || '').toString();
        state.filters.seller = (data.filters.seller || '').toString();
      }
      if (data && Array.isArray(data.reports)) {
        state.reports = data.reports;
      }
    } catch(e) {
      console.error('Error cargando datos:', e);
    }
  };

  const sortSquads = () => {
    state.squads.sort((a, b) => {
      const an = (a.name || '').trim().toLowerCase();
      const bn = (b.name || '').trim().toLowerCase();
      if (an && bn) return an.localeCompare(bn);
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      return 0;
    });
  };

  const computeSquadTotal = (sq) => {
    let total = 0;
    (sq.items || []).forEach(it => {
      if (!it.done) total += (parseNumber(it.qty) * parseNumber(it.price));
    });
    return total;
  };

  const updateGrandTotalDom = () => {
    const grand = state.squads.reduce((acc, s) => acc + computeSquadTotal(s), 0);
    grandTotalEl.textContent = fmtCurrency(grand);
  };

  const matchFilters = (sq) => {
    const numQ = (state.filters.number || '').trim().toLowerCase();
    const sellerQ = (state.filters.seller || '').trim().toLowerCase();
    const number = (sq.number || '').toString().toLowerCase();
    const seller = (sq.seller || '').toString().toLowerCase();
    const okNum = !numQ || number.includes(numQ);
    const okSeller = !sellerQ || seller.includes(sellerQ);
    return okNum && okSeller;
  };

  const render = () => {
    app.innerHTML = '';
    sortSquads();
    // Pre-calcular totales para render inicial
    state.squads.forEach(s => { s.total = computeSquadTotal(s); });
    updateGrandTotalDom();
    const list = state.squads.filter(matchFilters);
    list.forEach(sq => app.appendChild(renderSquad(sq)));
  };

  const renderSquad = (sq) => {
    const node = squadTpl.content.firstElementChild.cloneNode(true);
    node.dataset.squadId = sq.id;

    // Header main
    const nameInput = node.querySelector('.squad-name');
    nameInput.value = sq.name || '';

    // Status badge
    const badge = node.querySelector('.status-badge');
    const setBadge = (status) => {
      badge.classList.remove('status-none', 'status-aprobado', 'status-rechazado');
      if (status === 'aprobado') {
        badge.textContent = 'Aprobado';
        badge.classList.add('status-aprobado');
      } else if (status === 'rechazado') {
        badge.textContent = 'Rechazado';
        badge.classList.add('status-rechazado');
      } else {
        badge.textContent = 'Sin estado';
        badge.classList.add('status-none');
      }
    };

    // Meta
    const [startDateEl, ownerEl] = node.querySelectorAll('.squad-meta');
    startDateEl.value = sq.startDate || '';
    ownerEl.value = sq.owner || '';

    // Details form
    node.querySelector('.detail.client').value = sq.client || '';
    node.querySelector('.detail.number').value = sq.number || '';
    node.querySelector('.detail.email').value = sq.email || '';
    node.querySelector('.detail.branch').value = sq.branch || '';
    node.querySelector('.detail.payment').value = sq.payment || '';
    node.querySelector('.detail.installments').value = sq.installments || '';
    node.querySelector('.detail.seller').value = sq.seller || '';
    node.querySelector('.detail.supervisor').value = sq.supervisor || '';
    node.querySelector('.detail.status').value = sq.status || '';
    node.querySelector('.detail.end-date').value = sq.endDate || '';

    setBadge(sq.status || '');

    // Items table
    const body = node.querySelector('.table-body');
    body.innerHTML = '';
    (sq.items || []).forEach(it => body.appendChild(renderRow(sq, it)));

    // Total footer
    node.querySelector('.squad-total-value').textContent = fmtCurrency(sq.total || 0);

    // Actions
    node.querySelector('.add-item').addEventListener('click', () => {
      const it = createItem();
      sq.items.push(it);
      const bodyEl = node.querySelector('.table-body');
      bodyEl.appendChild(renderRow(sq, it));
      sq.total = computeSquadTotal(sq);
      node.querySelector('.squad-total-value').textContent = fmtCurrency(sq.total);
      updateGrandTotalDom();
      save();
    });

    node.querySelector('.delete-squad').addEventListener('click', () => {
      if (!confirm('¿Eliminar esta cuadrilla?')) return;
      const idx = state.squads.findIndex(s => s.id === sq.id);
      if (idx >= 0) state.squads.splice(idx, 1);
      save();
      render();
    });

    // Inputs handlers
    // No re-render en cada tecla. Solo guardamos; re-render en blur cuando puede afectar el orden.
    const onInputSaveOnly = (fn) => (e) => { fn(e); save(); };

    nameInput.addEventListener('input', onInputSaveOnly(e => { sq.name = e.target.value; }));
    // Re-render al terminar de escribir el nombre para re-ordenar
    nameInput.addEventListener('blur', () => { save(); render(); });
    startDateEl.addEventListener('input', onInputSaveOnly(e => { sq.startDate = e.target.value; }));
    ownerEl.addEventListener('input', onInputSaveOnly(e => { sq.owner = e.target.value; }));

    node.querySelector('.detail.client').addEventListener('input', onInputSaveOnly(e => { sq.client = e.target.value; }));
    const maybeRerenderOnFilterActive = () => {
      if ((state.filters.number && state.filters.number.trim()) || (state.filters.seller && state.filters.seller.trim())) {
        render();
      }
    };

    node.querySelector('.detail.number').addEventListener('input', (e) => {
      sq.number = e.target.value; save(); maybeRerenderOnFilterActive();
    });
    node.querySelector('.detail.email').addEventListener('input', onInputSaveOnly(e => { sq.email = e.target.value; }));
    node.querySelector('.detail.branch').addEventListener('input', onInputSaveOnly(e => { sq.branch = e.target.value; }));
    node.querySelector('.detail.payment').addEventListener('change', (e) => { sq.payment = e.target.value; save(); });
    node.querySelector('.detail.installments').addEventListener('input', onInputSaveOnly(e => { sq.installments = e.target.value; }));
    node.querySelector('.detail.seller').addEventListener('input', (e) => { sq.seller = e.target.value; save(); maybeRerenderOnFilterActive(); });
    node.querySelector('.detail.supervisor').addEventListener('input', onInputSaveOnly(e => { sq.supervisor = e.target.value; }));
    node.querySelector('.detail.status').addEventListener('change', (e) => { sq.status = e.target.value; setBadge(sq.status); save(); });
    node.querySelector('.detail.end-date').addEventListener('input', onInputSaveOnly(e => { sq.endDate = e.target.value; }));

    return node;
  };

  const renderRow = (sq, it) => {
    const node = rowTpl.content.firstElementChild.cloneNode(true);
    node.dataset.itemId = it.id;

    const doneEl = node.querySelector('.item-done');
    const descEl = node.querySelector('.desc');
    const modelEl = node.querySelector('.model');
    const skuEl = node.querySelector('.sku');
    const qtyEl = node.querySelector('.qty');
    const priceEl = node.querySelector('.price');
    const subtotalEl = node.querySelector('.subtotal');

    doneEl.checked = !!it.done;
    descEl.value = it.desc || '';
    modelEl.value = it.model || '';
    skuEl.value = it.sku || '';
    qtyEl.value = it.qty ?? '';
    priceEl.value = it.price ?? '';

    if (it.done) node.classList.add('tached');

    const compute = () => {
      const sub = (parseNumber(it.qty) * parseNumber(it.price));
      subtotalEl.textContent = fmtCurrency(it.done ? 0 : sub);
    };
    compute();

    const getSquadEl = () => node.closest('.squad');
    const updateTotalsInPlace = () => {
      sq.total = computeSquadTotal(sq);
      const squadEl = getSquadEl();
      if (squadEl) {
        const totalEl = squadEl.querySelector('.squad-total-value');
        if (totalEl) totalEl.textContent = fmtCurrency(sq.total);
      }
      updateGrandTotalDom();
    };

    const onChangeNoRender = (fn) => (e) => { fn(e); compute(); save(); updateTotalsInPlace(); };

    doneEl.addEventListener('change', onChangeNoRender(e => {
      it.done = !!e.target.checked;
      if (it.done) node.classList.add('tached'); else node.classList.remove('tached');
    }));
    descEl.addEventListener('input', (e) => { it.desc = e.target.value; save(); });
    modelEl.addEventListener('input', (e) => { it.model = e.target.value; save(); });
    skuEl.addEventListener('input', (e) => { it.sku = e.target.value; save(); });
    qtyEl.addEventListener('input', onChangeNoRender(e => { it.qty = parseNumber(e.target.value); }));
    priceEl.addEventListener('input', onChangeNoRender(e => { it.price = parseNumber(e.target.value); }));

    node.querySelector('.delete-item').addEventListener('click', () => {
      const idx = sq.items.findIndex(x => x.id === it.id);
      if (idx >= 0) sq.items.splice(idx, 1);
      node.remove();
      save();
      updateTotalsInPlace();
    });

    return node;
  };

  // Creators
  const createSquad = () => ({
    id: uid(),
    name: '',
    startDate: '',
    owner: '',
    client: '',
    number: '',
    email: '',
    branch: '',
    payment: '',
    installments: '',
    seller: '',
    supervisor: '',
    status: '',
    endDate: '',
    items: [],
    total: 0
  });

  const createItem = () => ({ id: uid(), desc: '', model: '', sku: '', qty: 0, price: 0, done: false });
  // include model and sku in new items
  

  // Topbar events
  addSquadBtn.addEventListener('click', () => {
    state.squads.push(createSquad());
    save();
    render();
  });

  // Search events
  const applySearchFromDom = () => {
    state.filters.number = (searchNumberEl?.value || '').toString();
    state.filters.seller = (searchSellerEl?.value || '').toString();
    save();
    render();
  };
  if (searchNumberEl) {
    searchNumberEl.addEventListener('input', applySearchFromDom);
  }
  if (searchSellerEl) {
    searchSellerEl.addEventListener('input', applySearchFromDom);
  }

  // Report modal logic
  const openReportModal = () => {
    if (!reportModal) return;
    // Prefill date to today if empty
    try {
      if (reportDateEl && !reportDateEl.value) {
        const tzOffset = new Date().getTimezoneOffset() * 60000;
        reportDateEl.value = new Date(Date.now() - tzOffset).toISOString().slice(0,10);
      }
    } catch {}
    reportModal.classList.remove('hidden');
  };
  const closeReportModal = () => {
    if (!reportModal) return;
    reportModal.classList.add('hidden');
  };
  if (reportIssueBtn) reportIssueBtn.addEventListener('click', openReportModal);
  if (closeReportModalBtn) closeReportModalBtn.addEventListener('click', closeReportModal);
  if (cancelReportBtn) cancelReportBtn.addEventListener('click', closeReportModal);
  if (reportModal) {
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal || e.target.classList.contains('modal-backdrop')) closeReportModal();
    });
  }
  if (submitReportBtn) {
    submitReportBtn.addEventListener('click', () => {
      const date = (reportDateEl?.value || '').trim();
      const name = (reportNameEl?.value || '').trim();
      const desc = (reportDescEl?.value || '').trim();
      if (!desc) {
        alert('Por favor, describe el problema.');
        return;
      }
      const uidReport = () => Math.random().toString(36).slice(2,8) + Date.now().toString(36).slice(-4);
      state.reports.push({ id: uidReport(), date: date || new Date().toISOString().slice(0,10), name, desc, createdAt: new Date().toISOString() });
      save();
      // Clear fields
      if (reportNameEl) reportNameEl.value = '';
      if (reportDescEl) reportDescEl.value = '';
      closeReportModal();
      alert('Reclamo enviado. ¡Gracias!');
    });
  }

  // Descargar PDF (página completa) con payload re-importable
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', async () => {
      try {
        const element = document.body; // página completa
        const filename = `FlyinSales-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`;
        const opt = {
          margin:       [10,10,10,10],
          filename,
          image:        { type: 'jpeg', quality: 0.95 },
          html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: document.documentElement.scrollWidth },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Crear PDF desde el DOM
        const worker = html2pdf().set(opt).from(element);
        await worker.toPdf();
        const pdf = await worker.get('pdf');

        // Agregar página final con payload JSON base64 para reimportar
        const payload = {
          version: 1,
          savedAt: new Date().toISOString(),
          data: state
        };
        const json = JSON.stringify(payload);
        const b64 = btoa(unescape(encodeURIComponent(json)));
        pdf.addPage();
        pdf.setFontSize(12);
        pdf.text('FlyinSales - Datos incrustados para reimportar', 14, 20);
        pdf.setFontSize(8);
        const markerStart = 'FS_DATA_START:';
        const markerEnd = ':FS_DATA_END';
        // Dividir el texto en líneas para no exceder el ancho
        const chunkSize = 100;
        const lines = [];
        for (let i=0; i<b64.length; i+=chunkSize) lines.push(b64.slice(i, i+chunkSize));
        let y = 30;
        pdf.text(markerStart, 14, y); y += 5;
        lines.forEach(line => { pdf.text(line, 14, y); y += 5; });
        pdf.text(markerEnd, 14, y);

        // Guardar
        pdf.save(filename);
      } catch(err) {
        alert('No se pudo generar el PDF: ' + (err?.message || err));
      }
    });
  }

  // Importar PDF: extraer payload incrustado con pdf.js
  if (importPdfInput) {
    importPdfInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const arrayBuf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
        let text = '';
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          const pageText = content.items.map(it => it.str).join(' ');
          text += '\n' + pageText;
        }
        const startIdx = text.indexOf('FS_DATA_START:');
        const endIdx = text.indexOf(':FS_DATA_END', startIdx + 1);
        if (startIdx === -1 || endIdx === -1) throw new Error('No se encontró payload de datos en el PDF. Debe ser generado por FlyinSales.');
        const between = text.slice(startIdx + 'FS_DATA_START:'.length, endIdx);
        const b64 = between.replace(/\s+/g, '');
        const json = decodeURIComponent(escape(atob(b64)));
        const payload = JSON.parse(json);
        if (!payload?.data?.squads || !Array.isArray(payload.data.squads)) throw new Error('Payload inválido en PDF.');
        // Restaurar estado; preservamos filtros actuales
        const keepFilters = state.filters;
        state.squads = payload.data.squads;
        state.filters = keepFilters;
        save();
        render();
        alert('Datos importados desde PDF correctamente.');
      } catch(err) {
        alert('No se pudo importar el PDF: ' + (err?.message || err));
      } finally {
        importPdfInput.value = '';
      }
    });
  }

  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Esto eliminará todas las cuadrillas. ¿Continuar?')) return;
    state.squads = [];
    save();
    render();
  });

  // Floating back-to-top logic
  const updateBackToTopVisibility = () => {
    if (!backToTopBtn) return;
    const show = window.scrollY > 200;
    backToTopBtn.classList.toggle('is-hidden', !show);
  };
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
  }

  // Init
  load();
  // Restore search inputs from saved filters
  if (searchNumberEl) searchNumberEl.value = state.filters.number || '';
  if (searchSellerEl) searchSellerEl.value = state.filters.seller || '';
  if (!state.squads.length) {
    // empezar con una cuadrilla vacía para guiar
    state.squads.push(createSquad());
  }
  render();
  // Initialize back-to-top visibility
  updateBackToTopVisibility();
})();
