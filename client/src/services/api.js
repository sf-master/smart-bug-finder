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

