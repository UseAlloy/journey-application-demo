// modals.js: Handles modal logic for the app

// Processing Modal
function showProcessingModal(message) {
    console.log('showProcessingModal called with:', message);
    document.getElementById('processingMessage').textContent = message;
    document.getElementById('processingModal').style.display = 'flex';
}

function hideProcessingModal() {
    document.getElementById('processingModal').style.display = 'none';
}

// In-app confirmation modal (reusable)
function inAppConfirm(message = 'Are you sure?', title = 'Confirm') {
    return new Promise((resolve) => {
        const modal = document.getElementById('inAppConfirmModal');
        const msg = document.getElementById('inAppConfirmMessage');
        const modalTitle = document.getElementById('inAppConfirmTitle');
        const okBtn = document.getElementById('inAppConfirmOk');
        const cancelBtn = document.getElementById('inAppConfirmCancel');

        msg.textContent = message;
        modalTitle.textContent = title;
        modal.style.display = 'flex';

        function cleanup(result) {
            modal.style.display = 'none';
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKeydown);
            resolve(result);
        }

        function onOk() { cleanup(true); }
        function onCancel() { cleanup(false); }
        function onKeydown(e) {
            if (e.key === 'Escape') cleanup(false);
            if (e.key === 'Enter') cleanup(true);
        }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKeydown);
        okBtn.focus();
    });
}

export { showProcessingModal, hideProcessingModal, inAppConfirm }; 