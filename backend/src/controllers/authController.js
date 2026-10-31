const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'paytune_jwt_secret_key_2026';

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Fetch user from Supabase users table
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    // 2. Master Admin automatic fallback
    if (!user && cleanEmail === 'master@paytune.com') {
      const isMasterPass =
        password === 'PaytuneMaster2025!' ||
        password === 'MasterAdmin#2026!' ||
        password === 'Paytune2025!';
      if (isMasterPass) {
        user = {
          id: 'master-admin-uuid-001',
          email: 'master@paytune.com',
          full_name: 'Master Admin',
          role: 'master',
          password_hash: '$2a$10$7YQZpVn.p3g9HnOaVJ2QOeW2qJZO5nY8cF9sG6hKjL0pR1tU2vW3x'
        };
      }
    }

    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    let valid = false;
    if (user.password_hash) {
      try {
        valid = await bcrypt.compare(password, user.password_hash);
      } catch (e) {}
    }

    // Known master passwords fallback for Master Admin
    if (!valid && (user.role === 'master' || user.role === 'MASTER_ADMIN' || cleanEmail === 'master@paytune.com')) {
      valid =
        password === 'PaytuneMaster2025!' ||
        password === 'MasterAdmin#2026!' ||
        password === 'Paytune2025!';
    }

    if (!valid) return res.status(401).json({ error: 'invalid_credentials' });

    const role = (user.role === 'MASTER_ADMIN' || cleanEmail === 'master@paytune.com')
      ? 'master'
      : (user.role || 'user');

    // ✅ CRITICAL: Sign the token with the user's role (user, artist, or master)
    const token = jwt.sign(
      { userId: user.id, role, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        full_name: user.full_name || 'Master Admin', 
        role 
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const cleanEmail = String(email).trim().toLowerCase();
    const { data: existing } = await supabase.from('users').select('id').eq('email', cleanEmail).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data: user, error } = await supabase.from('users').insert([
      { email: cleanEmail, password_hash, full_name, role: 'user' }
    ]).select().single();

    if (error) throw error;

    const token = jwt.sign({ userId: user.id, role: 'user', email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
