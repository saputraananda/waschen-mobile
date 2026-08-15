import express from 'express';
import {
  generateRegistrationOptionsHandler,
  verifyRegistrationHandler,
  generateAuthenticationOptionsHandler,
  verifyAuthenticationHandler,
  getBiometricStatusHandler,
  deleteBiometricHandler
} from '../../controllers/auth/biometrics.controller.js';

const router = express.Router();

// Registration WebAuthn endpoints
router.post('/webauthn/register-options', generateRegistrationOptionsHandler);
router.post('/webauthn/register-verify', verifyRegistrationHandler);

// Authentication / Login WebAuthn endpoints
router.post('/webauthn/login-options', generateAuthenticationOptionsHandler);
router.post('/webauthn/login-verify', verifyAuthenticationHandler);

// Status & Management
router.get('/webauthn/status', getBiometricStatusHandler);
router.delete('/webauthn/remove', deleteBiometricHandler);

export default router;
