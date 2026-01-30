/**
 * AutoKey Web - Frontend Logic
 * Handles drag-and-drop, pattern management, and sequence execution
 */

// ============================================================================
// Global State
// ============================================================================

let sequenceModified = false;  // Track unsaved changes
let currentPatternName = null; // Currently loaded pattern name
let itemIdCounter = 0;         // Unique ID counter for sequence items

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
    // Panels
    toolbox: document.getElementById('toolbox'),
    sequence: document.getElementById('sequence'),
    emptySequence: document.getElementById('emptySequence'),
    
    // Patterns
    patternsSection: document.querySelector('.patterns-section'),
    patternsToggle: document.getElementById('patternsToggle'),
    patternsContent: document.getElementById('patternsContent'),
    patternsGrid: document.getElementById('patternsGrid'),
    patternCount: document.getElementById('patternCount'),
    emptyPatterns: document.getElementById('emptyPatterns'),
    togglePatternsBtn: document.getElementById('togglePatternsBtn'),
    
    // Target
    targetModeAuto: document.getElementById('targetModeAuto'),
    targetModeManual: document.getElementById('targetModeManual'),
    windowSelect: document.getElementById('windowSelect'),
    refreshWindowsBtn: document.getElementById('refreshWindowsBtn'),
    
    // Settings
    loopCount: document.getElementById('loopCount'),
    startDelay: document.getElementById('startDelay'),
    
    // Action buttons
    runBtn: document.getElementById('runBtn'),
    savePatternBtn: document.getElementById('savePatternBtn'),
    loadJsonBtn: document.getElementById('loadJsonBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    jsonFileInput: document.getElementById('jsonFileInput'),
    
    // Confirm Modal
    confirmModal: document.getElementById('confirmModal'),
    confirmTarget: document.getElementById('confirmTarget'),
    confirmSteps: document.getElementById('confirmSteps'),
    confirmLoops: document.getElementById('confirmLoops'),
    confirmDelay: document.getElementById('confirmDelay'),
    confirmCancel: document.getElementById('confirmCancel'),
    confirmRun: document.getElementById('confirmRun'),
    
    // Save Pattern Modal
    savePatternModal: document.getElementById('savePatternModal'),
    patternName: document.getElementById('patternName'),
    patternDescription: document.getElementById('patternDescription'),
    includeSettings: document.getElementById('includeSettings'),
    savePatternCancel: document.getElementById('savePatternCancel'),
    savePatternConfirm: document.getElementById('savePatternConfirm'),
    
    // Overwrite Modal
    overwriteModal: document.getElementById('overwriteModal'),
    overwritePatternName: document.getElementById('overwritePatternName'),
    overwriteCancel: document.getElementById('overwriteCancel'),
    overwriteConfirm: document.getElementById('overwriteConfirm'),
    
    // Unsaved Modal
    unsavedModal: document.getElementById('unsavedModal'),
    unsavedCancel: document.getElementById('unsavedCancel'),
    unsavedConfirm: document.getElementById('unsavedConfirm'),
    
    // Delete Modal
    deleteModal: document.getElementById('deleteModal'),
    deletePatternName: document.getElementById('deletePatternName'),
    deleteCancel: document.getElementById('deleteCancel'),
    deleteConfirm: document.getElementById('deleteConfirm'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastIcon: document.getElementById('toastIcon'),
    toastMessage: document.getElementById('toastMessage')
};

// ============================================================================
// Utility Functions
// ============================================================================

function showToast(message, type = 'success') {
    const icons = {
        success: '&#10004;',
        error: '&#10006;',
        warning: '&#9888;'
    };
    
    elements.toast.className = `toast ${type}`;
    elements.toastIcon.innerHTML = icons[type] || icons.success;
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 4000);
}

function showModal(modal) {
    modal.classList.add('active');
}

function hideModal(modal) {
    modal.classList.remove('active');
}

function generateItemId() {
    return `item-${Date.now()}-${itemIdCounter++}`;
}

function updateEmptyState() {
    const hasItems = elements.sequence.querySelectorAll('.sequence-item').length > 0;
    elements.emptySequence.style.display = hasItems ? 'none' : 'flex';
}

function markModified() {
    sequenceModified = true;
}

// ============================================================================
// Sortable.js Initialization
// ============================================================================

