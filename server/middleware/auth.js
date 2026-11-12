const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Validates the Authorization Bearer token on protected routes.
 * Decodes the JWT and attaches the authenticated user payload to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Header format: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid or malformed token.' });
  }
}

module.exports = authenticateToken;
