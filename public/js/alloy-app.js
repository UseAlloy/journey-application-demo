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

// Call initialization on page load
window.addEventListener('DOMContentLoaded', () => {
    initializeAlloy().catch(error => {
        console.error('Initialization failed:', error);
    });
});

// Expose initializeAlloySDK globally if needed
window.initializeAlloySDK = initializeAlloySDK; 