function initSortable() {
    // Toolbox - clone items to sequence
    new Sortable(elements.toolbox, {
        group: {
            name: 'shared',
            pull: 'clone',
            put: false
        },
        sort: false,
        animation: 150,
        onClone: function(evt) {
            // The cloned item that goes to the sequence
            const clone = evt.clone;
            clone.classList.remove('toolbox-item');
            clone.classList.add('sequence-item');
            clone.setAttribute('id', generateItemId());
            
            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.onclick = function(e) {
                e.stopPropagation();
                clone.remove();
                updateEmptyState();
                markModified();
            };
            clone.appendChild(deleteBtn);
        }
    });
    
    // Sequence - receive items and reorder
    new Sortable(elements.sequence, {
        group: {
            name: 'shared',
            pull: false,
            put: true
        },
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        filter: '.empty-sequence',
        onAdd: function(evt) {
            updateEmptyState();
            markModified();
            
            // Setup hotkey add button handler for newly added items
            const item = evt.item;
            if (item.dataset.action === 'hotkey') {
                setupHotkeyAddButton(item);
            }
        },
        onSort: function() {
            markModified();
        }
    });
}

// ============================================================================
// Hotkey Combo Handler
// ============================================================================

function setupHotkeyAddButton(item) {
    const addBtn = item.querySelector('.add-key-btn');
    if (!addBtn) return;
    
    addBtn.onclick = function(e) {
        e.stopPropagation();
        
        const hotkeySelects = item.querySelector('.hotkey-selects');
        const existingSelects = hotkeySelects.querySelectorAll('.hotkey-select');
        
        // Limit to 4 keys
        if (existingSelects.length >= 4) {
            showToast('Maximum 4 keys allowed', 'warning');
            return;
        }
        
        // Create new key selector
        const plus = document.createElement('span');
        plus.className = 'hotkey-plus';
        plus.textContent = '+';
        
        const newSelect = document.createElement('select');
        newSelect.className = 'field-select hotkey-select';
        newSelect.dataset.field = `key${existingSelects.length + 1}`;
        newSelect.innerHTML = existingSelects[1].innerHTML; // Copy options from second select
        
        hotkeySelects.appendChild(plus);
        hotkeySelects.appendChild(newSelect);
        
        markModified();
    };
}

// ============================================================================
// Extract Sequence Data from DOM
// ============================================================================

function getSequenceData() {
    const items = elements.sequence.querySelectorAll('.sequence-item');
    const sequence = [];
    
    items.forEach(item => {
        const action = item.dataset.action;
        const step = { action };
        
        if (action === 'type') {
            step.value = item.querySelector('[data-field="value"]').value;
            step.interval = parseFloat(item.querySelector('[data-field="interval"]').value) || 0;
        } else if (action === 'type_range') {
            step.start = parseInt(item.querySelector('[data-field="start"]').value) || 0;
            step.end = parseInt(item.querySelector('[data-field="end"]').value) || 0;
            step.interval = parseFloat(item.querySelector('[data-field="interval"]').value) || 0;
        } else if (action === 'key') {
            step.value = item.querySelector('[data-field="value"]').value;
        } else if (action === 'hotkey') {
            const keys = [];
            item.querySelectorAll('.hotkey-select').forEach(select => {
                if (select.value) {
                    keys.push(select.value);
                }
            });
            step.keys = keys;
        } else if (action === 'wait') {
            step.value = parseFloat(item.querySelector('[data-field="value"]').value) || 0;
        }
        
        sequence.push(step);
    });
    
    return sequence;
}

function getFullPayload() {
    return {
        target_window: elements.targetModeAuto.checked ? elements.windowSelect.value : null,
        target_mode: elements.targetModeAuto.checked ? 'auto' : 'manual',
        start_delay: parseInt(elements.startDelay.value) || 3,
        loop_count: parseInt(elements.loopCount.value) || 1,
        sequence: getSequenceData()
    };
}

// ============================================================================
// Rebuild Sequence DOM from Data
// ============================================================================

function clearSequence() {
    const items = elements.sequence.querySelectorAll('.sequence-item');
    items.forEach(item => item.remove());
    updateEmptyState();
}

