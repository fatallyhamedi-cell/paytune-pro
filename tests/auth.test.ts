import { describe, it } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

describe('Authentication & Authorization Engine', () => {
  it('hashes passwords securely using bcrypt', async () => {
    const rawPassword = 'SecurePassword123!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);

    assert.notStrictEqual(hash, rawPassword);
    const isValid = await bcrypt.compare(rawPassword, hash);
    assert.strictEqual(isValid, true, 'Correct password must compare true against bcrypt hash');

    const isWrong = await bcrypt.compare('WrongPassword456', hash);
    assert.strictEqual(isWrong, false, 'Incorrect password must fail comparison');
  });

  it('generates and verifies JWT with correct artist role and claims', () => {
    const artistPayload = {
      artistId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
      userId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
      role: 'artist',
      email: 'testartist@paytune.com'
    };

    const token = jwt.sign(artistPayload, JWT_SECRET, { expiresIn: '7d' });
    assert.ok(token && typeof token === 'string');

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    assert.strictEqual(decoded.artistId, artistPayload.artistId);
    assert.strictEqual(decoded.role, 'artist');
    assert.strictEqual(decoded.email, 'testartist@paytune.com');
  });

  it('generates and verifies JWT for Master Admin with elevated role', () => {
    const adminPayload = {
      id: 'master-admin-uuid-001',
      userId: 'master-admin-uuid-001',
      role: 'MASTER_ADMIN',
      email: 'master@paytune.com'
    };

    const token = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '24h' });
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    assert.strictEqual(decoded.role, 'MASTER_ADMIN');
    assert.strictEqual(decoded.email, 'master@paytune.com');
  });

  it('rejects tampered or invalid JWT signatures', () => {
    const validToken = jwt.sign({ userId: 'u-123', role: 'user' }, JWT_SECRET);
    const tamperedToken = validToken.slice(0, -5) + 'xxxxx';

    assert.throws(
      () => {
        jwt.verify(tamperedToken, JWT_SECRET);
      },
      /invalid signature|jwt malformed/i,
      'Tampered token must throw invalid signature error'
    );
  });
});
