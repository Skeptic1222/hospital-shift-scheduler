// Client-side debug logging for shift creation issues
(function() {
    'use strict';

    // Configuration
    const DEBUG_CONFIG = {
        enabled: true,
        captureConsole: true,
        captureErrors: true,
        captureNetworkRequests: true,
        captureUserActions: true,
        sendToServer: true,
        logToLocalStorage: true,
        maxLogSize: 1000 // Maximum number of log entries
    };

    // Log buffer
    const logBuffer = [];
    const startTime = Date.now();

    // Helper to get timestamp
    function getTimestamp() {
        return new Date().toISOString();
    }

    // Helper to get elapsed time
    function getElapsedTime() {
        return Date.now() - startTime;
    }

    // Add log entry
    function addLog(type, level, message, data = {}) {
        const entry = {
            timestamp: getTimestamp(),
            elapsed: getElapsedTime(),
            type,
            level,
            message,
            data,
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        logBuffer.push(entry);

        // Keep buffer size under control
        if (logBuffer.length > DEBUG_CONFIG.maxLogSize) {
            logBuffer.shift();
        }

        // Save to localStorage
        if (DEBUG_CONFIG.logToLocalStorage) {
            try {
                localStorage.setItem('debug_logs', JSON.stringify(logBuffer));
            } catch (e) {
                console.warn('Failed to save debug logs to localStorage:', e);
            }
        }

        // Send to server periodically
        if (DEBUG_CONFIG.sendToServer && logBuffer.length % 10 === 0) {
            sendLogsToServer();
        }
    }

    // Send logs to server
    function sendLogsToServer() {
        if (logBuffer.length === 0) return;

        const logs = [...logBuffer];
        logBuffer.length = 0;

        fetch('/api/client-logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ logs })
        }).catch(err => {
            console.warn('Failed to send logs to server:', err);
            // Re-add logs to buffer on failure
            logBuffer.push(...logs);
        });
    }

    // Capture console methods
    if (DEBUG_CONFIG.captureConsole) {
        const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug
        };

        Object.keys(originalConsole).forEach(method => {
            console[method] = function(...args) {
                addLog('console', method, args.join(' '), { args });
                originalConsole[method].apply(console, args);
            };
        });
    }

    // Capture global errors
    if (DEBUG_CONFIG.captureErrors) {
        window.addEventListener('error', function(event) {
            addLog('error', 'error', event.message, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error ? {
                    message: event.error.message,
                    stack: event.error.stack
                } : null
            });
        });

        window.addEventListener('unhandledrejection', function(event) {
            addLog('error', 'unhandledRejection', 'Unhandled Promise Rejection', {
                reason: event.reason,
                promise: event.promise
            });
        });
    }

    // Capture network requests
    if (DEBUG_CONFIG.captureNetworkRequests) {
        // Intercept fetch
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const [url, options = {}] = args;
            const startTime = Date.now();

            addLog('network', 'info', `Fetch: ${options.method || 'GET'} ${url}`, {
                url,
                method: options.method || 'GET',
                headers: options.headers,
                body: options.body
            });

            return originalFetch.apply(this, args)
                .then(response => {
                    const duration = Date.now() - startTime;
                    addLog('network', response.ok ? 'info' : 'error',
                        `Response: ${response.status} ${response.statusText}`, {
                        url,
                        status: response.status,
                        statusText: response.statusText,
                        duration,
                        headers: response.headers
                    });

                    // Clone response to read body
                    const clonedResponse = response.clone();
                    clonedResponse.text().then(body => {
                        try {
                            const json = JSON.parse(body);
                            addLog('network', 'debug', 'Response body', { url, body: json });
                        } catch {
                            addLog('network', 'debug', 'Response body (text)', { url, body });
                        }
                    }).catch(() => {});

                    return response;
                })
                .catch(error => {
                    const duration = Date.now() - startTime;
                    addLog('network', 'error', `Fetch failed: ${error.message}`, {
                        url,
                        error: error.message,
                        stack: error.stack,
                        duration
                    });
                    throw error;
                });
        };

        // Intercept XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._debugInfo = { method, url, startTime: null };
            return originalXHROpen.call(this, method, url, ...args);
        };

        XMLHttpRequest.prototype.send = function(body) {
            if (this._debugInfo) {
                this._debugInfo.startTime = Date.now();
                this._debugInfo.body = body;

                addLog('network', 'info', `XHR: ${this._debugInfo.method} ${this._debugInfo.url}`, {
                    method: this._debugInfo.method,
                    url: this._debugInfo.url,
                    body
                });

                this.addEventListener('load', function() {
                    const duration = Date.now() - this._debugInfo.startTime;
                    addLog('network', 'info', `XHR Response: ${this.status}`, {
                        url: this._debugInfo.url,
                        status: this.status,
                        statusText: this.statusText,
                        response: this.responseText,
                        duration
                    });
                });

                this.addEventListener('error', function() {
                    const duration = Date.now() - this._debugInfo.startTime;
                    addLog('network', 'error', 'XHR Failed', {
                        url: this._debugInfo.url,
                        duration
                    });
                });
            }

            return originalXHRSend.call(this, body);
        };
    }

    // Capture user actions
    if (DEBUG_CONFIG.captureUserActions) {
        // Click events
        document.addEventListener('click', function(event) {
            const target = event.target;
            const selector = getElementSelector(target);

            addLog('user', 'info', `Click: ${selector}`, {
                selector,
                tagName: target.tagName,
                id: target.id,
                className: target.className,
                text: target.textContent ? target.textContent.substring(0, 100) : '',
                href: target.href,
                type: target.type
            });

            // Special handling for shift creation button
            if (target.textContent && target.textContent.includes('Create Shift')) {
                addLog('shift', 'important', 'CREATE SHIFT BUTTON CLICKED', {
                    selector,
                    buttonState: {
                        disabled: target.disabled,
                        ariaDisabled: target.getAttribute('aria-disabled'),
                        classList: Array.from(target.classList)
                    }
                });
            }
        }, true);

        // Form submissions
        document.addEventListener('submit', function(event) {
            const form = event.target;
            const formData = new FormData(form);
            const data = {};
            formData.forEach((value, key) => {
                data[key] = value;
            });

            addLog('user', 'info', 'Form Submit', {
                action: form.action,
                method: form.method,
                data
            });
        }, true);

        // Input changes
        document.addEventListener('change', function(event) {
            const target = event.target;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                addLog('user', 'debug', `Input Change: ${getElementSelector(target)}`, {
                    name: target.name,
                    type: target.type,
                    value: target.type === 'password' ? '***' : target.value
                });
            }
        }, true);
    }

    // Helper to get element selector
    function getElementSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        if (element.className) {
            return `${element.tagName.toLowerCase()}.${element.className.split(' ').join('.')}`;
        }
        return element.tagName.toLowerCase();
    }

    // Export debug functions
    window.debugTools = {
        getLogs: () => logBuffer,
        clearLogs: () => {
            logBuffer.length = 0;
            localStorage.removeItem('debug_logs');
        },
        sendLogs: sendLogsToServer,
        downloadLogs: () => {
            const blob = new Blob([JSON.stringify(logBuffer, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `debug-logs-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },
        config: DEBUG_CONFIG
    };

    // Log initialization
    addLog('system', 'info', 'Debug logging initialized', {
        config: DEBUG_CONFIG,
        pageLoad: performance.timing
    });

    // Send logs on page unload
    window.addEventListener('beforeunload', function() {
        if (DEBUG_CONFIG.sendToServer) {
            sendLogsToServer();
        }
    });

    console.log('🔍 Debug logging enabled. Use window.debugTools to access debug functions.');
})();