function createSequenceItem(step) {
    // Find the matching toolbox item
    const toolboxItem = elements.toolbox.querySelector(`[data-action="${step.action}"]`);
    if (!toolboxItem) return null;
    
    // Clone it
    const item = toolboxItem.cloneNode(true);
    item.classList.remove('toolbox-item');
    item.classList.add('sequence-item');
    item.setAttribute('id', generateItemId());
    
    // Populate values
    if (step.action === 'type') {
        item.querySelector('[data-field="value"]').value = step.value || '';
        item.querySelector('[data-field="interval"]').value = step.interval || 0;
    } else if (step.action === 'type_range') {
        item.querySelector('[data-field="start"]').value = step.start || 0;
        item.querySelector('[data-field="end"]').value = step.end || 0;
        item.querySelector('[data-field="interval"]').value = step.interval || 0;
    } else if (step.action === 'key') {
        item.querySelector('[data-field="value"]').value = step.value || '';
    } else if (step.action === 'hotkey') {
        const keys = step.keys || [];
        const hotkeySelects = item.querySelector('.hotkey-selects');
        
        // Set first two keys
        const selects = item.querySelectorAll('.hotkey-select');
        if (keys[0] && selects[0]) selects[0].value = keys[0];
        if (keys[1] && selects[1]) selects[1].value = keys[1];
        
        // Add additional keys if present
        for (let i = 2; i < keys.length && i < 4; i++) {
            const plus = document.createElement('span');
            plus.className = 'hotkey-plus';
            plus.textContent = '+';
            
            const newSelect = document.createElement('select');
            newSelect.className = 'field-select hotkey-select';
            newSelect.dataset.field = `key${i + 1}`;
            newSelect.innerHTML = selects[1].innerHTML;
            newSelect.value = keys[i];
            
            hotkeySelects.appendChild(plus);
            hotkeySelects.appendChild(newSelect);
        }
        
        // Setup add button
        setupHotkeyAddButton(item);
    } else if (step.action === 'wait') {
        item.querySelector('[data-field="value"]').value = step.value || 0;
    }
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = function(e) {
        e.stopPropagation();
        item.remove();
        updateEmptyState();
        markModified();
    };
    item.appendChild(deleteBtn);
    
    return item;
}

function loadSequenceFromData(data) {
    clearSequence();
    
    // Load settings if present
    if (data.target_window) {
        elements.targetModeAuto.checked = true;
        elements.windowSelect.disabled = false;
        // Try to set the window (may need to refresh list first)
        elements.windowSelect.value = data.target_window;
    } else {
        elements.targetModeManual.checked = true;
        elements.windowSelect.disabled = true;
    }
    
    if (data.loop_count) elements.loopCount.value = data.loop_count;
    if (data.start_delay !== undefined) elements.startDelay.value = data.start_delay;
    
    // Load sequence items
    const sequence = data.sequence || [];
    sequence.forEach(step => {
        const item = createSequenceItem(step);
        if (item) {
            elements.sequence.appendChild(item);
        }
    });
    
    updateEmptyState();
    sequenceModified = false;
}

// ============================================================================
// Window List Management
// ============================================================================

async function refreshWindowList() {
    try {
        const response = await fetch('/windows');
        const data = await response.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        // Preserve current selection
        const currentValue = elements.windowSelect.value;
        
        // Clear and repopulate
        elements.windowSelect.innerHTML = '<option value="">Select a window...</option>';
        
        data.windows.forEach(windowTitle => {
            const option = document.createElement('option');
            option.value = windowTitle;
            option.textContent = windowTitle;
            elements.windowSelect.appendChild(option);
        });
        
        // Try to restore selection
        if (currentValue) {
            elements.windowSelect.value = currentValue;
        }
        
        showToast(`Found ${data.windows.length} windows`, 'success');
    } catch (error) {
        showToast('Failed to fetch window list', 'error');
        console.error(error);
    }
}

// ============================================================================
// Pattern Management
// ============================================================================

async function loadPatternsList() {
    try {
        const response = await fetch('/patterns');
        const data = await response.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        const patterns = data.patterns || [];
        elements.patternCount.textContent = patterns.length;
        
        // Clear grid
        elements.patternsGrid.innerHTML = '';
        
        if (patterns.length === 0) {
            elements.patternsGrid.appendChild(elements.emptyPatterns.cloneNode(true));
            return;
        }
        
        patterns.forEach(pattern => {
            const card = createPatternCard(pattern);
            elements.patternsGrid.appendChild(card);
        });
    } catch (error) {
        showToast('Failed to load patterns', 'error');
        console.error(error);
    }
}

function createPatternCard(pattern) {
    const card = document.createElement('div');
    card.className = 'pattern-card';
    card.innerHTML = `
        <div class="pattern-name" title="${pattern.name}">${pattern.name}</div>
        <div class="pattern-meta">${pattern.step_count} steps &bull; ${pattern.loop_count} loop(s)</div>
        <div class="pattern-actions">
            <button class="btn btn-small load-pattern-btn" data-name="${pattern.name}">Load</button>
            <button class="btn btn-small copy-pattern-btn" data-name="${pattern.name}">Copy</button>
            <button class="btn btn-small btn-danger delete-pattern-btn" data-name="${pattern.name}">&#128465;</button>
        </div>
    `;
    
    // Event handlers
    card.querySelector('.load-pattern-btn').onclick = () => handleLoadPattern(pattern.name);
    card.querySelector('.copy-pattern-btn').onclick = () => handleDuplicatePattern(pattern.name);
    card.querySelector('.delete-pattern-btn').onclick = () => handleDeletePattern(pattern.name);
    
    return card;
}

