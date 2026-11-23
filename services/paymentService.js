const axios = require('axios');

const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || 'test_secret_key_dc74e0fd57cb46cd93832aee0a390791';
const KHALTI_BASE_URL = process.env.KHALTI_BASE_URL || 'https://a.khalti.com';
const CLIENT_BASE = process.env.CLIENT_URL || 'http://localhost:3000';

// khalti api request helper
async function khaltiRequest(endpoint, payload) {
  const resp = await axios.post(`${KHALTI_BASE_URL}${endpoint}`, payload, {
    headers: {
      Authorization: `Key ${KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  return resp.data;
}

module.exports = { KHALTI_SECRET_KEY, KHALTI_BASE_URL, CLIENT_BASE, khaltiRequest };
