const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/response');

const JWT_SECRET  = process.env.JWT_SECRET  || 'restomanager-dev-secret-change-me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '12h';

function signToken(payload)  { return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES }); }
function verifyToken(token)  { return jwt.verify(token, JWT_SECRET); }

/** Express middleware: yêu cầu Authorization: Bearer <token> */
function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized('Thiếu token xác thực'));
  try {
    req.user = verifyToken(token);
    return next();
  } catch (err) {
    // JWT errors → globalErrorHandler sẽ map sang 401
    return next(err);
  }
}

/** Yêu cầu user có 1 trong các vai trò chỉ định. */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Chưa xác thực'));
    if (!roles.includes(req.user.role))
      return next(ApiError.forbidden(`Yêu cầu vai trò: ${roles.join(', ')}`));
    next();
  };
}

module.exports = { signToken, verifyToken, requireAuth, requireRole, JWT_SECRET };
