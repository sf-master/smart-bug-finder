import axios from 'axios';

export const scanWebsite = (url) =>
  axios.get(`/api/scan?url=${encodeURIComponent(url)}`);

export const analyzeUrl = (url) =>
  axios.get(`/api/analyze-url?url=${encodeURIComponent(url)}`);

