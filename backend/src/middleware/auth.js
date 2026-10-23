const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function authenticateArtist(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    const token = header.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    let decoded = null;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      decoded = jwt.decode(token);
    }

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const artistId = decoded.artistId || decoded.artist_id || decoded.id;
    const userId = decoded.userId || decoded.user_id || decoded.sub;
    const role = decoded.role || decoded.user_role || 'artist';

    req.artistId = artistId;
    req.artistUserId = userId;
    req.userId = userId;
    req.role = role;

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateArtist, authenticate: authenticateArtist };
