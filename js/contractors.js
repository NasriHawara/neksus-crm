import { db, collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from './firebase-config.js';
import { showNotification, exportToCSV, debounce } from './utils.js';

// Contractor state
let contractorFilters = {
    search: '',
    status: 'all'
};

// Load Contractors Page
window.loadContractorsPage = function() {
    const content = document.getElementById('pageContent');
    const { contractors } = window.crmState;

    if (!contractors || contractors.length === 0) {
        content.innerHTML = `
            <div class="card">
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <h4>No contractors yet</h4>
                    <p>Add the people you pay for project work to track who's getting paid what.</p>
                    <button class="primary-button" style="margin-top: 16px;" onclick="openAddContractorModal()">Add Contractor</button>
                </div>
            </div>
        `;
        return;
    }

    renderContractorsPage();
}

function getFilteredContractors() {
    const { contractors } = window.crmState;
    let filtered = [...contractors];

    if (contractorFilters.search) {
        const searchLower = contractorFilters.search.toLowerCase();
        filtered = filtered.filter(c =>
            (c.name && c.name.toLowerCase().includes(searchLower)) ||
            (c.role && c.role.toLowerCase().includes(searchLower))
        );
    }

    if (contractorFilters.status !== 'all') {
        filtered = filtered.filter(c => c.status === contractorFilters.status);
    }

    return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

function renderContractorsPage() {
    const content = document.getElementById('pageContent');
    const filtered = getFilteredContractors();
    const finances = window.crmState.finances || [];

    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3>All Contractors (${filtered.length})</h3>
                <div style="display: flex; gap: 12px;">
                    <button class="button secondary" onclick="exportContractors()">Export CSV</button>
                    <button class="primary-button" onclick="openAddContractorModal()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Add Contractor
                    </button>
                </div>
            </div>

            <div style="padding: 24px; border-bottom: 1px solid var(--border-color);">
                <div class="modern-search-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input type="text" id="contractorSearch" placeholder="Search by name or role..." value="${contractorFilters.search}" onkeyup="handleContractorSearch(event)">
                </div>
            </div>

            ${filtered.length === 0 ? `
                <div class="empty-state">
                    <p>No contractors match your search.</p>
                </div>
            ` : `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Rate</th>
                                <th>Status</th>
                                <th>Total Paid</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(contractor => {
                                const totalPaid = finances
                                    .filter(f => f.type === 'expense' && f.contractorId === contractor.id)
                                    .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
                                return `
                                <tr>
                                    <td><strong>${contractor.name}</strong></td>
                                    <td>${contractor.role || '-'}</td>
                                    <td>${contractor.rate ? `$${parseFloat(contractor.rate).toFixed(2)}${contractor.rateType === 'hourly' ? '/hr' : contractor.rateType === 'monthly' ? '/mo' : ''}` : '-'}</td>
                                    <td><span class="badge ${contractor.status === 'inactive' ? 'secondary' : 'success'}">${contractor.status === 'inactive' ? 'Inactive' : 'Active'}</span></td>
                                    <td style="color: var(--danger); font-weight: 600;">$${totalPaid.toFixed(2)}</td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="icon-button" onclick="editContractor('${contractor.id}')" title="Edit">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                            </button>
                                            <button class="icon-button" onclick="deleteContractor('${contractor.id}')" title="Delete">
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

window.handleContractorSearch = debounce(function(event) {
    contractorFilters.search = event.target.value;
    renderContractorsPage();
}, 300);

// Export Contractors
window.exportContractors = function() {
    const contractors = (window.crmState.contractors || []).map(c => ({
        name: c.name,
        role: c.role || '',
        rate: c.rate || '',
        rateType: c.rateType || '',
        status: c.status || 'active',
        notes: c.notes || ''
    }));
    exportToCSV(contractors, 'contractors.csv');
}

// Open Add Contractor Modal
window.openAddContractorModal = function() {
    const modalHTML = `
        <div class="modal active" id="contractorModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add Contractor</h3>
                    <button class="close-button" onclick="closeModal('contractorModal')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="contractorForm" onsubmit="saveContractor(event)">
                        <div class="form-group">
                            <label>Name *</label>
                            <input type="text" name="name" required placeholder="Contractor's name">
                        </div>
                        <div class="form-group">
                            <label>Role</label>
                            <input type="text" name="role" placeholder="e.g. Developer, Designer, Copywriter">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Rate</label>
                                <input type="number" name="rate" step="0.01" min="0" placeholder="0.00">
                            </div>
                            <div class="form-group">
                                <label>Rate Type</label>
                                <select name="rateType">
                                    <option value="hourly">Hourly</option>
                                    <option value="fixed">Fixed (per project)</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select name="status">
                                <option value="active" selected>Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea name="notes" rows="3" placeholder="Additional notes (optional)"></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="button secondary" onclick="closeModal('contractorModal')">Cancel</button>
                            <button type="submit" class="button primary">Add Contractor</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('contractorModal').classList.add('active');
}

// Save Contractor
window.saveContractor = async function(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const contractorData = {
        name: formData.get('name'),
        role: formData.get('role') || '',
        rate: formData.get('rate') ? parseFloat(formData.get('rate')) : null,
        rateType: formData.get('rateType') || 'hourly',
        status: formData.get('status') || 'active',
        notes: formData.get('notes') || '',
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, 'contractors'), contractorData);
        window.closeModal('contractorModal');
        document.getElementById('contractorModal').remove();
        showNotification('Contractor added successfully!', 'success');
    } catch (error) {
        console.error('Error adding contractor:', error);
        showNotification('Error adding contractor. Please try again.', 'error');
    }
}

// Edit Contractor
window.editContractor = function(contractorId) {
    const contractor = (window.crmState.contractors || []).find(c => c.id === contractorId);
    if (!contractor) return;

    const modalHTML = `
        <div class="modal active" id="contractorModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Contractor</h3>
                    <button class="close-button" onclick="closeModal('contractorModal')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="contractorForm" onsubmit="updateContractor(event, '${contractorId}')">
                        <div class="form-group">
                            <label>Name *</label>
                            <input type="text" name="name" required value="${contractor.name}">
                        </div>
                        <div class="form-group">
                            <label>Role</label>
                            <input type="text" name="role" value="${contractor.role || ''}">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Rate</label>
                                <input type="number" name="rate" step="0.01" min="0" value="${contractor.rate || ''}">
                            </div>
                            <div class="form-group">
                                <label>Rate Type</label>
                                <select name="rateType">
                                    <option value="hourly" ${contractor.rateType === 'hourly' ? 'selected' : ''}>Hourly</option>
                                    <option value="fixed" ${contractor.rateType === 'fixed' ? 'selected' : ''}>Fixed (per project)</option>
                                    <option value="monthly" ${contractor.rateType === 'monthly' ? 'selected' : ''}>Monthly</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select name="status">
                                <option value="active" ${contractor.status !== 'inactive' ? 'selected' : ''}>Active</option>
                                <option value="inactive" ${contractor.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea name="notes" rows="3">${contractor.notes || ''}</textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="button secondary" onclick="closeModal('contractorModal')">Cancel</button>
                            <button type="submit" class="button primary">Update Contractor</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('contractorModal').classList.add('active');
}

// Update Contractor
window.updateContractor = async function(event, contractorId) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const contractorData = {
        name: formData.get('name'),
        role: formData.get('role') || '',
        rate: formData.get('rate') ? parseFloat(formData.get('rate')) : null,
        rateType: formData.get('rateType') || 'hourly',
        status: formData.get('status') || 'active',
        notes: formData.get('notes') || '',
        updatedAt: serverTimestamp()
    };

    try {
        await updateDoc(doc(db, 'contractors', contractorId), contractorData);
        window.closeModal('contractorModal');
        document.getElementById('contractorModal').remove();
        showNotification('Contractor updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating contractor:', error);
        showNotification('Error updating contractor. Please try again.', 'error');
    }
}

// Delete Contractor
window.deleteContractor = async function(contractorId) {
    if (!confirm('Are you sure you want to delete this contractor? This will not delete past expense records linked to them.')) return;

    try {
        await deleteDoc(doc(db, 'contractors', contractorId));
        showNotification('Contractor deleted.', 'success');
    } catch (error) {
        console.error('Error deleting contractor:', error);
        showNotification('Error deleting contractor. Please try again.', 'error');
    }
}