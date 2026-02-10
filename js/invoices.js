import { db, collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from './firebase-config.js';
import { showNotification, formatCurrency, formatDate } from './utils.js';

// Invoice state
let invoiceLineItems = [];

// Load Invoices Page
window.loadInvoicesPage = function() {
    const content = document.getElementById('pageContent');
    const { invoices } = window.crmState;

    let invoicesHTML = '';
    if (invoices.length === 0) {
        invoicesHTML = `
            <div class="card">
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <h4>No invoices yet</h4>
                    <p>Create your first invoice to get started.</p>
                    <button class="primary-button" style="margin-top: 16px;" onclick="openAddInvoiceModal()">Create Invoice</button>
                </div>
            </div>
        `;
    } else {
        invoicesHTML = `
            <div class="card">
                <div class="card-header">
                    <h3>All Invoices (${invoices.length})</h3>
                    <button class="primary-button" onclick="openAddInvoiceModal()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Create Invoice
                    </button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Project</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoices.map(invoice => `
                                <tr>
                                    <td><strong>${invoice.invoiceNumber || '#INV-001'}</strong></td>
                                    <td>${invoice.project || invoice.client || '-'}</td>
                                    <td><strong>$${(parseFloat(invoice.total) || parseFloat(invoice.amount) || 0).toFixed(2)}</strong></td>
                                    <td>${invoice.date || '-'}</td>
                                    <td><span class="badge ${invoice.status === 'paid' ? 'success' : invoice.status === 'unpaid' ? 'danger' : 'warning'}">${invoice.status || 'Pending'}</span></td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="btn-icon" onclick="viewInvoiceDetail('${invoice.id}')" title="View Details">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                    <circle cx="12" cy="12" r="3"/>
                                                </svg>
                                            </button>
                                            <button class="btn-icon" onclick="editInvoice('${invoice.id}')" title="Edit">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                            </button>
                                            <button class="btn-icon" onclick="deleteInvoice('${invoice.id}')" title="Delete">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <polyline points="3 6 5 6 21 6"/>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    content.innerHTML = invoicesHTML;
}

// Open Add Invoice Modal
window.openAddInvoiceModal = function() {
    if (typeof window.closeModal === 'function') {
        window.closeModal('quickAddModal');
    }

    const projects = window.crmState.projects;
    const projectOptions = projects.map(p => `<option value="${p.id}" data-project-name="${p.name}">${p.name}</option>`).join('');

    // Generate invoice number
    const invoiceNumber = `INV-${String(window.crmState.invoices.length + 1).padStart(4, '0')}`;

    // Reset line items
    invoiceLineItems = [{ description: '', quantity: 1, price: 0 }];

    const modalHTML = `
        <div class="modal active" id="invoiceModal">
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Create Invoice</h3>
                    <button class="close-button" onclick="closeModal('invoiceModal')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="invoiceForm" onsubmit="saveInvoice(event)">
                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Invoice Number *</label>
                                <input type="text" name="invoiceNumber" required value="${invoiceNumber}" readonly>
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select name="status">
                                    <option value="draft">Draft</option>
                                    <option value="sent" selected>Sent</option>
                                    <option value="paid">Paid</option>
                                    <option value="unpaid">Unpaid</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Project *</label>
                            <select name="projectId" id="projectSelect" required>
                                <option value="">Select a project</option>
                                ${projectOptions}
                            </select>
                        </div>

                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Invoice Date *</label>
                                <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="form-group">
                                <label>Due Date</label>
                                <input type="date" name="dueDate">
                            </div>
                        </div>

                        <!-- Line Items Section -->
                        <div class="form-group">
                            <label style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Line Items *</span>
                                <button type="button" class="button secondary" onclick="addInvoiceLineItem()" style="padding: 6px 12px; font-size: 14px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                                        <line x1="12" y1="5" x2="12" y2="19"/>
                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                    Add Item
                                </button>
                            </label>
                            <div id="lineItemsContainer" style="margin-top: 12px;">
                                <!-- Line items will be rendered here -->
                            </div>
                        </div>

                        <!-- Total Display -->
                        <div style="text-align: right; padding: 16px; background: var(--bg-secondary, #f3f4f6); border-radius: 8px; margin-top: 16px;">
                            <div style="font-size: 18px; font-weight: 600;">
                                Total: <span id="invoiceTotalDisplay">$0.00</span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Notes</label>
                            <textarea name="notes" rows="3" placeholder="Additional notes or payment terms"></textarea>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="button secondary" onclick="closeModal('invoiceModal')">Cancel</button>
                            <button type="submit" class="button primary">Create Invoice</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    renderInvoiceLineItems();
    calculateInvoiceTotal();
}

// Render Line Items
function renderInvoiceLineItems() {
    const container = document.getElementById('lineItemsContainer');
    if (!container) return;

    container.innerHTML = invoiceLineItems.map((item, index) => `
        <div class="line-item" style="display: grid; grid-template-columns: 2fr 0.7fr 1fr 0.8fr 40px; gap: 8px; margin-bottom: 8px; align-items: center;">
            <input type="text" placeholder="Description" value="${item.description}" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                   onchange="updateInvoiceLineItem(${index}, 'description', this.value)">
            <input type="number" placeholder="Qty" value="${item.quantity}" min="1" step="1" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                   onchange="updateInvoiceLineItem(${index}, 'quantity', parseFloat(this.value) || 1)">
            <input type="number" placeholder="Price" value="${item.price}" min="0" step="0.01" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                   onchange="updateInvoiceLineItem(${index}, 'price', parseFloat(this.value) || 0)">
            <div style="padding: 8px; font-weight: 600;">
                $${((item.quantity || 0) * (item.price || 0)).toFixed(2)}
            </div>
            <button type="button" class="btn-icon" onclick="removeInvoiceLineItem(${index})"
                    ${invoiceLineItems.length === 1 ? 'disabled' : ''} title="Remove" style="padding: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        </div>
    `).join('');
}

// Add Line Item
window.addInvoiceLineItem = function() {
    invoiceLineItems.push({ description: '', quantity: 1, price: 0 });
    renderInvoiceLineItems();
    calculateInvoiceTotal();
}

// Update Line Item
window.updateInvoiceLineItem = function(index, field, value) {
    invoiceLineItems[index][field] = value;
    renderInvoiceLineItems();
    calculateInvoiceTotal();
}

// Remove Line Item
window.removeInvoiceLineItem = function(index) {
    if (invoiceLineItems.length > 1) {
        invoiceLineItems.splice(index, 1);
        renderInvoiceLineItems();
        calculateInvoiceTotal();
    }
}

// Calculate Invoice Total
function calculateInvoiceTotal() {
    const total = invoiceLineItems.reduce((sum, item) =>
        sum + ((item.quantity || 0) * (item.price || 0)), 0);

    const displayElement = document.getElementById('invoiceTotalDisplay');
    if (displayElement) {
        displayElement.textContent = `$${total.toFixed(2)}`;
    }
}

// Save Invoice
window.saveInvoice = async function(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    // Validate line items
    if (invoiceLineItems.length === 0 || !invoiceLineItems.some(item => item.description)) {
        showNotification('Please add at least one line item with a description', 'warning');
        return;
    }

    const total = invoiceLineItems.reduce((sum, item) =>
        sum + ((item.quantity || 0) * (item.price || 0)), 0);

    // Get project name from selected option
    const projectSelect = document.getElementById('projectSelect');
    const selectedOption = projectSelect.options[projectSelect.selectedIndex];
    const projectName = selectedOption.getAttribute('data-project-name');
    const projectId = formData.get('projectId');

    // Get client name from the project
    const project = window.crmState.projects.find(p => p.id === projectId);
    const clientName = project ? project.client : '';

    const status = formData.get('status');

    const invoiceData = {
        invoiceNumber: formData.get('invoiceNumber'),
        projectId: projectId,
        project: projectName,
        client: clientName, // Store client name for backward compatibility
        date: formData.get('date'),
        dueDate: formData.get('dueDate'),
        status: status,
        lineItems: invoiceLineItems.filter(item => item.description),
        total: total,
        amount: total, // For backward compatibility
        notes: formData.get('notes'),
        createdAt: serverTimestamp()
    };

    try {
        const invoiceDocRef = await addDoc(collection(db, 'invoices'), invoiceData);
        
        // If invoice is created with "paid" status, create finance transaction
        if (status === 'paid') {
            const financeData = {
                type: 'income',
                category: 'Client Payment',
                description: `Payment for Invoice ${formData.get('invoiceNumber')} - ${projectName}`,
                amount: total,
                date: formData.get('date'),
                notes: `Automatically created from Invoice ${formData.get('invoiceNumber')}`,
                linkedInvoiceId: invoiceDocRef.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Add finance transaction
            const financeDocRef = await addDoc(collection(db, 'finances'), financeData);
            
            // Update the invoice with the linked finance ID
            await updateDoc(doc(db, 'invoices', invoiceDocRef.id), {
                linkedFinanceId: financeDocRef.id
            });
            
            showNotification('Invoice created as paid and income transaction added!', 'success');
        } else {
            showNotification('Invoice created successfully!', 'success');
        }
        
        window.closeModal('invoiceModal');
        document.getElementById('invoiceModal').remove();
        await window.loadAllData();
    } catch (error) {
        console.error('Error creating invoice:', error);
        showNotification('Error creating invoice. Please try again.', 'error');
    }
}

// Edit Invoice
window.editInvoice = function(invoiceId) {
    const invoice = window.crmState.invoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    invoiceLineItems = invoice.lineItems || [{ description: '', quantity: 1, price: 0 }];

    const projects = window.crmState.projects;
    const projectOptions = projects.map(p =>
        `<option value="${p.id}" data-project-name="${p.name}" ${(p.id === invoice.projectId || p.name === invoice.project) ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    const modalHTML = `
        <div class="modal active" id="invoiceModal">
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Edit Invoice</h3>
                    <button class="close-button" onclick="closeModal('invoiceModal')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="invoiceForm" onsubmit="updateInvoice(event, '${invoiceId}')">
                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Invoice Number *</label>
                                <input type="text" name="invoiceNumber" required value="${invoice.invoiceNumber}" readonly>
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select name="status">
                                    <option value="draft" ${invoice.status === 'draft' ? 'selected' : ''}>Draft</option>
                                    <option value="sent" ${invoice.status === 'sent' ? 'selected' : ''}>Sent</option>
                                    <option value="paid" ${invoice.status === 'paid' ? 'selected' : ''}>Paid</option>
                                    <option value="unpaid" ${invoice.status === 'unpaid' ? 'selected' : ''}>Unpaid</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Project *</label>
                            <select name="projectId" id="projectSelect" required>
                                <option value="">Select a project</option>
                                ${projectOptions}
                            </select>
                        </div>

                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Invoice Date *</label>
                                <input type="date" name="date" required value="${invoice.date}">
                            </div>
                            <div class="form-group">
                                <label>Due Date</label>
                                <input type="date" name="dueDate" value="${invoice.dueDate || ''}">
                            </div>
                        </div>

                        <div class="form-group">
                            <label style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Line Items *</span>
                                <button type="button" class="button secondary" onclick="addInvoiceLineItem()" style="padding: 6px 12px; font-size: 14px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                                        <line x1="12" y1="5" x2="12" y2="19"/>
                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                    Add Item
                                </button>
                            </label>
                            <div id="lineItemsContainer" style="margin-top: 12px;"></div>
                        </div>

                        <div style="text-align: right; padding: 16px; background: var(--bg-secondary, #f3f4f6); border-radius: 8px; margin-top: 16px;">
                            <div style="font-size: 18px; font-weight: 600;">
                                Total: <span id="invoiceTotalDisplay">$0.00</span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Notes</label>
                            <textarea name="notes" rows="3">${invoice.notes || ''}</textarea>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="button secondary" onclick="closeModal('invoiceModal')">Cancel</button>
                            <button type="submit" class="button primary">Update Invoice</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    renderInvoiceLineItems();
    calculateInvoiceTotal();
}

// Update Invoice
window.updateInvoice = async function(event, invoiceId) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    if (invoiceLineItems.length === 0 || !invoiceLineItems.some(item => item.description)) {
        showNotification('Please add at least one line item with a description', 'warning');
        return;
    }

    const total = invoiceLineItems.reduce((sum, item) =>
        sum + ((item.quantity || 0) * (item.price || 0)), 0);

    // Get project name from selected option
    const projectSelect = document.getElementById('projectSelect');
    const selectedOption = projectSelect.options[projectSelect.selectedIndex];
    const projectName = selectedOption.getAttribute('data-project-name');
    const projectId = formData.get('projectId');

    // Get client name from the project
    const project = window.crmState.projects.find(p => p.id === projectId);
    const clientName = project ? project.client : '';

    // ===== NEW CODE: Get the old invoice data to check status change =====
    const oldInvoice = window.crmState.invoices.find(i => i.id === invoiceId);
    const newStatus = formData.get('status');
    const oldStatus = oldInvoice ? oldInvoice.status : '';
    // ===== END NEW CODE =====

    const invoiceData = {
        invoiceNumber: formData.get('invoiceNumber'),
        projectId: projectId,
        project: projectName,
        client: clientName,
        date: formData.get('date'),
        dueDate: formData.get('dueDate'),
        status: newStatus, // Changed to use newStatus variable
        lineItems: invoiceLineItems.filter(item => item.description),
        total: total,
        amount: total,
        notes: formData.get('notes'),
        updatedAt: serverTimestamp()
    };

    try {
        const invoiceRef = doc(db, 'invoices', invoiceId);
        
        // ===== NEW CODE: Check if status changed to "paid" and create finance transaction =====
        if (newStatus === 'paid' && oldStatus !== 'paid' && !oldInvoice.linkedFinanceId) {
            // Create income transaction in finances
            const financeData = {
                type: 'income',
                category: 'Client Payment',
                description: `Payment for Invoice ${formData.get('invoiceNumber')} - ${projectName}`,
                amount: total,
                date: formData.get('date'),
                notes: `Automatically created from Invoice ${formData.get('invoiceNumber')}`,
                linkedInvoiceId: invoiceId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Add finance transaction
            const financeDocRef = await addDoc(collection(db, 'finances'), financeData);
            
            // Link the finance transaction to the invoice
            invoiceData.linkedFinanceId = financeDocRef.id;
            
            showNotification('Invoice marked as paid and income transaction created!', 'success');
        } else if (newStatus === 'paid' && oldInvoice.linkedFinanceId) {
            // Keep the existing link if already paid
            invoiceData.linkedFinanceId = oldInvoice.linkedFinanceId;
        }
        // ===== END NEW CODE =====

        await updateDoc(invoiceRef, invoiceData);
        window.closeModal('invoiceModal');
        document.getElementById('invoiceModal').remove();
        await window.loadAllData();
        
        // Only show generic success if we didn't already show the "marked as paid" message
        if (newStatus !== 'paid' || oldStatus === 'paid') {
            showNotification('Invoice updated successfully!', 'success');
        }
    } catch (error) {
        console.error('Error updating invoice:', error);
        showNotification('Error updating invoice. Please try again.', 'error');
    }
}




// Delete Invoice
window.deleteInvoice = async function(invoiceId) {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
        const invoiceRef = doc(db, 'invoices', invoiceId);
        await deleteDoc(invoiceRef);
        await window.loadAllData();
        showNotification('Invoice deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting invoice:', error);
        showNotification('Error deleting invoice. Please try again.', 'error');
    }
}

// View Invoice Detail
window.viewInvoiceDetail = function(invoiceId) {
    const invoice = window.crmState.invoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    // Get linked project (if invoice has project reference)
    const linkedProject = window.crmState.projects.find(p =>
        p.id === invoice.projectId || p.name === invoice.project
    );

    // Get client info - try from project first, then from invoice
    let linkedClient = null;
    if (linkedProject && linkedProject.client) {
        linkedClient = window.crmState.clients.find(c => c.name === linkedProject.client);
    } else if (invoice.client) {
        linkedClient = window.crmState.clients.find(c => c.name === invoice.client);
    }

    // Calculate totals
    const lineItems = invoice.lineItems || [];
    const subtotal = lineItems.reduce((sum, item) =>
        sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)), 0);
    const total = parseFloat(invoice.total) || parseFloat(invoice.amount) || subtotal;

    const modalHTML = `
        <div class="modal active" id="invoiceDetailModal" style="z-index: 1001;">
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <div>
                        <h3>${invoice.invoiceNumber || 'Invoice'}</h3>
                        <p style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">
                            ${invoice.project || invoice.client || 'No project assigned'}
                        </p>
                    </div>
                    <button class="close-button" onclick="closeInvoiceDetailModal()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
                    <!-- Invoice Status Banner -->
                    <div style="padding: 16px; background: ${invoice.status === 'paid' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : invoice.status === 'unpaid' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}; border-radius: 12px; margin-bottom: 24px; color: white;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">Invoice Status</div>
                                <div style="font-size: 24px; font-weight: 700; text-transform: uppercase;">${invoice.status || 'Pending'}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">Total Amount</div>
                                <div style="font-size: 32px; font-weight: 700;">$${total.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Invoice Information Grid -->
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 24px;">
                        <div style="background: var(--bg-darker, #f3f4f6); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color, #e5e7eb);">
                            <div style="font-size: 12px; color: var(--text-secondary, #6b7280); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Invoice Number</div>
                            <div style="font-size: 16px; color: var(--text-primary, #111827); font-weight: 600;">${invoice.invoiceNumber || 'N/A'}</div>
                        </div>
                        <div style="background: var(--bg-darker, #f3f4f6); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color, #e5e7eb);">
                            <div style="font-size: 12px; color: var(--text-secondary, #6b7280); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Project</div>
                            <div style="font-size: 16px; color: var(--text-primary, #111827); font-weight: 600;">${invoice.project || 'N/A'}</div>
                        </div>
                        <div style="background: var(--bg-darker, #f3f4f6); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color, #e5e7eb);">
                            <div style="font-size: 12px; color: var(--text-secondary, #6b7280); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Invoice Date</div>
                            <div style="font-size: 16px; color: var(--text-primary, #111827); font-weight: 600;">${invoice.date || 'N/A'}</div>
                        </div>
                        <div style="background: var(--bg-darker, #f3f4f6); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color, #e5e7eb);">
                            <div style="font-size: 12px; color: var(--text-secondary, #6b7280); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Due Date</div>
                            <div style="font-size: 16px; color: var(--text-primary, #111827); font-weight: 600;">${invoice.dueDate || 'N/A'}</div>
                        </div>
                    </div>

                    ${linkedProject ? `
                        <!-- Linked Project -->
                        <div style="margin-bottom: 24px;">
                            <div style="font-size: 16px; font-weight: 600; color: var(--text-primary, #111827); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                                </svg>
                                Project Details
                            </div>
                            <div style="background: var(--bg-darker, #f3f4f6); border: 1px solid var(--border-color, #e5e7eb); border-radius: 10px; padding: 16px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-size: 16px; font-weight: 600; color: var(--text-primary, #111827); margin-bottom: 4px;">${linkedProject.name}</div>
                                        <div style="font-size: 13px; color: var(--text-secondary, #6b7280);">${linkedProject.description || 'No description'}</div>
                                        ${linkedProject.client ? `<div style="font-size: 13px; color: var(--text-secondary, #6b7280); margin-top: 4px;">Client: ${linkedProject.client}</div>` : ''}
                                    </div>
                                    <span class="badge ${linkedProject.status === 'active' ? 'success' : linkedProject.status === 'completed' ? 'info' : 'warning'}">${linkedProject.status || 'Active'}</span>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    ${linkedClient ? `
                        <!-- Client Information -->
                        <div style="margin-bottom: 24px;">
                            <div style="font-size: 16px; font-weight: 600; color: var(--text-primary, #111827); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                                Client Information
                            </div>
                            <div style="background: var(--bg-darker, #f3f4f6); border: 1px solid var(--border-color, #e5e7eb); border-radius: 10px; padding: 16px;">
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                                    <div>
                                        <div style="font-size: 12px; color: var(--text-secondary, #6b7280); margin-bottom: 4px;">Name</div>
                                        <div style="font-size: 14px; color: var(--text-primary, #111827);">${linkedClient.name || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 12px; color: var(--text-secondary, #6b7280); margin-bottom: 4px;">Email</div>
                                        <div style="font-size: 14px; color: var(--text-primary, #111827);">${linkedClient.email || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 12px; color: var(--text-secondary, #6b7280); margin-bottom: 4px;">Phone</div>
                                        <div style="font-size: 14px; color: var(--text-primary, #111827);">${linkedClient.phone || 'N/A'}</div>
                                    </div>
                                    ${linkedClient.company ? `
                                        <div>
                                            <div style="font-size: 12px; color: var(--text-secondary, #6b7280); margin-bottom: 4px;">Company</div>
                                            <div style="font-size: 14px; color: var(--text-primary, #111827);">${linkedClient.company}</div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Line Items -->
                    ${lineItems.length > 0 ? `
                        <div style="margin-bottom: 24px;">
                            <div style="font-size: 16px; font-weight: 600; color: var(--text-primary, #111827); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="8" y1="6" x2="21" y2="6"/>
                                    <line x1="8" y1="12" x2="21" y2="12"/>
                                    <line x1="8" y1="18" x2="21" y2="18"/>
                                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                                </svg>
                                Line Items
                            </div>
                            <div style="background: var(--bg-darker, #f3f4f6); border: 1px solid var(--border-color, #e5e7eb); border-radius: 10px; overflow: hidden;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr style="background: var(--bg-card, #ffffff); border-bottom: 1px solid var(--border-color, #e5e7eb);">
                                            <th style="padding: 12px; text-align: left; font-size: 12px; color: var(--text-secondary, #6b7280); font-weight: 600; text-transform: uppercase;">Description</th>
                                            <th style="padding: 12px; text-align: center; font-size: 12px; color: var(--text-secondary, #6b7280); font-weight: 600; text-transform: uppercase;">Qty</th>
                                            <th style="padding: 12px; text-align: right; font-size: 12px; color: var(--text-secondary, #6b7280); font-weight: 600; text-transform: uppercase;">Price</th>
                                            <th style="padding: 12px; text-align: right; font-size: 12px; color: var(--text-secondary, #6b7280); font-weight: 600; text-transform: uppercase;">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${lineItems.map((item, index) => `
                                            <tr style="border-bottom: 1px solid var(--border-color, #e5e7eb);">
                                                <td style="padding: 12px; font-size: 14px; color: var(--text-primary, #111827);">${item.description}</td>
                                                <td style="padding: 12px; text-align: center; font-size: 14px; color: var(--text-primary, #111827);">${item.quantity || 0}</td>
                                                <td style="padding: 12px; text-align: right; font-size: 14px; color: var(--text-primary, #111827);">$${(parseFloat(item.price) || 0).toFixed(2)}</td>
                                                <td style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: var(--text-primary, #111827);">$${((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}</td>
                                            </tr>
                                        `).join('')}
                                        <tr style="background: var(--bg-card, #ffffff);">
                                            <td colspan="3" style="padding: 16px; text-align: right; font-size: 16px; font-weight: 600; color: var(--text-primary, #111827);">Total:</td>
                                            <td style="padding: 16px; text-align: right; font-size: 18px; font-weight: 700; color: var(--primary-purple, #983e97);">$${total.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Notes -->
                    ${invoice.notes ? `
                        <div style="margin-bottom: 16px;">
                            <div style="font-size: 16px; font-weight: 600; color: var(--text-primary, #111827); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="16" y1="13" x2="8" y2="13"/>
                                    <line x1="16" y1="17" x2="8" y2="17"/>
                                </svg>
                                Notes
                            </div>
                            <div style="background: var(--bg-darker, #f3f4f6); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color, #e5e7eb);">
                                <p style="color: var(--text-primary, #111827); line-height: 1.6; white-space: pre-wrap; margin: 0;">${invoice.notes}</p>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Action Buttons -->
                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button class="button primary" onclick="editInvoice('${invoiceId}'); closeInvoiceDetailModal();" style="flex: 1;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit Invoice
                        </button>
                        <button class="button secondary" onclick="closeInvoiceDetailModal()" style="flex: 1;">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close invoice detail modal
window.closeInvoiceDetailModal = function() {
    const modal = document.getElementById('invoiceDetailModal');
    if (modal) {
        modal.remove();
    }
}





console.log('Invoices.js loaded successfully!');