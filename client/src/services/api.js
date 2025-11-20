import axios from 'axios';

export const scanWebsite = (url) =>
  axios.get(`/api/scan?url=${encodeURIComponent(url)}`);


