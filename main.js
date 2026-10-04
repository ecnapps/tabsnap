/**
 * TabSnap — Core Application Logic
 * Fast, fair, and private restaurant bill splitter with proportional tipping & WhatsApp export.
 */

(() => {
  'use strict';

  // Available participant avatar color palette
  const AVATAR_COLORS = [
    '#10b981', '#3b82f6', '#8b5cf6', '#ec4899',
    '#f59e0b', '#06b6d4', '#f43f5e', '#84cc16',
    '#6366f1', '#14b8a6', '#d946ef', '#e11d48'
  ];

  const STORAGE_KEY = 'tabsnap_state_v1';
  const THEME_KEY = 'tabsnap_theme';

  // Application State
  let state = {
    participants: [],
    items: [],
    settings: {
      currency: '$',
      tipType: 'percent', // 'percent' | 'custom_fixed'
      tipPercent: 15,
      tipFixed: 0,
      taxIncluded: true,
      taxPercent: 16,
      taxFixed: 0,
      rounding: 'none', // 'none' | 'ceil'
      paymentInfo: ''
    }
  };

  // Currently selected assignees in the "Add Item" form
  let selectedAssigneeIds = new Set();

  // DOM Elements cache
  const el = {
    // Theme & Reset
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIcon: document.getElementById('themeIcon'),
    btnResetTable: document.getElementById('btnResetTable'),
    btnDemoTable: document.getElementById('btnDemoTable'),
    currencySelect: document.getElementById('currencySelect'),

    // Participants
    participantNameInput: document.getElementById('participantNameInput'),
    btnAddParticipant: document.getElementById('btnAddParticipant'),
    participantsList: document.getElementById('participantsList'),
    participantsCountBadge: document.getElementById('participantsCountBadge'),

    // Add Item Form
    itemNameInput: document.getElementById('itemNameInput'),
    itemPriceInput: document.getElementById('itemPriceInput'),
    itemQtyInput: document.getElementById('itemQtyInput'),
    assigneePillsGrid: document.getElementById('assigneePillsGrid'),
    btnSelectAllAssignees: document.getElementById('btnSelectAllAssignees'),
    btnClearAssignees: document.getElementById('btnClearAssignees'),
    btnAddItem: document.getElementById('btnAddItem'),
    itemsList: document.getElementById('itemsList'),
    itemsCountBadge: document.getElementById('itemsCountBadge'),

    // Tip & Taxes
    tipPresetBtns: document.querySelectorAll('.tip-preset-btn'),
    tipCustomInput: document.getElementById('tipCustomInput'),
    taxToggleCheckbox: document.getElementById('taxToggleCheckbox'),
    taxGroupInput: document.getElementById('taxGroupInput'),
    taxPercentInput: document.getElementById('taxPercentInput'),
    roundingSelect: document.getElementById('roundingSelect'),
    paymentInfoInput: document.getElementById('paymentInfoInput'),

    // Totals & Results
    tableSubtotalDisplay: document.getElementById('tableSubtotalDisplay'),
    tableTipDisplay: document.getElementById('tableTipDisplay'),
    tableTaxDisplay: document.getElementById('tableTaxDisplay'),
    tableGrandTotalDisplay: document.getElementById('tableGrandTotalDisplay'),
    personResultsList: document.getElementById('personResultsList'),

    // WhatsApp & Export Actions
    btnCopyWhatsApp: document.getElementById('btnCopyWhatsApp'),
    btnOpenWhatsApp: document.getElementById('btnOpenWhatsApp'),
    btnCopySimpleText: document.getElementById('btnCopySimpleText'),
    whatsappPreviewText: document.getElementById('whatsappPreviewText'),

    // Mobile Sticky Bar
    mobileStickyBar: document.getElementById('mobileStickyBar'),
    mobileGrandTotalDisplay: document.getElementById('mobileGrandTotalDisplay'),
    btnMobileWhatsApp: document.getElementById('btnMobileWhatsApp'),

    // Modal & Toast
    resetModalOverlay: document.getElementById('resetModalOverlay'),
    btnCancelReset: document.getElementById('btnCancelReset'),
    btnConfirmReset: document.getElementById('btnConfirmReset'),
    toastContainer: document.getElementById('toastContainer')
  };

  /* ==========================================================================
     Initialization & Storage
     ========================================================================== */

  function init() {
    loadTheme();
    loadState();
    setupEventListeners();
    renderAll();
    registerServiceWorker();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('TabSnap: LocalStorage save failed', e);
    }
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.participants)) {
          state = {
            ...state,
            ...parsed,
            settings: { ...state.settings, ...(parsed.settings || {}) }
          };
          // Sync UI inputs with loaded settings
          if (el.currencySelect) el.currencySelect.value = state.settings.currency || '$';
          if (el.taxToggleCheckbox) el.taxToggleCheckbox.checked = !state.settings.taxIncluded;
          if (el.taxPercentInput) el.taxPercentInput.value = state.settings.taxPercent || 16;
          if (el.roundingSelect) el.roundingSelect.value = state.settings.rounding || 'none';
          if (el.paymentInfoInput) el.paymentInfoInput.value = state.settings.paymentInfo || '';
          updateTaxInputVisibility();
          syncTipUI();
          return;
        }
      }
    } catch (e) {
      console.warn('TabSnap: LocalStorage load failed, starting fresh', e);
    }

    // Default sample if completely fresh
    loadSampleData();
  }

  function loadSampleData() {
    state.participants = [
      { id: 'p_1', name: 'Carlos', color: AVATAR_COLORS[0] },
      { id: 'p_2', name: 'Sofía', color: AVATAR_COLORS[1] },
      { id: 'p_3', name: 'Mateo', color: AVATAR_COLORS[2] },
      { id: 'p_4', name: 'Valeria', color: AVATAR_COLORS[3] }
    ];

    state.items = [
      {
        id: 'i_1',
        name: 'Guacamole al centro con totopos',
        price: 180,
        quantity: 1,
        assignedTo: ['p_1', 'p_2', 'p_3', 'p_4']
      },
      {
        id: 'i_2',
        name: 'Hamburguesa con papas',
        price: 240,
        quantity: 1,
        assignedTo: ['p_1']
      },
      {
        id: 'i_3',
        name: 'Ensalada César con salmón',
        price: 260,
        quantity: 1,
        assignedTo: ['p_2']
      },
      {
        id: 'i_4',
        name: 'Pizza para compartir (mitad y mitad)',
        price: 360,
        quantity: 1,
        assignedTo: ['p_3', 'p_4']
      },
      {
        id: 'i_5',
        name: 'Cervezas artesanales (Ronda 4x)',
        price: 90,
        quantity: 4,
        assignedTo: ['p_1', 'p_2', 'p_3', 'p_4']
      }
    ];

    state.settings.tipPercent = 15;
    state.settings.tipType = 'percent';
    state.settings.taxIncluded = true;
    state.settings.currency = '$';
    state.settings.paymentInfo = 'Transferir por SPEI / CLABE: 012180015498765432';

    // Auto-select all assignees in new item form
    selectedAssigneeIds = new Set(state.participants.map(p => p.id));
    saveState();
  }

  /* ==========================================================================
     Theme Management
     ========================================================================== */

  function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'dark'); // Default to sleek dark mode
    setTheme(theme);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    if (el.themeIcon) {
      el.themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    setTheme(next);
  }

  /* ==========================================================================
     Mathematical Calculations (Fair Proportional Splitting)
     ========================================================================== */

  function calculateAll() {
    const currency = state.settings.currency || '$';
    const participantMap = new Map();

    state.participants.forEach(p => {
      participantMap.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        subtotal: 0,
        tip: 0,
        tax: 0,
        total: 0,
        itemsDetailed: []
      });
    });

    let tableSubtotal = 0;

    // Calculate individual item fractions
    state.items.forEach(item => {
      const price = parseFloat(item.price) || 0;
      const qty = parseInt(item.quantity, 10) || 1;
      const itemTotal = price * qty;
      tableSubtotal += itemTotal;

      const assignees = (item.assignedTo || []).filter(id => participantMap.has(id));
      if (assignees.length > 0) {
        const sharePerPerson = itemTotal / assignees.length;
        assignees.forEach(pId => {
          const person = participantMap.get(pId);
          person.subtotal += sharePerPerson;
          person.itemsDetailed.push({
            name: item.name,
            totalItemPrice: itemTotal,
            quantity: qty,
            shareAmount: sharePerPerson,
            sharedWithCount: assignees.length
          });
        });
      }
    });

    // Tip Calculation
    let tableTip = 0;
    if (state.settings.tipType === 'percent') {
      const tipPct = parseFloat(state.settings.tipPercent) || 0;
      tableTip = tableSubtotal * (tipPct / 100);
    } else {
      tableTip = parseFloat(state.settings.tipFixed) || 0;
    }

    // Tax Calculation (only added if taxIncluded === false)
    let tableTax = 0;
    if (!state.settings.taxIncluded) {
      const taxPct = parseFloat(state.settings.taxPercent) || 0;
      const taxFixed = parseFloat(state.settings.taxFixed) || 0;
      tableTax = (tableSubtotal * (taxPct / 100)) + taxFixed;
    }

    // Proportional Assignment
    let sumAssignedTotals = 0;
    const roundingMode = state.settings.rounding;

    participantMap.forEach(person => {
      if (tableSubtotal > 0 && person.subtotal > 0) {
        const ratio = person.subtotal / tableSubtotal;
        person.tip = tableTip * ratio;
        person.tax = tableTax * ratio;
      } else {
        person.tip = 0;
        person.tax = 0;
      }

      let personRawTotal = person.subtotal + person.tip + person.tax;

      if (roundingMode === 'ceil') {
        person.total = Math.ceil(personRawTotal);
      } else {
        person.total = round2(personRawTotal);
      }

      sumAssignedTotals += person.total;
    });

    const tableGrandTotal = tableSubtotal + tableTip + tableTax;

    return {
      currency,
      tableSubtotal: round2(tableSubtotal),
      tableTip: round2(tableTip),
      tableTax: round2(tableTax),
      tableGrandTotal: round2(tableGrandTotal),
      sumAssignedTotals: round2(sumAssignedTotals),
      participantsList: Array.from(participantMap.values())
    };
  }

  function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(amount, currency = state.settings.currency || '$') {
    return `${currency}${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /* ==========================================================================
     Render Functions
     ========================================================================== */

  function renderAll() {
    renderParticipants();
    renderAssigneePills();
    renderItemsList();
    renderCalculations();
  }

  function renderParticipants() {
    const count = state.participants.length;
    el.participantsCountBadge.textContent = `${count} ${count === 1 ? 'comensal' : 'comensales'}`;

    if (count === 0) {
      el.participantsList.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon">👥</span>
          <p class="empty-state__text">Agrega a los integrantes de la mesa para empezar a repartir.</p>
        </div>
      `;
      return;
    }

    el.participantsList.innerHTML = state.participants.map(p => {
      const initial = p.name.trim().charAt(0).toUpperCase() || '?';
      return `
        <div class="participant-chip" data-id="${p.id}">
          <span class="avatar-badge" style="background-color: ${p.color};">${escapeHtml(initial)}</span>
          <span class="participant-name-text">${escapeHtml(p.name)}</span>
          <button type="button" class="chip-remove-btn" title="Eliminar a ${escapeHtml(p.name)}" aria-label="Eliminar ${escapeHtml(p.name)}">
            &times;
          </button>
        </div>
      `;
    }).join('');
  }

  function renderAssigneePills() {
    if (state.participants.length === 0) {
      el.assigneePillsGrid.innerHTML = `
        <span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">
          Agrega comensales arriba para asignar platos.
        </span>
      `;
      return;
    }

    // If new participants added and none selected, or to preserve valid selections
    const validIds = new Set(state.participants.map(p => p.id));
    selectedAssigneeIds = new Set([...selectedAssigneeIds].filter(id => validIds.has(id)));

    // If nothing selected yet, default to all
    if (selectedAssigneeIds.size === 0 && state.participants.length > 0) {
      selectedAssigneeIds = new Set(validIds);
    }

    el.assigneePillsGrid.innerHTML = state.participants.map(p => {
      const isSelected = selectedAssigneeIds.has(p.id);
      const initial = p.name.trim().charAt(0).toUpperCase() || '?';
      return `
        <button type="button" class="assignee-pill ${isSelected ? 'active' : ''}" data-id="${p.id}" role="checkbox" aria-checked="${isSelected}">
          <span class="avatar-badge" style="background-color: ${p.color}; width: 20px; height: 20px; font-size: 0.65rem;">${escapeHtml(initial)}</span>
          <span>${escapeHtml(p.name)}</span>
          <span class="pill-check">✓</span>
        </button>
      `;
    }).join('');
  }

  function renderItemsList() {
    const count = state.items.length;
    el.itemsCountBadge.textContent = `${count} ${count === 1 ? 'ítem' : 'ítems'}`;

    if (count === 0) {
      el.itemsList.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon">🧾</span>
          <p class="empty-state__text">Aún no hay consumos cargados. Ingresa los platos o bebidas del ticket.</p>
        </div>
      `;
      return;
    }

    const participantMap = new Map(state.participants.map(p => [p.id, p]));
    const currency = state.settings.currency || '$';

    el.itemsList.innerHTML = state.items.map(item => {
      const price = parseFloat(item.price) || 0;
      const qty = parseInt(item.quantity, 10) || 1;
      const total = price * qty;
      const assignees = (item.assignedTo || []).map(id => participantMap.get(id)).filter(Boolean);
      const isEveryone = assignees.length === state.participants.length && state.participants.length > 1;

      let splitLabel = '';
      if (assignees.length === 0) {
        splitLabel = '<span style="color: var(--danger-color);">⚠️ Sin asignar</span>';
      } else if (isEveryone) {
        splitLabel = `Entre toda la mesa (${formatMoney(total / assignees.length, currency)} c/u)`;
      } else if (assignees.length === 1) {
        splitLabel = `Solo ${escapeHtml(assignees[0].name)}`;
      } else {
        splitLabel = `${assignees.length} personas (${formatMoney(total / assignees.length, currency)} c/u)`;
      }

      const avatarStack = assignees.slice(0, 4).map(a => `
        <span class="mini-avatar" style="background-color: ${a.color};" title="${escapeHtml(a.name)}">
          ${escapeHtml(a.name.charAt(0).toUpperCase())}
        </span>
      `).join('');

      return `
        <article class="item-card" data-id="${item.id}">
          <div class="item-info">
            <div class="item-name-row">
              <h4 class="item-name">${escapeHtml(item.name)}</h4>
              ${qty > 1 ? `<span class="item-qty-badge">x${qty}</span>` : ''}
            </div>
            <div class="item-assignees-summary">
              <span class="mini-avatar-stack">${avatarStack}</span>
              <span>${splitLabel}</span>
            </div>
          </div>
          <div class="item-pricing-action">
            <div>
              <span class="item-total-price">${formatMoney(total, currency)}</span>
            </div>
            <button type="button" class="btn-item-delete" title="Eliminar ítem" aria-label="Eliminar ${escapeHtml(item.name)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderCalculations() {
    const calc = calculateAll();
    const currency = calc.currency;

    // Table Totals Card
    el.tableSubtotalDisplay.textContent = formatMoney(calc.tableSubtotal, currency);
    el.tableTipDisplay.textContent = formatMoney(calc.tableTip, currency);
    el.tableTaxDisplay.textContent = state.settings.taxIncluded ? 'Incluido' : formatMoney(calc.tableTax, currency);
    el.tableGrandTotalDisplay.textContent = formatMoney(calc.tableGrandTotal, currency);

    // Mobile sticky bar
    if (el.mobileGrandTotalDisplay) {
      el.mobileGrandTotalDisplay.textContent = formatMoney(calc.tableGrandTotal, currency);
    }

    // Individual Person Cards
    if (calc.participantsList.length === 0) {
      el.personResultsList.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__text">Sin participantes registrados.</p>
        </div>
      `;
    } else {
      el.personResultsList.innerHTML = calc.participantsList.map(person => {
        const initial = person.name.trim().charAt(0).toUpperCase() || '?';
        const itemsRows = person.itemsDetailed.map(it => `
          <div class="person-item-row">
            <span>${escapeHtml(it.name)} ${it.sharedWithCount > 1 ? `<em style="color: var(--text-muted); font-size:0.75rem;">(1/${it.sharedWithCount})</em>` : ''}</span>
            <strong>${formatMoney(it.shareAmount, currency)}</strong>
          </div>
        `).join('');

        return `
          <article class="person-card" data-person-id="${person.id}">
            <div class="person-card__header">
              <div class="person-identity">
                <span class="avatar-badge" style="background-color: ${person.color}; width: 32px; height: 32px; font-size: 0.85rem;">
                  ${escapeHtml(initial)}
                </span>
                <div>
                  <h4 class="person-name">${escapeHtml(person.name)}</h4>
                  <div class="person-summary-row">
                    <span class="person-summary-pill">Consumo: ${formatMoney(person.subtotal, currency)}</span>
                    <span class="person-summary-pill">Propina: ${formatMoney(person.tip, currency)}</span>
                    ${!state.settings.taxIncluded ? `<span class="person-summary-pill">Impuestos: ${formatMoney(person.tax, currency)}</span>` : ''}
                  </div>
                </div>
              </div>
              <div style="text-align: right;">
                <span class="person-total">${formatMoney(person.total, currency)}</span>
              </div>
            </div>

            <div class="person-details-toggle">
              <button type="button" class="btn-ghost btn-toggle-items" style="padding: 0.2rem 0.5rem; font-size: 0.78rem;">
                Ver detalle (${person.itemsDetailed.length} platos) ▾
              </button>
              <button type="button" class="btn-copy-person" data-person-name="${escapeHtml(person.name)}" title="Copiar desglose individual">
                📋 Copiar
              </button>
            </div>

            <div class="person-items-breakdown">
              ${person.itemsDetailed.length > 0 ? itemsRows : '<p style="color:var(--text-muted);">Sin consumos asignados.</p>'}
            </div>
          </article>
        `;
      }).join('');
    }

    // Update WhatsApp live preview
    const whatsappText = generateWhatsAppMessage(calc);
    if (el.whatsappPreviewText) {
      el.whatsappPreviewText.textContent = whatsappText;
    }
  }

  /* ==========================================================================
     WhatsApp Message Builder
     ========================================================================== */

  function generateWhatsAppMessage(calc) {
    const currency = calc.currency;
    const lines = [];

    lines.push('🧾 *TabSnap — Cuenta Dividida*');
    lines.push(`🍽️ *Total Mesa:* ${formatMoney(calc.tableGrandTotal, currency)}`);
    
    let subBreakdown = `💵 *Subtotal:* ${formatMoney(calc.tableSubtotal, currency)}`;
    if (calc.tableTip > 0) {
      const tipLabel = state.settings.tipType === 'percent' ? `${state.settings.tipPercent}%` : 'fija';
      subBreakdown += ` | *Propina (${tipLabel}):* ${formatMoney(calc.tableTip, currency)}`;
    }
    if (!state.settings.taxIncluded && calc.tableTax > 0) {
      subBreakdown += ` | *Impuesto:* ${formatMoney(calc.tableTax, currency)}`;
    }
    lines.push(subBreakdown);
    lines.push(`👥 *Comensales:* ${calc.participantsList.length} personas`);
    lines.push('----------------------------------------');

    calc.participantsList.forEach(p => {
      lines.push(`👤 *${p.name}:* ${formatMoney(p.total, currency)}`);
      if (p.itemsDetailed.length > 0) {
        p.itemsDetailed.forEach(it => {
          const splitText = it.sharedWithCount > 1 ? ` (1/${it.sharedWithCount} de ${formatMoney(it.totalItemPrice, currency)})` : '';
          lines.push(`   • ${it.name}${splitText}: ${formatMoney(it.shareAmount, currency)}`);
        });
      }
      lines.push(`   • Propina proporcional: ${formatMoney(p.tip, currency)}`);
      if (!state.settings.taxIncluded && p.tax > 0) {
        lines.push(`   • Impuestos proporcionales: ${formatMoney(p.tax, currency)}`);
      }
      lines.push('');
    });

    lines.push('----------------------------------------');
    if (state.settings.paymentInfo && state.settings.paymentInfo.trim()) {
      lines.push(`💳 *Datos para transferir:*\n${state.settings.paymentInfo.trim()}`);
      lines.push('');
    }
    lines.push('✨ Calculado al instante con https://tabsnap.ecn-apps.com');

    return lines.join('\n');
  }

  function generateSinglePersonMessage(personName) {
    const calc = calculateAll();
    const currency = calc.currency;
    const person = calc.participantsList.find(p => p.name.toLowerCase() === personName.toLowerCase());
    if (!person) return '';

    const lines = [];
    lines.push(`🧾 *TabSnap — Tu consumo individual*`);
    lines.push(`👤 *Hola ${person.name}, tu total es:* ${formatMoney(person.total, currency)}`);
    lines.push('');
    lines.push('🍽️ *Detalle de tus platos:*');
    person.itemsDetailed.forEach(it => {
      const splitText = it.sharedWithCount > 1 ? ` (1/${it.sharedWithCount})` : '';
      lines.push(` • ${it.name}${splitText}: ${formatMoney(it.shareAmount, currency)}`);
    });
    lines.push(` • Subtotal consumo: ${formatMoney(person.subtotal, currency)}`);
    lines.push(` • Tu parte de propina: ${formatMoney(person.tip, currency)}`);
    if (!state.settings.taxIncluded && person.tax > 0) {
      lines.push(` • Tu parte de impuestos: ${formatMoney(person.tax, currency)}`);
    }
    lines.push('');
    if (state.settings.paymentInfo && state.settings.paymentInfo.trim()) {
      lines.push(`💳 *Datos para transferir:*\n${state.settings.paymentInfo.trim()}`);
      lines.push('');
    }
    lines.push('✨ Divide cuentas en https://tabsnap.ecn-apps.com');

    return lines.join('\n');
  }

  /* ==========================================================================
     Event Listeners & User Actions
     ========================================================================== */

  function setupEventListeners() {
    // Theme toggle
    if (el.themeToggleBtn) {
      el.themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Currency Change
    if (el.currencySelect) {
      el.currencySelect.addEventListener('change', (e) => {
        state.settings.currency = e.target.value;
        saveState();
        renderAll();
      });
    }

    // Add Participant
    if (el.btnAddParticipant && el.participantNameInput) {
      const addParticipantHandler = () => {
        const name = el.participantNameInput.value.trim();
        if (!name) return;

        // Check duplicates
        const exists = state.participants.some(p => p.name.toLowerCase() === name.toLowerCase());
        if (exists) {
          showToast(`"${name}" ya está en la mesa`, 'warning');
          return;
        }

        const colorIndex = state.participants.length % AVATAR_COLORS.length;
        const newParticipant = {
          id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          name: name,
          color: AVATAR_COLORS[colorIndex]
        };

        state.participants.push(newParticipant);
        selectedAssigneeIds.add(newParticipant.id);

        el.participantNameInput.value = '';
        el.participantNameInput.focus();

        saveState();
        renderAll();
        showToast(`Agregado: ${name}`);
      };

      el.btnAddParticipant.addEventListener('click', addParticipantHandler);
      el.participantNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          addParticipantHandler();
        }
      });
    }

    // Remove Participant Delegation
    if (el.participantsList) {
      el.participantsList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.chip-remove-btn');
        if (!removeBtn) return;
        const chip = removeBtn.closest('.participant-chip');
        if (!chip) return;
        const id = chip.dataset.id;

        const pIndex = state.participants.findIndex(p => p.id === id);
        if (pIndex !== -1) {
          const removedName = state.participants[pIndex].name;
          state.participants.splice(pIndex, 1);
          selectedAssigneeIds.delete(id);

          // Clean up items assigned to removed participant
          state.items.forEach(item => {
            item.assignedTo = (item.assignedTo || []).filter(pId => pId !== id);
          });

          saveState();
          renderAll();
          showToast(`Eliminado: ${removedName}`);
        }
      });
    }

    // Assignee pills selection in Add Item Form
    if (el.assigneePillsGrid) {
      el.assigneePillsGrid.addEventListener('click', (e) => {
        const pill = e.target.closest('.assignee-pill');
        if (!pill) return;
        const id = pill.dataset.id;
        if (selectedAssigneeIds.has(id)) {
          selectedAssigneeIds.delete(id);
        } else {
          selectedAssigneeIds.add(id);
        }
        renderAssigneePills();
      });
    }

    // Select All / Clear Assignees
    if (el.btnSelectAllAssignees) {
      el.btnSelectAllAssignees.addEventListener('click', () => {
        selectedAssigneeIds = new Set(state.participants.map(p => p.id));
        renderAssigneePills();
      });
    }

    if (el.btnClearAssignees) {
      el.btnClearAssignees.addEventListener('click', () => {
        selectedAssigneeIds.clear();
        renderAssigneePills();
      });
    }

    // Add Item
    if (el.btnAddItem) {
      el.btnAddItem.addEventListener('click', handleAddItem);
    }

    // Delete Item Delegation
    if (el.itemsList) {
      el.itemsList.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-item-delete');
        if (!deleteBtn) return;
        const card = deleteBtn.closest('.item-card');
        if (!card) return;
        const id = card.dataset.id;

        const itemIndex = state.items.findIndex(it => it.id === id);
        if (itemIndex !== -1) {
          const deletedName = state.items[itemIndex].name;
          state.items.splice(itemIndex, 1);
          saveState();
          renderAll();
          showToast(`Eliminado: ${deletedName}`);
        }
      });
    }

    // Tip Presets
    if (el.tipPresetBtns) {
      el.tipPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.tip;
          el.tipPresetBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          if (val === 'custom') {
            if (el.tipCustomInput) {
              el.tipCustomInput.style.display = 'block';
              el.tipCustomInput.focus();
            }
          } else {
            if (el.tipCustomInput) el.tipCustomInput.style.display = 'none';
            state.settings.tipType = 'percent';
            state.settings.tipPercent = parseFloat(val) || 0;
            saveState();
            renderCalculations();
          }
        });
      });
    }

    // Tip Custom Input
    if (el.tipCustomInput) {
      el.tipCustomInput.addEventListener('input', (e) => {
        state.settings.tipType = 'percent';
        state.settings.tipPercent = Math.max(0, parseFloat(e.target.value) || 0);
        saveState();
        renderCalculations();
      });
    }

    // Tax Toggle & Input
    if (el.taxToggleCheckbox) {
      el.taxToggleCheckbox.addEventListener('change', (e) => {
        state.settings.taxIncluded = !e.target.checked;
        updateTaxInputVisibility();
        saveState();
        renderCalculations();
      });
    }

    if (el.taxPercentInput) {
      el.taxPercentInput.addEventListener('input', (e) => {
        state.settings.taxPercent = Math.max(0, parseFloat(e.target.value) || 0);
        saveState();
        renderCalculations();
      });
    }

    // Rounding Select
    if (el.roundingSelect) {
      el.roundingSelect.addEventListener('change', (e) => {
        state.settings.rounding = e.target.value;
        saveState();
        renderCalculations();
      });
    }

    // Payment Info
    if (el.paymentInfoInput) {
      el.paymentInfoInput.addEventListener('input', (e) => {
        state.settings.paymentInfo = e.target.value;
        saveState();
        renderCalculations();
      });
    }

    // Toggle Details per Person Delegation
    if (el.personResultsList) {
      el.personResultsList.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.btn-toggle-items');
        if (toggleBtn) {
          const card = toggleBtn.closest('.person-card');
          const breakdown = card.querySelector('.person-items-breakdown');
          if (breakdown) {
            breakdown.classList.toggle('open');
            toggleBtn.textContent = breakdown.classList.contains('open') ? 'Ocultar detalle ▴' : 'Ver detalle ▾';
          }
          return;
        }

        const copyPersonBtn = e.target.closest('.btn-copy-person');
        if (copyPersonBtn) {
          const personName = copyPersonBtn.dataset.personName;
          const msg = generateSinglePersonMessage(personName);
          copyToClipboard(msg, `¡Copiado el desglose de ${personName}!`);
        }
      });
    }

    // Copy to WhatsApp Full Message
    if (el.btnCopyWhatsApp) {
      el.btnCopyWhatsApp.addEventListener('click', () => {
        const calc = calculateAll();
        const text = generateWhatsAppMessage(calc);
        copyToClipboard(text, '¡Resumen de WhatsApp copiado al portapapeles!');
      });
    }

    if (el.btnMobileWhatsApp) {
      el.btnMobileWhatsApp.addEventListener('click', () => {
        const calc = calculateAll();
        const text = generateWhatsAppMessage(calc);
        copyToClipboard(text, '¡Resumen de WhatsApp copiado!');
      });
    }

    // Direct WhatsApp Web/App launcher
    if (el.btnOpenWhatsApp) {
      el.btnOpenWhatsApp.addEventListener('click', () => {
        const calc = calculateAll();
        const text = generateWhatsAppMessage(calc);
        const encoded = encodeURIComponent(text);
        window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
      });
    }

    // Demo Table
    if (el.btnDemoTable) {
      el.btnDemoTable.addEventListener('click', () => {
        loadSampleData();
        renderAll();
        showToast('¡Cargada la cuenta de ejemplo!');
      });
    }

    // Reset Table Modal
    if (el.btnResetTable && el.resetModalOverlay) {
      el.btnResetTable.addEventListener('click', () => {
        el.resetModalOverlay.classList.add('active');
      });
    }

    if (el.btnCancelReset && el.resetModalOverlay) {
      el.btnCancelReset.addEventListener('click', () => {
        el.resetModalOverlay.classList.remove('active');
      });
    }

    if (el.btnConfirmReset && el.resetModalOverlay) {
      el.btnConfirmReset.addEventListener('click', () => {
        state.participants = [];
        state.items = [];
        selectedAssigneeIds.clear();
        saveState();
        renderAll();
        el.resetModalOverlay.classList.remove('active');
        showToast('Mesa reiniciada desde cero');
      });
    }
  }

  function handleAddItem() {
    const name = el.itemNameInput.value.trim();
    const price = parseFloat(el.itemPriceInput.value);
    const qty = parseInt(el.itemQtyInput.value, 10) || 1;

    if (!name) {
      showToast('Ingresa el nombre o concepto del plato', 'warning');
      el.itemNameInput.focus();
      return;
    }

    if (isNaN(price) || price < 0) {
      showToast('Ingresa un precio válido', 'warning');
      el.itemPriceInput.focus();
      return;
    }

    if (state.participants.length === 0) {
      showToast('Primero agrega al menos 1 comensal a la mesa', 'warning');
      el.participantNameInput.focus();
      return;
    }

    if (selectedAssigneeIds.size === 0) {
      showToast('Selecciona a quién o a quiénes les corresponde este plato', 'warning');
      return;
    }

    const newItem = {
      id: 'i_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: name,
      price: price,
      quantity: qty,
      assignedTo: Array.from(selectedAssigneeIds)
    };

    state.items.push(newItem);

    // Reset inputs
    el.itemNameInput.value = '';
    el.itemPriceInput.value = '';
    el.itemQtyInput.value = '1';
    el.itemNameInput.focus();

    saveState();
    renderAll();
    showToast(`Plato agregado: ${name}`);
  }

  function syncTipUI() {
    if (!el.tipPresetBtns) return;
    const currentPct = state.settings.tipPercent;
    let found = false;

    el.tipPresetBtns.forEach(btn => {
      const val = parseFloat(btn.dataset.tip);
      if (val === currentPct && state.settings.tipType === 'percent') {
        btn.classList.add('active');
        found = true;
      } else {
        btn.classList.remove('active');
      }
    });

    if (!found && el.tipCustomInput) {
      const customBtn = document.querySelector('.tip-preset-btn[data-tip="custom"]');
      if (customBtn) customBtn.classList.add('active');
      el.tipCustomInput.style.display = 'block';
      el.tipCustomInput.value = currentPct;
    } else if (el.tipCustomInput) {
      el.tipCustomInput.style.display = 'none';
    }
  }

  function updateTaxInputVisibility() {
    if (el.taxGroupInput) {
      el.taxGroupInput.style.display = state.settings.taxIncluded ? 'none' : 'block';
    }
  }

  /* ==========================================================================
     Clipboard & Notifications
     ========================================================================== */

  async function copyToClipboard(text, successMessage = 'Copiado al portapapeles') {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast(successMessage);
    } catch (err) {
      console.error('Error al copiar:', err);
      showToast('No se pudo copiar automáticamente. Puedes seleccionar el texto.', 'warning');
    }
  }

  function showToast(message, type = 'success') {
    if (!el.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'warning' ? '⚠️' : '✅';
    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ==========================================================================
     Service Worker Registration
     ========================================================================== */

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.debug('SW registration note:', err);
        });
      });
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
