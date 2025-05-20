import Alloy from 'https://esm.sh/@alloyidentity/web-sdk';
window.alloy = Alloy;

// --- Alloy SDK config and initialization logic ---
let alloyConfig = {
    key: '',
    journeyApplicationToken: 'JA-xyz',
    journeyToken: ''
};

// Fetch configuration from server
async function initializeAlloy() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
        }
        const config = await response.json();
        if (!config.ALLOY_SDK_KEY || !config.ALLOY_JOURNEY_TOKEN || !config.ALLOY_TOKEN || !config.ALLOY_SECRET || !config.ALLOY_BASE_URL) {
            window.location.href = '/config.html';
            return;
        }
        alloyConfig = {
            key: config.ALLOY_SDK_KEY,
            journeyToken: config.ALLOY_JOURNEY_TOKEN,
            token: config.ALLOY_TOKEN,
            secret: config.ALLOY_SECRET,
            baseUrl: config.ALLOY_BASE_URL
        };
    } catch (error) {
        console.error('Error initializing Alloy:', error);
        alert('Failed to initialize verification system. Please try again later.');
        throw error;
    }
}

// Function to initialize Alloy SDK for step-up
async function initializeAlloySDK(journeyApplicationToken) {
    const sdkContainer = document.getElementById('alloySDKContainer');
    const sdkMount = document.getElementById('alloySDKMount');
    sdkContainer.style.display = 'block';
    try {
        const credentials = btoa(`${alloyConfig.token}:${alloyConfig.secret}`);
        await window.alloy.init({
            key: alloyConfig.key,
            journeyToken: alloyConfig.journeyToken,
            journeyApplicationToken: journeyApplicationToken,
            production: false,
            headers: {
                'Authorization': `Basic ${credentials}`
            }
        });
        window.alloy.open((data) => {
            sdkContainer.style.display = 'none';
            // Show Under Review if closed without completion
            if (!data || data.status === 'pending_step_up') {
                if (typeof showStatusMessage === 'function') showStatusMessage('manualReviewMessage');
                if (typeof hideProcessingModal === 'function') hideProcessingModal();
                return;
            }
            if (data.journey_application_status) {
                if (data.status === 'completed') {
                    if (data.journey_application_status === 'Approved') {
                        if (typeof showStatusMessage === 'function') showStatusMessage('approvedMessage');
                    } else if (data.journey_application_status === 'Denied') {
                        if (typeof showStatusMessage === 'function') showStatusMessage('deniedMessage');
                    } else if (data.journey_application_status === 'Pending') {
                        if (typeof showStatusMessage === 'function') showStatusMessage('manualReviewMessage');
                    } else {
                        if (typeof showStatusMessage === 'function') showStatusMessage('manualReviewMessage');
                    }
                }
            }
        }, 'alloySDKMount');
    } catch (error) {
        console.error('Error initializing Alloy SDK:', error);
        sdkContainer.style.display = 'none';
    }
}

// On DOMContentLoaded, check if Add Business should be shown
window.addEventListener('DOMContentLoaded', () => {
    if (window.api && typeof window.api.send === 'function') {
        window.api.send('renderer-ready');
    }
    if (window.api && typeof window.api.getBusinessBranch === 'function') {
        window.api.getBusinessBranch().then((hasBusinessesBranch) => {
            toggleAddBusinessButton(hasBusinessesBranch);
        });
    }
    // Listen for updates from main process
    if (window.api && typeof window.api.receive === 'function') {
        window.api.receive('set-business-branch', (hasBusinessesBranch) => {
            toggleAddBusinessButton(hasBusinessesBranch);
        });
    }
    initializeAlloy().catch(error => {
        console.error('Initialization failed:', error);
    });
});

function toggleAddBusinessButton(show) {
    const btn = document.getElementById('addBusinessBtn');
    if (btn) {
        btn.style.display = show ? '' : 'none';
    }
}

// Expose initializeAlloySDK globally if needed
window.initializeAlloySDK = initializeAlloySDK;

// Listen for update-available event from Electron main process
if (window.api && typeof window.api.receive === 'function') {
    window.api.receive('update-available', (data) => {
        showUpdateAlert(data.latestVersion, data.url);
    });
}

function showUpdateAlert(version, url) {
    let alertDiv = document.getElementById('updateAlert');
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.id = 'updateAlert';
        alertDiv.className = 'alert alert-info alert-dismissible fade show d-flex flex-column align-items-center justify-content-center';
        alertDiv.style.position = 'fixed';
        alertDiv.style.top = '50%';
        alertDiv.style.left = '50%';
        alertDiv.style.transform = 'translate(-50%, -50%)';
        alertDiv.style.zIndex = 3000;
        alertDiv.style.minWidth = '350px';
        alertDiv.style.maxWidth = '90vw';
        alertDiv.style.boxShadow = '0 4px 32px rgba(0,0,0,0.25)';
        alertDiv.style.padding = '2rem 2.5rem';
        alertDiv.style.textAlign = 'center';
        alertDiv.style.fontSize = '1.25em';
        alertDiv.innerHTML = `
            <div style="font-size:1.6rem;font-weight:600;">Update Available</div>
            <div class="mb-2">Version <strong>${version}</strong> is available!<br/><br/>To ensure the latest updates and bug fixes are available to you, please download the latest version.</div>
            <button id="downloadUpdateBtn" class="btn btn-primary btn-lg mb-2" style="font-size:1.25em;">
                <i class="fas fa-download me-2"></i>Download
            </button>
            <button type="button" class="btn-close position-absolute" style="top:10px;right:10px;" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        document.body.appendChild(alertDiv);
    }
    const btn = document.getElementById('downloadUpdateBtn');
    if (btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            if (window.api && typeof window.api.send === 'function') {
                window.api.send('open-external', url);
            } else {
                window.open(url, '_blank');
            }
        });
    }
} 