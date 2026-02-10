// Utility Functions

// Notification container management
let notificationContainer = null;

function getNotificationContainer() {
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        Object.assign(notificationContainer.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '10000',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '400px',
            width: '100%',
            pointerEvents: 'none'
        });
        document.body.appendChild(notificationContainer);
    }
    return notificationContainer;
}

// Show notification - stays until manually closed
export function showNotification(message, type = 'info') {
    const container = getNotificationContainer();
    const notification = document.createElement('div');
    const notificationId = `notification-${Date.now()}-${Math.random()}`;
    notification.id = notificationId;
    notification.className = `notification ${type}`;
    
    // Get color based on type
    const colors = {
        'success': { bg: '#10b981', icon: '✓' },
        'error': { bg: '#ef4444', icon: '✕' },
        'warning': { bg: '#f59e0b', icon: '⚠' },
        'info': { bg: '#3b82f6', icon: 'ℹ' }
    };
    const color = colors[type] || colors['info'];

    // Create notification HTML
    notification.innerHTML = `
        <div style=\"display: flex; align-items: flex-start; gap: 12px;\">
            <div style=\"font-size: 18px; font-weight: bold;\">${color.icon}</div>
            <div style=\"flex: 1; font-size: 14px;\">${message}</div>
            <button class=\"notification-close\" style=\"
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.8;
                transition: opacity 0.2s;
            \" onmouseover=\"this.style.opacity='1'\" onmouseout=\"this.style.opacity='0.8'\">×</button>
        </div>
    `;

    // Style the notification
    Object.assign(notification.style, {
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: color.bg,
        color: 'white',
        fontWeight: '500',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        animation: 'slideIn 0.3s ease-out',
        pointerEvents: 'all',
        minWidth: '300px'
    });

    container.appendChild(notification);

    // Add close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.onclick = () => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    };

    // Add CSS animations if not already present
    if (!document.getElementById('notificationStyles')) {
        const style = document.createElement('style');
        style.id = 'notificationStyles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Format date
export function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Format currency
export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

// Check if date is overdue
export function isOverdue(dueDate) {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
}

// Debounce function
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export to CSV
export function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            const value = row[header] || '';
            return `\"${String(value).replace(/\"/g, '\"\"')}\"`;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    showNotification('Export successful!', 'success');
}

// Import from CSV
export function importFromCSV(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/\"/g, ''));

        const data = lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
                const values = line.split(',').map(v => v.trim().replace(/\"/g, ''));
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = values[index] || '';
                });
                return obj;
            });

        callback(data);
    };
    reader.readAsText(file);
}

// Make functions available globally
window.showNotification = showNotification;
window.formatDate = formatDate;
window.formatCurrency = formatCurrency;
window.isOverdue = isOverdue;