async function handleLoadPattern(name) {
    // Check for unsaved changes
    if (sequenceModified) {
        pendingPatternLoad = name;
        showModal(elements.unsavedModal);
        return;
    }
    
    await loadPattern(name);
}

let pendingPatternLoad = null;

async function loadPattern(name) {
    try {
        const response = await fetch(`/patterns/${encodeURIComponent(name)}`);
        const data = await response.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        loadSequenceFromData(data);
        currentPatternName = name;
        showToast(`Pattern "${name}" loaded`, 'success');
    } catch (error) {
        showToast('Failed to load pattern', 'error');
        console.error(error);
    }
}

async function handleDuplicatePattern(name) {
    try {
        const response = await fetch(`/patterns/${encodeURIComponent(name)}/duplicate`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        showToast(data.message, 'success');
        await loadPatternsList();
    } catch (error) {
        showToast('Failed to duplicate pattern', 'error');
        console.error(error);
    }
}

let pendingPatternDelete = null;

function handleDeletePattern(name) {
    pendingPatternDelete = name;
    elements.deletePatternName.textContent = name;
    showModal(elements.deleteModal);
}

async function deletePattern(name) {
    try {
        const response = await fetch(`/patterns/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        showToast(data.message, 'success');
        await loadPatternsList();
    } catch (error) {
        showToast('Failed to delete pattern', 'error');
        console.error(error);
    }
}

// ============================================================================
// Save Pattern
// ============================================================================

let pendingSaveData = null;

function handleSavePattern() {
    const sequence = getSequenceData();
    
    if (sequence.length === 0) {
        showToast('Sequence is empty', 'warning');
        return;
    }
    
    // Pre-fill with current pattern name if loaded
    elements.patternName.value = currentPatternName || '';
    elements.patternDescription.value = '';
    
    showModal(elements.savePatternModal);
}

async function savePattern(overwrite = false) {
    const name = elements.patternName.value.trim();
    
    if (!name) {
        showToast('Pattern name is required', 'warning');
        return;
    }
    
    const payload = {
        name: name,
        description: elements.patternDescription.value.trim(),
        ...getFullPayload()
    };
    
    // If not including settings, remove them
    if (!elements.includeSettings.checked) {
        payload.target_window = null;
        payload.target_mode = 'manual';
        payload.start_delay = 3;
        payload.loop_count = 1;
    }
    
    try {
        // Check if pattern exists (unless we're overwriting)
        if (!overwrite) {
            const checkResponse = await fetch(`/patterns/${encodeURIComponent(name)}`);
            if (checkResponse.ok) {
                // Pattern exists, ask for confirmation
                pendingSaveData = payload;
                elements.overwritePatternName.textContent = name;
                hideModal(elements.savePatternModal);
                showModal(elements.overwriteModal);
                return;
            }
        }
        
        const response = await fetch('/patterns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        hideModal(elements.savePatternModal);
        hideModal(elements.overwriteModal);
        currentPatternName = name;
        sequenceModified = false;
        showToast(data.message, 'success');
        await loadPatternsList();
    } catch (error) {
        showToast('Failed to save pattern', 'error');
        console.error(error);
    }
}

// ============================================================================
// JSON Import/Export
// ============================================================================

function handleExportJson() {
    const sequence = getSequenceData();
    
    if (sequence.length === 0) {
        showToast('Sequence is empty', 'warning');
        return;
    }
    
    const payload = getFullPayload();
    payload.name = currentPatternName || 'Untitled Sequence';
    payload.description = '';
    payload.created_at = new Date().toISOString();
    payload.updated_at = new Date().toISOString();
    
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${payload.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Sequence exported', 'success');
}

function handleLoadJson() {
    elements.jsonFileInput.click();
}

function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            loadSequenceFromData(data);
            currentPatternName = data.name || null;
            showToast('Sequence loaded from file', 'success');
        } catch (error) {
            showToast('Invalid JSON file', 'error');
            console.error(error);
        }
    };
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    event.target.value = '';
}

// ============================================================================
// Run Sequence
// ============================================================================

function handleRunClick() {
    const sequence = getSequenceData();
    
    if (sequence.length === 0) {
        showToast('Sequence is empty', 'warning');
        return;
    }
    
    // Populate confirmation modal
    const targetMode = elements.targetModeAuto.checked ? 'auto' : 'manual';
    const targetWindow = elements.windowSelect.value;
    
    if (targetMode === 'auto' && targetWindow) {
        elements.confirmTarget.textContent = targetWindow;
    } else {
        elements.confirmTarget.textContent = 'Manual mode (switch during delay)';
    }
    
    elements.confirmSteps.textContent = sequence.length;
    elements.confirmLoops.textContent = elements.loopCount.value;
    elements.confirmDelay.textContent = elements.startDelay.value;
    
    showModal(elements.confirmModal);
}

async function runSequence() {
    hideModal(elements.confirmModal);
    
    const payload = getFullPayload();
    
    // Validate
    if (payload.target_mode === 'auto' && !payload.target_window) {
        showToast('Please select a target window or use manual mode', 'warning');
        return;
    }
    
    showToast('Starting sequence...', 'success');
    
    try {
        const response = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        showToast(data.message, 'success');
    } catch (error) {
        showToast('Failed to run sequence', 'error');
        console.error(error);
    }
}

// ============================================================================
// Event Listeners
// ============================================================================

function initEventListeners() {
    // Patterns toggle
    elements.patternsToggle.onclick = () => {
        elements.patternsSection.classList.toggle('collapsed');
    };
    
    // Target mode radio buttons
    elements.targetModeAuto.onchange = () => {
        elements.windowSelect.disabled = !elements.targetModeAuto.checked;
        if (elements.targetModeAuto.checked && elements.windowSelect.options.length <= 1) {
            refreshWindowList();
        }
    };
    
    elements.targetModeManual.onchange = () => {
        elements.windowSelect.disabled = !elements.targetModeAuto.checked;
    };
    
    // Refresh windows button
    elements.refreshWindowsBtn.onclick = refreshWindowList;
    
    // Action buttons
    elements.runBtn.onclick = handleRunClick;
    elements.savePatternBtn.onclick = handleSavePattern;
    elements.loadJsonBtn.onclick = handleLoadJson;
    elements.exportJsonBtn.onclick = handleExportJson;
    elements.jsonFileInput.onchange = handleFileSelected;
    
    // Confirm modal
    elements.confirmCancel.onclick = () => hideModal(elements.confirmModal);
    elements.confirmRun.onclick = runSequence;
    
    // Save pattern modal
    elements.savePatternCancel.onclick = () => hideModal(elements.savePatternModal);
    elements.savePatternConfirm.onclick = () => savePattern(false);
    
    // Overwrite modal
    elements.overwriteCancel.onclick = () => {
        hideModal(elements.overwriteModal);
        showModal(elements.savePatternModal);
    };
    elements.overwriteConfirm.onclick = () => savePattern(true);
    
    // Unsaved changes modal
    elements.unsavedCancel.onclick = () => {
        hideModal(elements.unsavedModal);
        pendingPatternLoad = null;
    };
    elements.unsavedConfirm.onclick = async () => {
        hideModal(elements.unsavedModal);
        if (pendingPatternLoad) {
            await loadPattern(pendingPatternLoad);
            pendingPatternLoad = null;
        }
    };
    
    // Delete modal
    elements.deleteCancel.onclick = () => {
        hideModal(elements.deleteModal);
        pendingPatternDelete = null;
    };
    elements.deleteConfirm.onclick = async () => {
        hideModal(elements.deleteModal);
        if (pendingPatternDelete) {
            await deletePattern(pendingPatternDelete);
            pendingPatternDelete = null;
        }
    };
    
    // Close modals on backdrop click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.onclick = (e) => {
            if (e.target === modal) {
                hideModal(modal);
            }
        };
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                hideModal(modal);
            });
        }
        
        // Ctrl+S to save pattern
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            handleSavePattern();
        }
        
        // Ctrl+Enter to run
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            handleRunClick();
        }
    });
    
    // Mark as modified when inputs change in sequence
    elements.sequence.addEventListener('input', markModified);
    elements.sequence.addEventListener('change', markModified);
    
    // Warn before leaving with unsaved changes
    window.onbeforeunload = (e) => {
        if (sequenceModified) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    };
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    initSortable();
    initEventListeners();
    
    // Load initial data
    await loadPatternsList();
    
    // Initial state
    updateEmptyState();
    
    console.log('AutoKey Web initialized');
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
