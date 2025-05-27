// background.js

// Keep track of pending response Promises
const pendingResponses = new Map();

// Modify the message listener to properly handle async responses
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Create a Promise to track the async operation
    const responsePromise = new Promise(async (resolve) => {
        try {
            const response = await onMessage(message, sender, resolve);
            if (response !== undefined) {
                resolve(response);
            }
        } catch (error) {
            console.error('Error in onMessage:', error);
            resolve(null);
        }
    });

    // Store the Promise with a unique ID
    const responseId = Date.now() + Math.random();
    pendingResponses.set(responseId, responsePromise);

    // Clean up the Promise when it resolves
    responsePromise.finally(() => {
        pendingResponses.delete(responseId);
    });

    // Tell Chrome we want to send a response asynchronously
    return true;
});

// Modify onMessage to return the response instead of using sendResponse callback
async function onMessage(message, sender, sendResponse) {
    options = await loadOptions();
    
    try {
        switch (message.action) {
            case 'downloadFileBlob':
                cLog('downloadFileBlob: ' + message);
                return await ajaxRequest({
                    method: 'GET',
                    response: 'DOWNLOAD',
                    url: message.url,
                    filename: message.filename,
                    conflictAction: message.conflictAction,
                    headers: message.headers
                });
            // ...existing switch cases...
            default:
                return null;
        }
    } catch (error) {
        console.error('Error handling message:', error);
        return null;
    }
}

// Modify ajaxRequest to return a value instead of using callback
async function ajaxRequest(request) {
    // ...existing ajaxRequest code but return values instead of using sendResponse...
    try {
        const fetchResponse = await fetch(request.url, fetchOptions);

        if (fetchResponse.ok) {
            if (method === 'HEAD') {
                const headers = {};
                fetchResponse.headers.forEach((value, key) => {
                    headers[key] = value;
                });
                return {url: request.url, headers: headers};
            }
            // ...rest of the code...
        }
    } catch (error) {
        cLog(error);
        return null;
    }
}