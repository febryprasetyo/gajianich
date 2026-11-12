import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIndonesianPhoneNumber,
  generateAccountBlastMessage,
  sendWhatsAppMessage,
} from './whatsappService';

describe('WhatsApp Service', () => {
  describe('normalizeIndonesianPhoneNumber', () => {
    it('normalizes 08xx phone numbers to 628xx', () => {
      assert.equal(normalizeIndonesianPhoneNumber('081234567890'), '6281234567890');
      assert.equal(normalizeIndonesianPhoneNumber('0812-3456-7890'), '6281234567890');
      assert.equal(normalizeIndonesianPhoneNumber('0812 3456 7890'), '6281234567890');
    });

    it('normalizes +628xx and 628xx phone numbers', () => {
      assert.equal(normalizeIndonesianPhoneNumber('+6281234567890'), '6281234567890');
      assert.equal(normalizeIndonesianPhoneNumber('6281234567890'), '6281234567890');
    });

    it('normalizes 8xx phone numbers to 628xx', () => {
      assert.equal(normalizeIndonesianPhoneNumber('81234567890'), '6281234567890');
    });

    it('returns null for empty, null, or invalid phone numbers', () => {
      assert.equal(normalizeIndonesianPhoneNumber(null), null);
      assert.equal(normalizeIndonesianPhoneNumber(''), null);
      assert.equal(normalizeIndonesianPhoneNumber('12345'), null);
      assert.equal(normalizeIndonesianPhoneNumber('021-5551234'), null); // landline
      assert.equal(normalizeIndonesianPhoneNumber('abcd'), null);
    });
  });

  describe('generateAccountBlastMessage', () => {
    it('generates message with employee name, username, password and login link', () => {
      const msg = generateAccountBlastMessage({
        fullName: 'Budi Santoso',
        username: 'budi',
        tempPassword: 'SecretPassword123!',
        loginUrl: 'https://ams.company.com/login',
      });

      assert.ok(msg.includes('Budi Santoso'));
      assert.ok(msg.includes('`budi`'));
      assert.ok(msg.includes('`SecretPassword123!`'));
      assert.ok(msg.includes('https://ams.company.com/login'));
      assert.ok(msg.includes('ganti password'));
    });
  });

  describe('sendWhatsAppMessage', () => {
    it('returns error when gateway is not configured', async () => {
      const result = await sendWhatsAppMessage({
        to: '6281234567890',
        message: 'Halo',
        apiUrl: '',
        apiToken: '',
      });

      assert.equal(result.success, false);
      assert.equal(result.error, 'WHATSAPP_GATEWAY_NOT_CONFIGURED');
    });
  });
});
