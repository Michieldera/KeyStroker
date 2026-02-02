/**
 * KeyStroker - Frontend Logic
 * Handles drag-and-drop, pattern management, and sequence execution
 */

// ============================================================================
// Global State
// ============================================================================

let sequenceModified = false;  // Track unsaved changes
let currentPatternName = null; // Currently loaded pattern name
let itemIdCounter = 0;         // Unique ID counter for sequence items

// Undo/Redo history
const MAX_HISTORY = 50;
let undoStack = [];
let redoStack = [];
let isUndoRedo = false; // Flag to prevent saving state during undo/redo

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
    // Panels
    toolbox: document.getElementById('toolbox'),
    sequence: document.getElementById('sequence'),
    emptySequence: document.getElementById('emptySequence'),
    startupSequence: document.getElementById('startupSequence'),
    emptyStartup: document.getElementById('emptyStartup'),
    
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
    defaultDelay: document.getElementById('defaultDelay'),
    applyDefaultDelayBtn: document.getElementById('applyDefaultDelay'),
    
    // Action buttons
    runBtn: document.getElementById('runBtn'),
    savePatternBtn: document.getElementById('savePatternBtn'),
    loadJsonBtn: document.getElementById('loadJsonBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    jsonFileInput: document.getElementById('jsonFileInput'),
    
    // Confirm Modal
    confirmModal: document.getElementById('confirmModal'),
    confirmTarget: document.getElementById('confirmTarget'),
    confirmStartupSteps: document.getElementById('confirmStartupSteps'),
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
    
    // Clear Modal
    clearSequenceBtn: document.getElementById('clearSequenceBtn'),
    clearModal: document.getElementById('clearModal'),
    clearCancel: document.getElementById('clearCancel'),
    clearConfirm: document.getElementById('clearConfirm'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastIcon: document.getElementById('toastIcon'),
    toastMessage: document.getElementById('toastMessage'),
    
    // Execution Overlay
    executionOverlay: document.getElementById('executionOverlay'),
    countdownDisplay: document.getElementById('countdownDisplay'),
    countdownNumber: document.getElementById('countdownNumber'),
    executionProgress: document.getElementById('executionProgress'),
    currentLoop: document.getElementById('currentLoop'),
    totalLoops: document.getElementById('totalLoops'),
    currentStep: document.getElementById('currentStep'),
    totalSteps: document.getElementById('totalSteps'),
    progressBar: document.getElementById('progressBar'),
    
    // Version and Update
    versionDisplay: document.getElementById('versionDisplay'),
    checkUpdateBtn: document.getElementById('checkUpdateBtn'),
    updateModal: document.getElementById('updateModal'),
    updateCurrentVersion: document.getElementById('updateCurrentVersion'),
    updateNewVersion: document.getElementById('updateNewVersion'),
    updateReleaseName: document.getElementById('updateReleaseName'),
    updateReleaseNotes: document.getElementById('updateReleaseNotes'),
    updateLater: document.getElementById('updateLater'),
    updateDownloadBtn: document.getElementById('updateDownloadBtn')
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

function updateStartupEmptyState() {
    const hasItems = elements.startupSequence.querySelectorAll('.sequence-item').length > 0;
    elements.emptyStartup.style.display = hasItems ? 'none' : 'flex';
}

function markModified() {
    sequenceModified = true;
}

// ============================================================================
// Undo/Redo System
// ============================================================================

function saveState() {
    if (isUndoRedo) return;
    
    const state = {
        startup: getStartupSequenceData(),
        main: getSequenceData()
    };
    undoStack.push(JSON.stringify(state));
    
    // Limit stack size
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    redoStack = [];
    
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    
    // Save current state to redo stack
    const currentState = {
        startup: getStartupSequenceData(),
        main: getSequenceData()
    };
    redoStack.push(JSON.stringify(currentState));
    
    // Get previous state
    const previousState = undoStack.pop();
    
    // Apply previous state
    isUndoRedo = true;
    restoreSequenceFromState(JSON.parse(previousState));
    isUndoRedo = false;
    
    updateUndoRedoButtons();
    showToast('Undo successful', 'success');
}

function redo() {
    if (redoStack.length === 0) return;
    
    // Save current state to undo stack
    const currentState = {
        startup: getStartupSequenceData(),
        main: getSequenceData()
    };
    undoStack.push(JSON.stringify(currentState));
    
    // Get next state
    const nextState = redoStack.pop();
    
    // Apply next state
    isUndoRedo = true;
    restoreSequenceFromState(JSON.parse(nextState));
    isUndoRedo = false;
    
    updateUndoRedoButtons();
    showToast('Redo successful', 'success');
}

function restoreSequenceFromState(state) {
    clearAllSequences();
    
    // Restore startup sequence
    const startup = state.startup || [];
    startup.forEach(step => {
        const item = createSequenceItem(step);
        if (item) {
            elements.startupSequence.appendChild(item);
        }
    });
    
    // Restore main sequence
    const main = state.main || [];
    main.forEach(step => {
        const item = createSequenceItem(step);
        if (item) {
            elements.sequence.appendChild(item);
        }
    });
    
    updateEmptyState();
    updateStartupEmptyState();
    markModified();
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
        undoBtn.disabled = undoStack.length === 0;
        undoBtn.title = undoStack.length > 0 ? `Undo (${undoStack.length} actions)` : 'Nothing to undo';
    }
    if (redoBtn) {
        redoBtn.disabled = redoStack.length === 0;
        redoBtn.title = redoStack.length > 0 ? `Redo (${redoStack.length} actions)` : 'Nothing to redo';
    }
}

// ============================================================================
// Sequence Tabs
// ============================================================================

function initSequenceTabs() {
    const tabs = document.querySelectorAll('.sequence-tab');
    const startupDropzone = elements.startupSequence;
    const mainDropzone = elements.sequence;
    
    tabs.forEach(tab => {
        tab.onclick = () => {
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show/hide dropzones
            if (tab.dataset.tab === 'startup') {
                startupDropzone.style.display = 'block';
                mainDropzone.style.display = 'none';
            } else {
                startupDropzone.style.display = 'none';
                mainDropzone.style.display = 'block';
            }
        };
    });
}

// ============================================================================
// Sortable.js Initialization
// ============================================================================

/**
 * Add a delete button to a sequence item
 */
function addDeleteButton(item) {
    // Check if already has delete button
    if (item.querySelector('.delete-btn')) return;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = function(e) {
        e.stopPropagation();
        saveState();
        const parent = item.parentElement;
        item.remove();
        
        // Update empty state for main sequence
        updateEmptyState();
        
        // Update empty state for repeat block if inside one
        if (parent && parent.classList.contains('repeat-dropzone')) {
            updateRepeatDropzoneEmpty(parent);
        }
        
        markModified();
    };
    item.appendChild(deleteBtn);
}

/**
 * Update the empty message visibility in a repeat dropzone
 */
function updateRepeatDropzoneEmpty(dropzone) {
    const children = dropzone.querySelectorAll(':scope > .sequence-item');
    const emptyMsg = dropzone.querySelector('.repeat-empty');
    if (emptyMsg) {
        emptyMsg.style.display = children.length === 0 ? 'block' : 'none';
    }
}

/**
 * Initialize Sortable for a repeat block's nested dropzone
 */
function initRepeatBlockSortable(repeatItem) {
    const dropzone = repeatItem.querySelector('.repeat-dropzone');
    if (!dropzone || dropzone.dataset.sortableInit === 'true') return;
    
    dropzone.dataset.sortableInit = 'true';
    
    new Sortable(dropzone, {
        group: {
            name: 'shared',
            pull: true,   // Allow items to be moved out to main sequence or other repeat blocks
            put: function(to, from, item) {
                // Prevent nesting repeat blocks inside repeat blocks
                return item.dataset.action !== 'repeat';
            }
        },
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        
        // Auto-scroll options
        scroll: true,
        scrollSensitivity: 80,
        scrollSpeed: 10,
        bubbleScroll: true,
        onAdd: function(evt) {
            const item = evt.item;
            
            // Ensure it's converted to sequence-item
            item.classList.remove('toolbox-item');
            item.classList.add('sequence-item');
            if (!item.id) {
                item.setAttribute('id', generateItemId());
            }
            
            // Add delete button if not present
            addDeleteButton(item);
            
            // Setup hotkey handler if needed
            if (item.dataset.action === 'hotkey') {
                setupHotkeyAddButton(item);
            }
            
            // Setup coords toggle for mouse click
            if (item.dataset.action === 'click') {
                setupCoordsToggle(item);
            }
            
            // Setup pick coords button for mouse actions
            if (item.dataset.action === 'click' || item.dataset.action === 'move_mouse') {
                setupPickCoordsButton(item);
            }
            
            // Setup padding toggle for type_range
            if (item.dataset.action === 'type_range') {
                setupPaddingToggle(item);
            }
            
            // Hide empty message
            updateRepeatDropzoneEmpty(dropzone);
            
            saveState();
            markModified();
        },
        onRemove: function(evt) {
            // Item was moved out of this repeat block
            updateRepeatDropzoneEmpty(dropzone);
            saveState();
            markModified();
        },
        onSort: function() {
            saveState();
            markModified();
        }
    });
}

function initSortable() {
    // Toolbox - clone items to sequence
    new Sortable(elements.toolbox, {
        group: {
            name: 'shared',
            pull: 'clone',
            put: false
        },
        sort: false,
        animation: 150
        // Note: Don't use onClone here - evt.clone refers to the copy that stays in toolbox
        // All setup is done in the sequence's onAdd callback
    });
    
    // Startup Sequence - receive items and reorder
    new Sortable(elements.startupSequence, {
        group: {
            name: 'shared',
            pull: true,
            put: true
        },
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        filter: '.empty-sequence',
        
        // Auto-scroll options
        scroll: true,
        scrollSensitivity: 80,
        scrollSpeed: 10,
        bubbleScroll: true,
        onAdd: function(evt) {
            const item = evt.item;
            
            // Convert from toolbox item to sequence item
            item.classList.remove('toolbox-item');
            item.classList.remove('repeat-block-item');
            item.classList.add('sequence-item');
            
            // Assign unique ID if not present
            if (!item.id) {
                item.setAttribute('id', generateItemId());
            }
            
            // Add delete button if not present
            addDeleteButton(item);
            
            // Setup hotkey add button handler for newly added items
            if (item.dataset.action === 'hotkey') {
                setupHotkeyAddButton(item);
            }
            
            // Setup coords toggle for mouse click
            if (item.dataset.action === 'click') {
                setupCoordsToggle(item);
            }
            
            // Setup pick coords button for mouse actions
            if (item.dataset.action === 'click' || item.dataset.action === 'move_mouse') {
                setupPickCoordsButton(item);
            }
            
            // Setup padding toggle for type_range
            if (item.dataset.action === 'type_range') {
                setupPaddingToggle(item);
            }
            
            // Initialize repeat block sortable if needed
            if (item.dataset.action === 'repeat') {
                initRepeatBlockSortable(item);
            }
            
            updateStartupEmptyState();
            saveState();
            markModified();
        },
        onRemove: function(evt) {
            updateStartupEmptyState();
            saveState();
            markModified();
        },
        onSort: function() {
            saveState();
            markModified();
        }
    });
    
    // Main Sequence - receive items and reorder
    new Sortable(elements.sequence, {
        group: {
            name: 'shared',
            pull: true,
            put: true
        },
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        filter: '.empty-sequence',
        
        // Auto-scroll options
        scroll: true,
        scrollSensitivity: 80,
        scrollSpeed: 10,
        bubbleScroll: true,
        onAdd: function(evt) {
            const item = evt.item;
            
            // Convert from toolbox item to sequence item
            item.classList.remove('toolbox-item');
            item.classList.remove('repeat-block-item');
            item.classList.add('sequence-item');
            
            // Assign unique ID if not present
            if (!item.id) {
                item.setAttribute('id', generateItemId());
            }
            
            // Add delete button if not present (for items from toolbox)
            addDeleteButton(item);
            
            // Setup hotkey add button handler for newly added items
            if (item.dataset.action === 'hotkey') {
                setupHotkeyAddButton(item);
            }
            
            // Setup coords toggle for mouse click
            if (item.dataset.action === 'click') {
                setupCoordsToggle(item);
            }
            
            // Setup pick coords button for mouse actions
            if (item.dataset.action === 'click' || item.dataset.action === 'move_mouse') {
                setupPickCoordsButton(item);
            }
            
            // Setup padding toggle for type_range
            if (item.dataset.action === 'type_range') {
                setupPaddingToggle(item);
            }
            
            // Initialize repeat block sortable if needed
            if (item.dataset.action === 'repeat') {
                initRepeatBlockSortable(item);
            }
            
            updateEmptyState();
            saveState();
            markModified();
        },
        onRemove: function(evt) {
            // Item was moved out of main sequence (to a repeat block)
            updateEmptyState();
            saveState();
            markModified();
        },
        onSort: function() {
            saveState();
            markModified();
        }
    });
}

// ============================================================================
// Mouse Click Coordinates Toggle Handler
// ============================================================================

function setupCoordsToggle(item) {
    const toggle = item.querySelector('.coords-toggle');
    const coordsFields = item.querySelector('.coords-fields');
    if (!toggle || !coordsFields) return;
    
    toggle.onchange = function() {
        coordsFields.style.display = this.checked ? 'flex' : 'none';
        markModified();
    };
}

// ============================================================================
// Type Number Range Padding Toggle Handler
// ============================================================================

function setupPaddingToggle(item) {
    const toggle = item.querySelector('.padding-toggle');
    const minDigitsInput = item.querySelector('[data-field="min_digits"]');
    if (!toggle || !minDigitsInput) return;
    
    toggle.onchange = function() {
        minDigitsInput.disabled = !this.checked;
        markModified();
    };
}

// ============================================================================
// Pick Coordinates Feature
// ============================================================================

async function pickCoordinates(item) {
    // Show countdown toast
    showToast('Move mouse to target position in 3 seconds...', 'warning');
    
    // Wait 3 seconds for user to position mouse
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Fetch current mouse position from backend
    try {
        const response = await fetch('/mouse-position');
        const data = await response.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        // Populate the X and Y fields in the item
        const xField = item.querySelector('[data-field="x"]');
        const yField = item.querySelector('[data-field="y"]');
        
        if (xField) xField.value = data.x;
        if (yField) yField.value = data.y;
        
        // For mouse click, also check the "use coordinates" checkbox
        const useCoords = item.querySelector('[data-field="use_coords"]');
        const coordsFields = item.querySelector('.coords-fields');
        if (useCoords && coordsFields) {
            useCoords.checked = true;
            coordsFields.style.display = 'flex';
        }
        
        saveState();
        markModified();
        showToast(`Captured position: (${data.x}, ${data.y})`, 'success');
    } catch (error) {
        showToast('Failed to get mouse position', 'error');
        console.error(error);
    }
}

function setupPickCoordsButton(item) {
    const pickBtns = item.querySelectorAll('.pick-coords-btn');
    if (!pickBtns.length) return;
    
    pickBtns.forEach(pickBtn => {
        pickBtn.onclick = function(e) {
            e.stopPropagation();
            pickCoordinates(item);
        };
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

/**
 * Extract data from a single sequence item (recursive for repeat blocks)
 */
function getStepData(item) {
    const action = item.dataset.action;
    const step = { action };
    
    if (action === 'type') {
        step.value = item.querySelector('[data-field="value"]').value;
        step.interval = parseFloat(item.querySelector('[data-field="interval"]').value) || 0;
    } else if (action === 'type_range') {
        step.start = parseInt(item.querySelector('[data-field="start"]').value) || 0;
        step.end = parseInt(item.querySelector('[data-field="end"]').value) || 0;
        step.interval = parseFloat(item.querySelector('[data-field="interval"]').value) || 0;
        const usePadding = item.querySelector('[data-field="use_padding"]');
        if (usePadding && usePadding.checked) {
            step.use_padding = true;
            step.min_digits = parseInt(item.querySelector('[data-field="min_digits"]').value) || 2;
        }
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
    } else if (action === 'click') {
        step.button = item.querySelector('[data-field="button"]').value || 'left';
        step.clicks = parseInt(item.querySelector('[data-field="clicks"]').value) || 1;
        const useCoords = item.querySelector('[data-field="use_coords"]');
        if (useCoords && useCoords.checked) {
            step.x = parseInt(item.querySelector('[data-field="x"]').value) || 0;
            step.y = parseInt(item.querySelector('[data-field="y"]').value) || 0;
        }
    } else if (action === 'move_mouse') {
        step.x = parseInt(item.querySelector('[data-field="x"]').value) || 0;
        step.y = parseInt(item.querySelector('[data-field="y"]').value) || 0;
        step.duration = parseFloat(item.querySelector('[data-field="duration"]').value) || 0;
    } else if (action === 'repeat') {
        step.times = parseInt(item.querySelector('[data-field="times"]').value) || 1;
        step.delay = parseFloat(item.querySelector('[data-field="delay"]').value) || 0;
        step.children = [];
        
        // Get children from the nested dropzone
        const dropzone = item.querySelector('.repeat-dropzone');
        if (dropzone) {
            const childItems = dropzone.querySelectorAll(':scope > .sequence-item');
            childItems.forEach(child => {
                step.children.push(getStepData(child));
            });
        }
    }
    
    return step;
}

function getSequenceData() {
    // Only get direct children of the main sequence (not nested items)
    const items = elements.sequence.querySelectorAll(':scope > .sequence-item');
    const sequence = [];
    
    items.forEach(item => {
        sequence.push(getStepData(item));
    });
    
    return sequence;
}

function getStartupSequenceData() {
    // Get direct children of the startup sequence
    const items = elements.startupSequence.querySelectorAll(':scope > .sequence-item');
    const sequence = [];
    
    items.forEach(item => {
        sequence.push(getStepData(item));
    });
    
    return sequence;
}

function getFullPayload() {
    return {
        target_window: elements.targetModeAuto.checked ? elements.windowSelect.value : null,
        target_mode: elements.targetModeAuto.checked ? 'auto' : 'manual',
        start_delay: parseInt(elements.startDelay.value) || 3,
        loop_count: parseInt(elements.loopCount.value) || 1,
        default_delay: parseFloat(elements.defaultDelay.value) || 0.1,
        startup_sequence: getStartupSequenceData(),
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

function clearStartupSequence() {
    const items = elements.startupSequence.querySelectorAll('.sequence-item');
    items.forEach(item => item.remove());
    updateStartupEmptyState();
}

function clearAllSequences() {
    clearSequence();
    clearStartupSequence();
}

function createSequenceItem(step) {
    // Find the matching toolbox item
    const toolboxItem = elements.toolbox.querySelector(`[data-action="${step.action}"]`);
    if (!toolboxItem) return null;
    
    // Clone it
    const item = toolboxItem.cloneNode(true);
    item.classList.remove('toolbox-item');
    item.classList.remove('repeat-block-item');
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
        // Restore min digits padding settings
        if (step.use_padding) {
            const usePadding = item.querySelector('[data-field="use_padding"]');
            const minDigits = item.querySelector('[data-field="min_digits"]');
            if (usePadding) {
                usePadding.checked = true;
            }
            if (minDigits) {
                minDigits.disabled = false;
                minDigits.value = step.min_digits || 2;
            }
        }
        setupPaddingToggle(item);
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
    } else if (step.action === 'click') {
        item.querySelector('[data-field="button"]').value = step.button || 'left';
        item.querySelector('[data-field="clicks"]').value = step.clicks || 1;
        const useCoords = item.querySelector('[data-field="use_coords"]');
        const coordsFields = item.querySelector('.coords-fields');
        if (step.x !== undefined && step.y !== undefined) {
            useCoords.checked = true;
            coordsFields.style.display = 'flex';
            item.querySelector('[data-field="x"]').value = step.x;
            item.querySelector('[data-field="y"]').value = step.y;
        }
        // Setup coords toggle handler
        setupCoordsToggle(item);
        // Setup pick coords button
        setupPickCoordsButton(item);
    } else if (step.action === 'move_mouse') {
        item.querySelector('[data-field="x"]').value = step.x || 0;
        item.querySelector('[data-field="y"]').value = step.y || 0;
        item.querySelector('[data-field="duration"]').value = step.duration || 0;
        // Setup pick coords button
        setupPickCoordsButton(item);
    } else if (step.action === 'repeat') {
        // Set repeat block values
        item.querySelector('[data-field="times"]').value = step.times || 1;
        item.querySelector('[data-field="delay"]').value = step.delay || 0;
        
        // Get the dropzone and add children
        const dropzone = item.querySelector('.repeat-dropzone');
        const emptyMsg = dropzone.querySelector('.repeat-empty');
        
        if (step.children && step.children.length > 0) {
            // Hide empty message
            if (emptyMsg) emptyMsg.style.display = 'none';
            
            // Create and add child items
            step.children.forEach(childStep => {
                const childItem = createSequenceItem(childStep);
                if (childItem) {
                    dropzone.appendChild(childItem);
                }
            });
        }
        
        // Initialize the nested sortable
        initRepeatBlockSortable(item);
    }
    
    // Add delete button
    addDeleteButton(item);
    
    return item;
}

function loadSequenceFromData(data) {
    clearAllSequences();
    
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
    if (data.default_delay !== undefined) elements.defaultDelay.value = data.default_delay;
    
    // Load startup sequence items
    const startupSequence = data.startup_sequence || [];
    startupSequence.forEach(step => {
        const item = createSequenceItem(step);
        if (item) {
            elements.startupSequence.appendChild(item);
        }
    });
    
    // Load main sequence items
    const sequence = data.sequence || [];
    sequence.forEach(step => {
        const item = createSequenceItem(step);
        if (item) {
            elements.sequence.appendChild(item);
        }
    });
    
    updateEmptyState();
    updateStartupEmptyState();
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
    const startupSequence = getStartupSequenceData();
    
    if (sequence.length === 0 && startupSequence.length === 0) {
        showToast('Both sequences are empty', 'warning');
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
    
    elements.confirmStartupSteps.textContent = startupSequence.length > 0 ? startupSequence.length : 'None';
    elements.confirmSteps.textContent = sequence.length;
    elements.confirmLoops.textContent = elements.loopCount.value;
    elements.confirmDelay.textContent = elements.startDelay.value;
    
    showModal(elements.confirmModal);
}

function showCountdown(seconds) {
    return new Promise((resolve) => {
        elements.countdownDisplay.style.display = 'block';
        elements.executionProgress.style.display = 'none';
        elements.executionOverlay.classList.add('active');
        
        let remaining = seconds;
        elements.countdownNumber.textContent = remaining;
        
        if (remaining <= 0) {
            resolve();
            return;
        }
        
        const interval = setInterval(() => {
            remaining--;
            elements.countdownNumber.textContent = remaining;
            
            if (remaining <= 0) {
                clearInterval(interval);
                resolve();
            }
        }, 1000);
    });
}

function showExecutionProgress(totalLoops, totalSteps) {
    elements.countdownDisplay.style.display = 'none';
    elements.executionProgress.style.display = 'block';
    elements.totalLoops.textContent = totalLoops;
    elements.totalSteps.textContent = totalSteps;
    elements.currentLoop.textContent = '1';
    elements.currentStep.textContent = '0';
    elements.progressBar.style.width = '0%';
}

function updateExecutionProgress(currentLoop, currentStep, totalLoops, totalSteps) {
    elements.currentLoop.textContent = currentLoop;
    elements.currentStep.textContent = currentStep;
    const progress = (currentStep / totalSteps) * 100;
    elements.progressBar.style.width = `${progress}%`;
}

function hideExecutionOverlay() {
    elements.executionOverlay.classList.remove('active');
}

async function runSequence() {
    hideModal(elements.confirmModal);
    
    const payload = getFullPayload();
    
    // Validate
    if (payload.target_mode === 'auto' && !payload.target_window) {
        showToast('Please select a target window or use manual mode', 'warning');
        return;
    }
    
    const startDelay = payload.start_delay || 0;
    const loopCount = payload.loop_count || 1;
    const sequence = payload.sequence || [];
    
    // Count total steps (simple count, backend does full calculation)
    let simpleStepCount = 0;
    function countSteps(seq) {
        for (const step of seq) {
            if (step.action === 'repeat') {
                const times = step.times || 1;
                const children = step.children || [];
                for (let i = 0; i < times; i++) {
                    countSteps(children);
                }
            } else {
                simpleStepCount++;
            }
        }
    }
    countSteps(sequence);
    const totalSteps = simpleStepCount * loopCount;
    
    // Show countdown
    await showCountdown(startDelay);
    
    // Show execution progress
    showExecutionProgress(loopCount, totalSteps);
    
    // Start SSE connection for progress updates
    let eventSource = null;
    try {
        eventSource = new EventSource('/progress');
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'progress') {
                updateExecutionProgress(
                    data.current_loop,
                    data.current_step,
                    data.total_loops,
                    data.total_steps
                );
            } else if (data.type === 'complete' || data.type === 'stopped') {
                eventSource.close();
            }
        };
        eventSource.onerror = () => {
            eventSource.close();
        };
    } catch (e) {
        console.log('SSE not supported, progress updates disabled');
    }
    
    try {
        const response = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        hideExecutionOverlay();
        
        if (eventSource) {
            eventSource.close();
        }
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        showToast(data.message, 'success');
    } catch (error) {
        hideExecutionOverlay();
        if (eventSource) {
            eventSource.close();
        }
        showToast('Failed to run sequence', 'error');
        console.error(error);
    }
}

// ============================================================================
// Version and Update Functions
// ============================================================================

let currentAppVersion = '1.0.0';

async function loadVersionInfo() {
    try {
        const response = await fetch('/api/version');
        const data = await response.json();
        
        if (data.version) {
            currentAppVersion = data.version;
            if (elements.versionDisplay) {
                elements.versionDisplay.textContent = `v${data.version}`;
            }
        }
    } catch (error) {
        console.log('Could not load version info:', error);
    }
}

async function checkForUpdates(showUpToDateMessage = true) {
    if (elements.checkUpdateBtn) {
        elements.checkUpdateBtn.disabled = true;
        elements.checkUpdateBtn.textContent = 'Checking...';
    }
    
    try {
        const response = await fetch('/api/check-update');
        const data = await response.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        if (data.update_available) {
            // Show update modal
            showUpdateModal(data);
        } else if (showUpToDateMessage) {
            showToast(`You're running the latest version (v${data.current_version})`, 'success');
        }
        
    } catch (error) {
        showToast('Failed to check for updates', 'error');
        console.error('Update check error:', error);
    } finally {
        if (elements.checkUpdateBtn) {
            elements.checkUpdateBtn.disabled = false;
            elements.checkUpdateBtn.innerHTML = '&#x21bb; Updates';
        }
    }
}

function showUpdateModal(updateData) {
    if (elements.updateCurrentVersion) {
        elements.updateCurrentVersion.textContent = `v${updateData.current_version}`;
    }
    if (elements.updateNewVersion) {
        elements.updateNewVersion.textContent = `v${updateData.latest_version}`;
    }
    if (elements.updateReleaseName && updateData.release_name) {
        elements.updateReleaseName.textContent = updateData.release_name;
        elements.updateReleaseName.style.display = 'block';
    } else if (elements.updateReleaseName) {
        elements.updateReleaseName.style.display = 'none';
    }
    if (elements.updateReleaseNotes) {
        if (updateData.release_notes) {
            // Convert markdown-style notes to simple HTML
            const notes = updateData.release_notes
                .replace(/^### (.+)$/gm, '<strong>$1</strong>')
                .replace(/^- (.+)$/gm, '&bull; $1')
                .replace(/\n/g, '<br>');
            elements.updateReleaseNotes.innerHTML = notes;
            elements.updateReleaseNotes.style.display = 'block';
        } else {
            elements.updateReleaseNotes.style.display = 'none';
        }
    }
    if (elements.updateDownloadBtn) {
        const downloadUrl = updateData.download_url || updateData.release_url;
        elements.updateDownloadBtn.href = downloadUrl;
    }
    
    showModal(elements.updateModal);
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
    
    // Undo/Redo buttons
    document.getElementById('undoBtn').onclick = undo;
    document.getElementById('redoBtn').onclick = redo;
    
    // Apply Default Delay button
    elements.applyDefaultDelayBtn.onclick = () => {
        const defaultVal = elements.defaultDelay.value;
        let count = 0;
        
        // Helper to update items in a container
        function applyToContainer(container) {
            // Type Text and Type Number Range (interval field)
            container.querySelectorAll('.sequence-item[data-action="type"] [data-field="interval"]').forEach(el => {
                el.value = defaultVal;
                count++;
            });
            container.querySelectorAll('.sequence-item[data-action="type_range"] [data-field="interval"]').forEach(el => {
                el.value = defaultVal;
                count++;
            });
            
            // Repeat Block (delay field)
            container.querySelectorAll('.sequence-item[data-action="repeat"] [data-field="delay"]').forEach(el => {
                el.value = defaultVal;
                count++;
            });
        }
        
        // Apply to both sequences
        applyToContainer(elements.startupSequence);
        applyToContainer(elements.sequence);
        
        if (count > 0) {
            saveState();
            markModified();
            showToast(`Applied ${defaultVal}s delay to ${count} item(s)`, 'success');
        } else {
            showToast('No items to update', 'warning');
        }
    };
    
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
    
    // Clear sequence modal
    elements.clearSequenceBtn.onclick = () => {
        const mainItems = elements.sequence.querySelectorAll('.sequence-item');
        const startupItems = elements.startupSequence.querySelectorAll('.sequence-item');
        if (mainItems.length === 0 && startupItems.length === 0) {
            showToast('Sequences are already empty', 'warning');
            return;
        }
        showModal(elements.clearModal);
    };
    elements.clearCancel.onclick = () => {
        hideModal(elements.clearModal);
    };
    elements.clearConfirm.onclick = () => {
        clearAllSequences();
        hideModal(elements.clearModal);
        sequenceModified = false;
        currentPatternName = null;
        showToast('All sequences cleared', 'success');
    };
    
    // Update modal
    if (elements.checkUpdateBtn) {
        elements.checkUpdateBtn.onclick = () => checkForUpdates(true);
    }
    if (elements.updateLater) {
        elements.updateLater.onclick = () => hideModal(elements.updateModal);
    }
    
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
        
        // Ctrl+Z to undo
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        
        // Ctrl+Y or Ctrl+Shift+Z to redo
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
            e.preventDefault();
            redo();
        }
    });
    
    // Mark as modified when inputs change in sequence
    elements.sequence.addEventListener('input', markModified);
    elements.sequence.addEventListener('change', markModified);
    elements.startupSequence.addEventListener('input', markModified);
    elements.startupSequence.addEventListener('change', markModified);
    
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
// Theme Management
// ============================================================================

function initTheme() {
    // Check for saved theme preference or system preference
    const savedTheme = localStorage.getItem('autokey-theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (systemDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    // Theme toggle button
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.onclick = () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('autokey-theme', newTheme);
            
            showToast(`Switched to ${newTheme} mode`, 'success');
        };
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('autokey-theme')) {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
    });
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    initTheme();
    initSequenceTabs();
    initSortable();
    initEventListeners();
    
    // Load initial data
    await loadPatternsList();
    
    // Load version info
    await loadVersionInfo();
    
    // Initial state
    updateEmptyState();
    updateStartupEmptyState();
    updateUndoRedoButtons();
    
    console.log('KeyStroker initialized');
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
