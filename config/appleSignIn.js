const jwt = require('jsonwebtoken');
const qs = require('querystring');
const axios = require('axios');

const signWithApplePrivateKey = process.env.APPLE_SCRET_KEY;

const createSignWithAppleSecret = () => {
	console.log(signWithApplePrivateKey);
  const token = jwt.sign({}, signWithApplePrivateKey, {
    algorithm: 'ES256',
    expiresIn: '1h',
    audience: 'https://appleid.apple.com',
    issuer: process.env.APPLE_TEAM_ID,
    subject: process.env.APPLE_SERVICE_ID,
    keyid: process.env.APPLE_KEY_ID,
  });
  return token;
};

const getAppleToken = async (code) => {
  try {
    const response = await axios.post(
      'https://appleid.apple.com/auth/token',
      qs.stringify({
        grant_type: 'authorization_code',
        code,
        client_secret: createSignWithAppleSecret(),
        client_id: process.env.APPLE_SERVICE_ID,
        redirect_uri: process.env.APPLE_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    console.log('response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting Apple token:', error.message);
    throw error;
  }
};

module.exports = {
	createSignWithAppleSecret,
	getAppleToken,
};
  