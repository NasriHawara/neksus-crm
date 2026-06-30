import { db, collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from './firebase-config.js';
import { showNotification, exportToCSV } from './utils.js';

// Load Retainers Page
window.loadRetainersPage = function() {
    const content = document.getElementById('pageContent');
    const { retainers } = window.crmState;

    if (!retainers || retainers.length === 0) {
        content.innerHTML = `
            <div class="card">
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 4v6h-6"/>
                        <path d="M1 20v-6h6"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    <h4>No retainers yet</h4>
                    <p>Set up recurring monthly income from clients on retainer.</p>
                    <button class="primary-button" style="margin-top: 16px;" onclick="openAddRetainerModal()">Add Retainer</button>
                </div>
            </div>
        `;
        return;
    }

    renderRetainersPage();
}

function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function renderRetainersPage() {
    const content = document.getElementById('pageContent');
    const { retainers, clients } = window.crmState;
    const currentMonthKey = getCurrentMonthKey();

    const activeRetainers = retainers.filter(r => r.status === 'active');
    const monthlyTotal = activeRetainers.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const generatedThisMonth = activeRetainers.filter(r => r.lastGeneratedMonth === currentMonthKey).length;

    content.innerHTML = `
        <div class="stats-grid" style="margin-bottom: 24px;">
            <div class="stat-card success">
                <div class="stat-icon success">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                </div>
                <div class="stat-details">
                    <div class="stat-label">Monthly Retainer Income</div>
                    <div class="stat-value">$${monthlyTotal.toFixed(2)}</div>
                </div>
            </div>
            <div class="stat-card info">
                <div class="stat-icon info">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                </div>
                <div class="stat-details">
                    <div class="stat-label">Active Retainers</div>
                    <div class="stat-value">${activeRetainers.length}</div>
                </div>
            </div>
            <div class="stat-card warning">
                <div class="stat-icon warning">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                </div>
                <div class="stat-details">
                    <div class="stat-label">Generated This Month</div>
                    <div class="stat-value">${generatedThisMonth} / ${activeRetainers.length}</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>All Retainers (${retainers.length})</h3>
                <div style="display: flex; gap: 12px;">
                    <button class="button secondary" onclick="exportRetainers()">Export CSV</button>
                    <button class="primary-button" onclick="openAddRetainerModal()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Add Retainer
                    </button>
                </div>
            </div>

            ${retainers.length === 0 ? `
                <div class="empty-state"><p>No retainers yet.</p></div>
            ` : `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Client</th>
                                <th>Amount</th>
                                <th>Billing Day</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>This Month</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${retainers.map(retainer => {
                                const client = clients.find(c => c.id === retainer.clientId);
                                const generatedThisRetainer = retainer.lastGeneratedMonth === currentMonthKey;
                                return `
                                <tr>
                                    <td><strong>${client ? client.name : 'Unknown Client'}</strong></td>
                                    <td style="color: var(--success); font-weight: 600;">$${parseFloat(retainer.amount || 0).toFixed(2)}</td>
                                    <td>Day ${retainer.billingDay || 1}</td>
                                    <td>${retainer.category || 'Retainer'}</td>
                                    <td><span class="badge ${retainer.status === 'active' ? 'success' : retainer.status === 'paused' ? 'warning' : 'secondary'}">${retainer.status}</span></td>
                                    <td>
                                        ${retainer.status === 'active' ? (
                                            generatedThisRetainer
                                                ? `<span class="badge success">Generated</span>`
                                                : `<button class="button secondary" style="padding: 6px 12px; font-size: 12px;" onclick="generateRetainerIncome('${retainer.id}')">Generate</button>`
                                        ) : '-'}
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="icon-button" onclick="editRetainer('${retainer.id}')" title="Edit">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                            </button>
                                            <button class="icon-button" onclick="deleteRetainer('${retainer.id}')" title="Delete">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <polyline points="3 6 5 6 21 6"/>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>
    `;
}

// Export Retainers
window.exportRetainers = function() {
    const { retainers, clients } = window.crmState;
    const data = retainers.map(r => {
        const client = clients.find(c => c.id === r.clientId);
        return {
            client: client ? client.name : 'Unknown',
            amount: r.amount || 0,
            billingDay: r.billingDay || '',
            category: r.category || '',
            status: r.status || ''
        };
    });
    exportToCSV(data, 'retainers.csv');
}

// Open Add Retainer Modal
window.openAddRetainerModal = function() {
    const { clients } = window.crmState;
    const clientOptions = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const modalHTML = `
        <div class="modal active" id="retainerModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add Retainer</h3>
                    <button class="close-button" onclick="closeModal('retainerModal')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="retainerForm" onsubmit="saveRetainer(event)">
                        <div class="form-group">
                            <label>Client *</label>
                            <select name="clientId" required>
                                <option value="">Select a client</option>
                                ${clientOptions}
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Monthly Amount *</label>
                                <input type="number" name="amount" step="0.01" min="0" required placeholder="0.00">
                            </div>
                            <div class="form-group">
                                <label>Billing Day</label>
                                <input type="number" name="billingDay" min="1" max="31" value="1" placeholder="1-31">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Category</label>
                            <input type="text" name="category" placeholder="e.g. Retainer, Maintenance" value="Retainer">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select name="status">
                                <option value="active" selected>Active</option>
                                <option value="paused">Paused</option>
                                <option value="ended">Ended</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="button secondary" onclick="closeModal('retainerModal')">Cancel</button>
                            <button type="submit" class="button primary">Add Retainer</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('retainerModal').classList.add('active');
}

// Save Retainer
window.saveRetainer = async function(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const retainerData = {
        clientId: formData.get('clientId'),
        amount: parseFloat(formData.get('amount')) || 0,
        billingDay: parseInt(formData.get('billingDay')) || 1,
        category: formData.get('category') || 'Retainer',
        status: formData.get('status') || 'active',
        startDate: new Date().toISOString().split('T')[0],
        lastGeneratedMonth: null,
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, 'retainers'), retainerData);
        window.closeModal('retainerModal');
        document.getElementById('retainerModal').remove();
        showNotification('Retainer added successfully!', 'success');
    } catch (error) {
        console.error('Error adding retainer:', error);
        showNotification('Error adding retainer. Please try again.', 'error');
    }
}

// Edit Retainer
window.editRetainer = function(retainerId) {
    const retainer = (window.crmState.retainers || []).find(r => r.id === retainerId);
    if (!retainer) return;
    const { clients } = window.crmState;
    const clientOptions = clients.map(c => `<option value="${c.id}" ${c.id === retainer.clientId ? 'selected' : ''}>${c.name}</option>`).join('');

    const modalHTML = `
        <div class="modal active" id="retainerModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Retainer</h3>
                    <button class="close-button" onclick="closeModal('retainerModal')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="retainerForm" onsubmit="updateRetainer(event, '${retainerId}')">
                        <div class="form-group">
                            <label>Client *</label>
                            <select name="clientId" required>
                                ${clientOptions}
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Monthly Amount *</label>
                                <input type="number" name="amount" step="0.01" min="0" required value="${retainer.amount || 0}">
                            </div>
                            <div class="form-group">
                                <label>Billing Day</label>
                                <input type="number" name="billingDay" min="1" max="31" value="${retainer.billingDay || 1}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Category</label>
                            <input type="text" name="category" value="${retainer.category || 'Retainer'}">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select name="status">
                                <option value="active" ${retainer.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="paused" ${retainer.status === 'paused' ? 'selected' : ''}>Paused</option>
                                <option value="ended" ${retainer.status === 'ended' ? 'selected' : ''}>Ended</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="button secondary" onclick="closeModal('retainerModal')">Cancel</button>
                            <button type="submit" class="button primary">Update Retainer</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('retainerModal').classList.add('active');
}

// Update Retainer
window.updateRetainer = async function(event, retainerId) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const retainerData = {
        clientId: formData.get('clientId'),
        amount: parseFloat(formData.get('amount')) || 0,
        billingDay: parseInt(formData.get('billingDay')) || 1,
        category: formData.get('category') || 'Retainer',
        status: formData.get('status') || 'active',
        updatedAt: serverTimestamp()
    };

    try {
        await updateDoc(doc(db, 'retainers', retainerId), retainerData);
        window.closeModal('retainerModal');
        document.getElementById('retainerModal').remove();
        showNotification('Retainer updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating retainer:', error);
        showNotification('Error updating retainer. Please try again.', 'error');
    }
}

// Delete Retainer
window.deleteRetainer = async function(retainerId) {
    if (!confirm('Are you sure you want to delete this retainer? This will not delete past income records it already generated.')) return;

    try {
        await deleteDoc(doc(db, 'retainers', retainerId));
        showNotification('Retainer deleted.', 'success');
    } catch (error) {
        console.error('Error deleting retainer:', error);
        showNotification('Error deleting retainer. Please try again.', 'error');
    }
}

// Generate this month's income for a retainer
window.generateRetainerIncome = async function(retainerId) {
    const retainer = (window.crmState.retainers || []).find(r => r.id === retainerId);
    if (!retainer) return;

    const currentMonthKey = getCurrentMonthKey();
    if (retainer.lastGeneratedMonth === currentMonthKey) {
        showNotification('This retainer has already been generated for this month.', 'warning');
        return;
    }

    const financeData = {
        type: 'income',
        category: retainer.category || 'Retainer',
        description: `Retainer payment - ${currentMonthKey}`,
        amount: retainer.amount,
        date: new Date().toISOString().split('T')[0],
        status: 'paid',
        clientId: retainer.clientId,
        projectId: null,
        contractorId: null,
        retainerId: retainer.id,
        notes: 'Auto-generated from retainer',
        takeCapital: false,
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, 'finances'), financeData);
        await updateDoc(doc(db, 'retainers', retainerId), { lastGeneratedMonth: currentMonthKey });
        showNotification(`Generated $${parseFloat(retainer.amount).toFixed(2)} retainer income for this month!`, 'success');
    } catch (error) {
        console.error('Error generating retainer income:', error);
        showNotification('Error generating retainer income. Please try again.', 'error');
    }
}