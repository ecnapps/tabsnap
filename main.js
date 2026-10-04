/**
 * TabSnap — Core Application Logic
 * Fast, fair, and private restaurant bill splitter with proportional tipping, sales tax & export.
 * Focused on the US dining market with support for Venmo, iMessage, and WhatsApp.
 */

(() => {
  'use strict';

  // Available participant avatar color palette
  const AVATAR_COLORS = [
    '#10b981', '#3b82f6', '#8b5cf6', '#ec4899',
    '#f59e0b', '#06b6d4', '#f43f5e', '#84cc16',
    '#6366f1', '#14b8a6', '#d946ef', '#e11d48'
  ];

  const STORAGE_KEY = 'tabsnap_state_v3';
  const THEME_KEY = 'tabsnap_theme';

  // Application State
  let state = {
    participants: [],
    items: [],
    settings: {
      currency: '$',
      tipType: 'percent', // 'percent' | 'custom_fixed'
      tipPercent: 18,
      tipFixed: 0,
      taxIncluded: false, // In the US, sales tax is added on top of food & drink subtotal
      taxPercent: 8.5,
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
    btnQuickDemo: document.getElementById('btnQuickDemo'),
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

    // Export & Sharing Actions
    btnCopySummary: document.getElementById('btnCopySummary'),
    btnShareNative: document.getElementById('btnShareNative'),
    btnOpenWhatsApp: document.getElementById('btnOpenWhatsApp'),
    whatsappPreviewText: document.getElementById('whatsappPreviewText'),

    // Mobile Sticky Bar
    mobileStickyBar: document.getElementById('mobileStickyBar'),
    mobileGrandTotalDisplay: document.getElementById('mobileGrandTotalDisplay'),
    btnMobileShare: document.getElementById('btnMobileShare'),

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

  function initCleanState() {
    state.participants = [];
    state.items = [];
    state.settings = {
      currency: '$',
      tipType: 'percent',
      tipPercent: 18,
      tipFixed: 0,
      taxIncluded: false,
      taxPercent: 8.5,
      taxFixed: 0,
      rounding: 'none',
      paymentInfo: ''
    };
    selectedAssigneeIds.clear();

    if (el.currencySelect) el.currencySelect.value = '$';
    if (el.taxToggleCheckbox) el.taxToggleCheckbox.checked = true;
    if (el.taxPercentInput) el.taxPercentInput.value = 8.5;
    if (el.roundingSelect) el.roundingSelect.value = 'none';
    if (el.paymentInfoInput) el.paymentInfoInput.value = '';

    updateTaxInputVisibility();
    syncTipUI();
    saveState();
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          state = {
            ...state,
            participants: Array.isArray(parsed.participants) ? parsed.participants : [],
            items: Array.isArray(parsed.items) ? parsed.items : [],
            settings: { ...state.settings, ...(parsed.settings || {}) }
          };
          // Sync UI inputs with loaded settings
          if (el.currencySelect) el.currencySelect.value = state.settings.currency || '$';
          if (el.taxToggleCheckbox) el.taxToggleCheckbox.checked = !state.settings.taxIncluded;
          if (el.taxPercentInput) el.taxPercentInput.value = state.settings.taxPercent !== undefined ? state.settings.taxPercent : 8.5;
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

    // Default: start with a completely clean interface (no preloaded demo)
    initCleanState();
  }

  function loadSampleData() {
    state.participants = [
      { id: 'p_1', name: 'Alex', color: AVATAR_COLORS[0] },
      { id: 'p_2', name: 'Jordan', color: AVATAR_COLORS[1] },
      { id: 'p_3', name: 'Taylor', color: AVATAR_COLORS[2] },
      { id: 'p_4', name: 'Sam', color: AVATAR_COLORS[3] }
    ];

    state.items = [
      {
        id: 'i_1',
        name: 'Spinach & Artichoke Dip',
        price: 14.50,
        quantity: 1,
        assignedTo: ['p_1', 'p_2', 'p_3', 'p_4']
      },
      {
        id: 'i_2',
        name: 'Bacon Cheeseburger & Truffle Fries',
        price: 22.00,
        quantity: 1,
        assignedTo: ['p_1']
      },
      {
        id: 'i_3',
        name: 'Grilled Salmon Caesar Salad',
        price: 24.50,
        quantity: 1,
        assignedTo: ['p_2']
      },
      {
        id: 'i_4',
        name: 'Margherita Wood-Fired Pizza',
        price: 21.00,
        quantity: 1,
        assignedTo: ['p_3', 'p_4']
      },
      {
        id: 'i_5',
        name: 'Draft Craft IPAs',
        price: 8.50,
        quantity: 4,
        assignedTo: ['p_1', 'p_2', 'p_3', 'p_4']
      }
    ];

    state.settings.tipPercent = 18;
    state.settings.tipType = 'percent';
    state.settings.taxIncluded = false;
    state.settings.taxPercent = 8.5;
    state.settings.currency = '$';
    state.settings.rounding = 'none';
    state.settings.paymentInfo = 'Venmo: @alex-smith | Zelle: (555) 234-5678';

    // Sync input controls with sample state
    if (el.currencySelect) el.currencySelect.value = '$';
    if (el.taxToggleCheckbox) el.taxToggleCheckbox.checked = true;
    if (el.taxPercentInput) el.taxPercentInput.value = 8.5;
    if (el.paymentInfoInput) el.paymentInfoInput.value = state.settings.paymentInfo;
    if (el.roundingSelect) el.roundingSelect.value = 'none';

    updateTaxInputVisibility();
    syncTipUI();

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
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
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

    // Tip Calculation (customarily calculated on pre-tax subtotal)
    let tableTip = 0;
    if (state.settings.tipType === 'percent') {
      const tipPct = parseFloat(state.settings.tipPercent) || 0;
      tableTip = tableSubtotal * (tipPct / 100);
    } else {
      tableTip = parseFloat(state.settings.tipFixed) || 0;
    }

    // Sales Tax Calculation (added on top when taxIncluded === false)
    let tableTax = 0;
    if (!state.settings.taxIncluded) {
      const taxPct = parseFloat(state.settings.taxPercent) || 0;
      const taxFixed = parseFloat(state.settings.taxFixed) || 0;
      tableTax = (tableSubtotal * (taxPct / 100)) + taxFixed;
    }

    // Proportional Assignment to each diner
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
    const unassignedCount = state.items.filter(it => (it.assignedTo || []).filter(id => participantMap.has(id)).length === 0).length;

    // Financial Penny Balancing: when all items are assigned and exact cents are chosen,
    // absorb +/- 1 or 2 cents rounding discrepancy onto the largest spender so totals match exactly
    if (roundingMode === 'none' && unassignedCount === 0 && participantMap.size > 0 && tableGrandTotal > 0) {
      const diff = round2(round2(tableGrandTotal) - round2(sumAssignedTotals));
      if (Math.abs(diff) > 0 && Math.abs(diff) <= 0.05) {
        const dinersWithTotals = Array.from(participantMap.values()).filter(p => p.total > 0).sort((a, b) => b.total - a.total);
        if (dinersWithTotals.length > 0) {
          dinersWithTotals[0].total = round2(dinersWithTotals[0].total + diff);
          sumAssignedTotals = round2(sumAssignedTotals + diff);
        }
      }
    }

    return {
      currency,
      tableSubtotal: round2(tableSubtotal),
      tableTip: round2(tableTip),
      tableTax: round2(tableTax),
      tableGrandTotal: round2(tableGrandTotal),
      sumAssignedTotals: round2(sumAssignedTotals),
      unassignedCount,
      participantsList: Array.from(participantMap.values())
    };
  }

  function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(amount, currency = state.settings.currency || '$') {
    return `${currency}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /* ==========================================================================
     Render Functions
     ========================================================================== */

  function renderAll() {
    renderParticipants();
    renderAssigneePills();
    renderItemsList();
    renderCalculations();
    updateStepVisibility();
  }

  function updateStepVisibility() {
    const hasParticipants = state.participants.length > 0;
    const hasItems = state.items.length > 0;

    const step2LockedHint = document.getElementById('step2LockedHint');
    const step2Content = document.getElementById('step2Content');
    if (step2LockedHint && step2Content) {
      step2LockedHint.style.display = hasParticipants ? 'none' : 'block';
      step2Content.style.display = hasParticipants ? 'block' : 'none';
    }

    const step3LockedHint = document.getElementById('step3LockedHint');
    const step3Content = document.getElementById('step3Content');
    if (step3LockedHint && step3Content) {
      step3LockedHint.style.display = hasItems ? 'none' : 'block';
      step3Content.style.display = hasItems ? 'block' : 'none';
    }

    const currencySymbolLabel = document.getElementById('currencySymbolLabel');
    if (currencySymbolLabel) {
      currencySymbolLabel.textContent = state.settings.currency || '$';
    }

    const taxRateSummary = document.getElementById('taxRateSummary');
    if (taxRateSummary) {
      const taxRate = state.settings.taxPercent !== undefined ? state.settings.taxPercent : 8.5;
      taxRateSummary.textContent = `${taxRate}%`;
    }
  }

  function renderParticipants() {
    const count = state.participants.length;
    el.participantsCountBadge.textContent = `${count} ${count === 1 ? 'diner' : 'diners'}`;

    if (count === 0) {
      el.participantsList.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon">👥</span>
          <p class="empty-state__text">Add diners at the table to start splitting items.</p>
          <button type="button" class="btn-ghost btn-load-demo-inline" style="margin-top: 0.65rem; color: var(--accent-primary); border-color: var(--accent-primary); font-weight: 600; cursor: pointer;">
            ✨ Load Example Check
          </button>
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
          <button type="button" class="chip-remove-btn" title="Remove ${escapeHtml(p.name)}" aria-label="Remove ${escapeHtml(p.name)}">
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
          Add diners above to assign items.
        </span>
      `;
      return;
    }

    // Preserve valid selections
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
    el.itemsCountBadge.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;

    if (count === 0) {
      el.itemsList.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon">🧾</span>
          <p class="empty-state__text">No items added yet. Enter items from the receipt.</p>
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
        splitLabel = '<span style="color: var(--danger-color);">⚠️ Unassigned</span>';
      } else if (isEveryone) {
        splitLabel = `Split among everyone (${formatMoney(total / assignees.length, currency)} each)`;
      } else if (assignees.length === 1) {
        splitLabel = `Only ${escapeHtml(assignees[0].name)}`;
      } else {
        splitLabel = `${assignees.length} people (${formatMoney(total / assignees.length, currency)} each)`;
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
            <button type="button" class="btn-item-delete" title="Delete item" aria-label="Delete ${escapeHtml(item.name)}">
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
    el.tableTaxDisplay.textContent = state.settings.taxIncluded ? 'Included' : formatMoney(calc.tableTax, currency);
    el.tableGrandTotalDisplay.textContent = formatMoney(calc.tableGrandTotal, currency);

    // Mobile sticky bar
    if (el.mobileGrandTotalDisplay) {
      el.mobileGrandTotalDisplay.textContent = formatMoney(calc.tableGrandTotal, currency);
    }

    // Unassigned items alert banner in Step 3
    const unassignedBanner = document.getElementById('unassignedAlertBanner');
    const unassignedText = document.getElementById('unassignedAlertText');
    if (unassignedBanner) {
      if (calc.unassignedCount > 0) {
        unassignedBanner.style.display = 'block';
        if (unassignedText) {
          unassignedText.textContent = `${calc.unassignedCount} ${calc.unassignedCount === 1 ? 'item is' : 'items are'} unassigned.`;
        }
      } else {
        unassignedBanner.style.display = 'none';
      }
    }

    // Individual Person Cards
    if (calc.participantsList.length === 0) {
      el.personResultsList.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__text">No diners added yet.</p>
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
                    <span class="person-summary-pill">Subtotal: ${formatMoney(person.subtotal, currency)}</span>
                    <span class="person-summary-pill">Tip: ${formatMoney(person.tip, currency)}</span>
                    ${!state.settings.taxIncluded ? `<span class="person-summary-pill">Tax: ${formatMoney(person.tax, currency)}</span>` : ''}
                  </div>
                </div>
              </div>
              <div style="text-align: right;">
                <span class="person-total">${formatMoney(person.total, currency)}</span>
              </div>
            </div>

            <div class="person-details-toggle">
              <button type="button" class="btn-ghost btn-toggle-items" data-items-count="${person.itemsDetailed.length}" style="padding: 0.2rem 0.5rem; font-size: 0.78rem;">
                View items (${person.itemsDetailed.length}) ▾
              </button>
              <button type="button" class="btn-copy-person" data-person-name="${escapeHtml(person.name)}" title="Copy diner breakdown">
                📋 Copy
              </button>
            </div>

            <div class="person-items-breakdown">
              ${person.itemsDetailed.length > 0 ? itemsRows : '<p style="color:var(--text-muted);">No items assigned.</p>'}
            </div>
          </article>
        `;
      }).join('');
    }

    // Update live formatted preview
    const shareText = generateShareMessage(calc);
    if (el.whatsappPreviewText) {
      el.whatsappPreviewText.textContent = shareText;
    }
  }

  /* ==========================================================================
     Share & Message Builders (Venmo / iMessage / SMS / WhatsApp)
     ========================================================================== */

  function generateShareMessage(calc) {
    const currency = calc.currency;
    const lines = [];

    lines.push('🧾 *TabSnap — Bill Breakdown*');
    lines.push(`🍽️ *Table Total:* ${formatMoney(calc.tableGrandTotal, currency)}`);

    let subBreakdown = `💵 *Subtotal:* ${formatMoney(calc.tableSubtotal, currency)}`;
    if (calc.tableTip > 0) {
      const tipLabel = state.settings.tipType === 'percent' ? `${state.settings.tipPercent}%` : 'fixed';
      subBreakdown += ` | *Tip (${tipLabel}):* ${formatMoney(calc.tableTip, currency)}`;
    }
    if (!state.settings.taxIncluded && calc.tableTax > 0) {
      const taxLabel = `${state.settings.taxPercent}%`;
      subBreakdown += ` | *Tax (${taxLabel}):* ${formatMoney(calc.tableTax, currency)}`;
    }
    lines.push(subBreakdown);
    lines.push(`👥 *Diners:* ${calc.participantsList.length} people`);
    lines.push('----------------------------------------');

    calc.participantsList.forEach(p => {
      lines.push(`👤 *${p.name}:* ${formatMoney(p.total, currency)}`);
      if (p.itemsDetailed.length > 0) {
        p.itemsDetailed.forEach(it => {
          const splitText = it.sharedWithCount > 1 ? ` (1/${it.sharedWithCount} of ${formatMoney(it.totalItemPrice, currency)})` : '';
          lines.push(`   • ${it.name}${splitText}: ${formatMoney(it.shareAmount, currency)}`);
        });
      }
      lines.push(`   • Proportional Tip: ${formatMoney(p.tip, currency)}`);
      if (!state.settings.taxIncluded && p.tax > 0) {
        lines.push(`   • Proportional Tax: ${formatMoney(p.tax, currency)}`);
      }
      lines.push('');
    });

    lines.push('----------------------------------------');
    if (state.settings.paymentInfo && state.settings.paymentInfo.trim()) {
      lines.push(`💳 *Payment Info:*\n${state.settings.paymentInfo.trim()}`);
      lines.push('');
    }
    lines.push('✨ Split instantly with https://tabsnap.ecn-apps.com');

    return lines.join('\n');
  }

  function generateSinglePersonMessage(personName) {
    const calc = calculateAll();
    const currency = calc.currency;
    const person = calc.participantsList.find(p => p.name.toLowerCase() === personName.toLowerCase());
    if (!person) return '';

    const lines = [];
    lines.push(`🧾 *TabSnap — Your Tab Breakdown*`);
    lines.push(`👤 *Hi ${person.name}, your total is:* ${formatMoney(person.total, currency)}`);
    lines.push('');
    lines.push('🍽️ *Your items:*');
    person.itemsDetailed.forEach(it => {
      const splitText = it.sharedWithCount > 1 ? ` (1/${it.sharedWithCount})` : '';
      lines.push(` • ${it.name}${splitText}: ${formatMoney(it.shareAmount, currency)}`);
    });
    lines.push(` • Food & drinks subtotal: ${formatMoney(person.subtotal, currency)}`);
    lines.push(` • Proportional tip: ${formatMoney(person.tip, currency)}`);
    if (!state.settings.taxIncluded && person.tax > 0) {
      lines.push(` • Proportional sales tax: ${formatMoney(person.tax, currency)}`);
    }
    lines.push('');
    if (state.settings.paymentInfo && state.settings.paymentInfo.trim()) {
      lines.push(`💳 *Payment Info:*\n${state.settings.paymentInfo.trim()}`);
      lines.push('');
    }
    lines.push('✨ Split tabs at https://tabsnap.ecn-apps.com');

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
          showToast(`"${name}" is already at the table`, 'warning');
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
        showToast(`Added: ${name}`);
      };

      el.btnAddParticipant.addEventListener('click', addParticipantHandler);
      el.participantNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          addParticipantHandler();
        }
      });
    }

    // Quick Diners presets (+ 2, + 3, + 4 Diners)
    const quickDinerButtons = document.querySelectorAll('.btn-preset-chip[data-quick-diners]');
    quickDinerButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetCount = parseInt(btn.dataset.quickDiners, 10) || 2;
        const defaultNames = ['Alex', 'Jordan', 'Taylor', 'Sam', 'Morgan', 'Casey'];
        state.participants = [];
        selectedAssigneeIds.clear();

        for (let i = 0; i < targetCount; i++) {
          const name = defaultNames[i] || `Diner ${i + 1}`;
          const p = {
            id: 'p_' + Date.now() + '_' + i,
            name: name,
            color: AVATAR_COLORS[i % AVATAR_COLORS.length]
          };
          state.participants.push(p);
          selectedAssigneeIds.add(p.id);
        }

        saveState();
        renderAll();
        showToast(`Added ${targetCount} diners! Now add items in Step 2.`);
      });
    });

    // Remove Participant / Inline Demo Delegation
    if (el.participantsList) {
      el.participantsList.addEventListener('click', (e) => {
        const demoBtn = e.target.closest('.btn-load-demo-inline');
        if (demoBtn) {
          loadSampleData();
          renderAll();
          showToast('Sample check loaded!');
          return;
        }

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
          showToast(`Removed: ${removedName}`);
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

    // Add Item (Button and Enter key on form inputs)
    if (el.btnAddItem) {
      el.btnAddItem.addEventListener('click', handleAddItem);
    }

    [el.itemNameInput, el.itemPriceInput, el.itemQtyInput].forEach(inputEl => {
      if (!inputEl) return;
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          handleAddItem();
        }
      });
    });

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
          showToast(`Item removed: ${deletedName}`);
        }
      });
    }

    // Tip Presets (15, 18, 20, 25, custom)
    if (el.tipPresetBtns) {
      el.tipPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.tip;
          el.tipPresetBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          if (val === 'custom') {
            if (el.tipCustomInput) {
              el.tipCustomInput.style.display = 'block';
              if (el.tipCustomInput.value) {
                state.settings.tipType = 'percent';
                state.settings.tipPercent = Math.max(0, parseFloat(el.tipCustomInput.value) || 0);
                saveState();
                renderCalculations();
              }
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

    // Sales Tax Toggle & Input
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
        updateStepVisibility();
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

    // Toggle Details per Diner
    if (el.personResultsList) {
      el.personResultsList.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.btn-toggle-items');
        if (toggleBtn) {
          const card = toggleBtn.closest('.person-card');
          const breakdown = card.querySelector('.person-items-breakdown');
          if (breakdown) {
            const count = toggleBtn.dataset.itemsCount || '';
            const suffix = count ? ` (${count})` : '';
            toggleBtn.textContent = breakdown.classList.contains('open') ? 'Hide items ▴' : `View items${suffix} ▾`;
          }
          return;
        }

        const copyPersonBtn = e.target.closest('.btn-copy-person');
        if (copyPersonBtn) {
          const personName = copyPersonBtn.dataset.personName;
          const msg = generateSinglePersonMessage(personName);
          copyToClipboard(msg, `Copied ${personName}'s breakdown!`);
        }
      });
    }

    // Primary Copy Summary for Venmo / Messages
    if (el.btnCopySummary) {
      el.btnCopySummary.addEventListener('click', () => {
        const calc = calculateAll();
        const text = generateShareMessage(calc);
        copyToClipboard(text, 'Bill summary copied to clipboard! Ready to paste into Venmo, Messages, or WhatsApp.');
      });
    }

    // Native Share Sheet (iMessage, SMS, WhatsApp, Slack, etc.)
    if (el.btnShareNative) {
      el.btnShareNative.addEventListener('click', async () => {
        const calc = calculateAll();
        const text = generateShareMessage(calc);
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'TabSnap — Bill Breakdown',
              text: text
            });
            showToast('Tab shared successfully!');
            return;
          } catch (err) {
            if (err.name === 'AbortError') {
              return;
            }
            console.debug('Native share cancelled or failed:', err);
          }
        }
        // Fallback to clipboard only if navigator.share is unsupported or failed with system error
        copyToClipboard(text, 'Summary copied to clipboard!');
      });
    }

    // Mobile Sticky Bar Copy / Share
    if (el.btnMobileShare) {
      el.btnMobileShare.addEventListener('click', async () => {
        const calc = calculateAll();
        const text = generateShareMessage(calc);
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'TabSnap — Bill Breakdown',
              text: text
            });
            showToast('Tab shared successfully!');
            return;
          } catch (err) {
            if (err.name === 'AbortError') {
              return;
            }
            console.debug('Native share error:', err);
          }
        }
        copyToClipboard(text, 'Bill summary copied to clipboard!');
      });
    }

    // WhatsApp direct link
    if (el.btnOpenWhatsApp) {
      el.btnOpenWhatsApp.addEventListener('click', () => {
        const calc = calculateAll();
        const text = generateShareMessage(calc);
        const encoded = encodeURIComponent(text);
        window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
      });
    }

    // Demo / Sample Table Loader
    const loadDemoHandler = () => {
      loadSampleData();
      renderAll();
      showToast('Sample check loaded!');
    };

    if (el.btnDemoTable) {
      el.btnDemoTable.addEventListener('click', loadDemoHandler);
    }

    if (el.btnQuickDemo) {
      el.btnQuickDemo.addEventListener('click', loadDemoHandler);
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
        initCleanState();
        renderAll();
        el.resetModalOverlay.classList.remove('active');
        showToast('Table cleared from scratch');
      });
    }

    if (el.resetModalOverlay) {
      // Close on backdrop click
      el.resetModalOverlay.addEventListener('click', (e) => {
        if (e.target === el.resetModalOverlay) {
          el.resetModalOverlay.classList.remove('active');
        }
      });
      // Close on Escape key
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && el.resetModalOverlay.classList.contains('active')) {
          el.resetModalOverlay.classList.remove('active');
        }
      });
    }
  }

  function handleAddItem() {
    const name = el.itemNameInput.value.trim();
    const price = parseFloat(el.itemPriceInput.value);
    const qty = Math.max(1, Math.min(99, parseInt(el.itemQtyInput.value, 10) || 1));

    if (!name) {
      showToast('Please enter the item or dish name', 'warning');
      el.itemNameInput.focus();
      return;
    }

    if (isNaN(price) || price < 0) {
      showToast('Please enter a valid price', 'warning');
      el.itemPriceInput.focus();
      return;
    }

    if (state.participants.length === 0) {
      showToast('Add at least 1 diner to the table first', 'warning');
      el.participantNameInput.focus();
      return;
    }

    if (selectedAssigneeIds.size === 0) {
      showToast('Select who ordered or shared this item', 'warning');
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
    showToast(`Added: ${name}`);
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

  async function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        textarea.style.fontSize = '16px';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!successful) throw new Error('execCommand failed');
      }
      showToast(successMessage);
    } catch (err) {
      console.error('Error copying text:', err);
      showToast('Could not copy automatically. You can select and copy the text preview.', 'warning');
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
