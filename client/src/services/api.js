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
 * Creates an EventSource for streaming DOM analysis with progressive loading
 * @param {string} url - The URL to analyze
 * @param {Function} onMessage - Callback for each message received
 * @returns {EventSource} The EventSource instance
 */
export const analyzeUrlStream = (url, onMessage) => {
  // For EventSource, we need to handle the base URL properly
  // If API_BASE_URL is empty, use relative path (works with Vite proxy)
  // Otherwise, use the full URL
  let streamUrl;
  if (API_BASE_URL) {
    streamUrl = `${API_BASE_URL}/api/analyze-url-stream?url=${encodeURIComponent(url)}`;
  } else {
    // Relative path - Vite proxy will handle it
    streamUrl = `/api/analyze-url-stream?url=${encodeURIComponent(url)}`;
  }
  
  const eventSource = new EventSource(streamUrl);
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage({ type: 'message', event: 'default', data });
    } catch (error) {
      console.error('Error parsing SSE message:', error);
    }
  };
  
  // Handle custom events (head, body, status, error, complete)
  eventSource.addEventListener('head', (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage({ type: 'head', data });
    } catch (error) {
      console.error('Error parsing head event:', error);
    }
  });
  
  eventSource.addEventListener('body', (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage({ type: 'body', data });
    } catch (error) {
      console.error('Error parsing body event:', error);
    }
  });
  
  eventSource.addEventListener('status', (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage({ type: 'status', data });
    } catch (error) {
      console.error('Error parsing status event:', error);
    }
  });
  
  eventSource.addEventListener('error', (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage({ type: 'error', data });
    } catch (error) {
      console.error('Error parsing error event:', error);
    }
  });
  
  eventSource.addEventListener('complete', (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage({ type: 'complete', data });
      eventSource.close();
    } catch (error) {
      console.error('Error parsing complete event:', error);
    }
  });
  
  eventSource.onerror = (error) => {
    console.error('EventSource error:', error);
    onMessage({ type: 'error', data: { error: 'Connection error' } });
    eventSource.close();
  };
  
  return eventSource;
};

