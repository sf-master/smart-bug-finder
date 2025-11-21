import axios from 'axios';

/**
 * API Base URL Configuration
 * 
 * Development: Leave VITE_API_BASE_URL unset (empty) to use Vite proxy
 *   - Requests go to /api/* → Vite proxy → http://localhost:5050
 * 
 * Production: Set VITE_API_BASE_URL to your API server URL
 *   - Example: VITE_API_BASE_URL=http://0.0.0.0:5050
 *   - Example: VITE_API_BASE_URL=https://api.example.com
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  }
});

export const scanWebsite = (url) =>
  apiClient.get(`/api/scan?url=${encodeURIComponent(url)}`);

export const analyzeUrl = (url) =>
  apiClient.get(`/api/analyze-url?url=${encodeURIComponent(url)}`);

/**
 * Creates a fetch-based stream for DOM analysis with progressive loading
 * Uses fetch instead of EventSource to support custom headers (needed for ngrok)
 * @param {string} url - The URL to analyze
 * @param {Function} onMessage - Callback for each message received
 * @returns {Function} Abort function to cancel the stream
 */
export const analyzeUrlStream = (url, onMessage) => {
  // Build the stream URL
  let streamUrl;
  if (API_BASE_URL) {
    streamUrl = `${API_BASE_URL}/api/analyze-url-stream?url=${encodeURIComponent(url)}`;
  } else {
    // Relative path - Vite proxy will handle it
    streamUrl = `/api/analyze-url-stream?url=${encodeURIComponent(url)}`;
  }

  const abortController = new AbortController();
  
  // Use fetch with ReadableStream to support custom headers
  fetch(streamUrl, {
    method: 'GET',
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'Accept': 'text/event-stream'
    },
    signal: abortController.signal
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = 'message';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.substring(6).trim();
          } else if (line === '') {
            // Empty line indicates end of message
            if (currentData) {
              try {
                const data = JSON.parse(currentData);
                onMessage({ type: currentEvent, data });
              } catch (error) {
                console.error(`Error parsing ${currentEvent} event:`, error);
              }
            }
            currentEvent = 'message';
            currentData = '';
          }
        }
      }

      // Handle any remaining data in buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        let currentEvent = 'message';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.substring(6).trim();
          } else if (line === '' && currentData) {
            try {
              const data = JSON.parse(currentData);
              onMessage({ type: currentEvent, data });
            } catch (error) {
              console.error(`Error parsing ${currentEvent} event:`, error);
            }
            currentEvent = 'message';
            currentData = '';
          }
        }
      }
    })
    .catch((error) => {
      if (error.name === 'AbortError') {
        console.log('Stream aborted');
        return;
      }
      console.error('Stream error:', error);
      onMessage({ type: 'error', data: { error: error.message || 'Connection error' } });
    });

  // Return abort function
  return () => {
    abortController.abort();
  };
};

