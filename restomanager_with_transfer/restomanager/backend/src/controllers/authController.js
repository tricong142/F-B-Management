const UserModel = require('../models/User');
const LogModel  = require('../models/Log');
const { signToken } = require('../middleware/auth');
const { ok, asyncHandler, ApiError } = require('../utils/response');

exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    throw ApiError.validation('Vui lòng nhập tên đăng nhập và mật khẩu');

  const user = await UserModel.findByUsername(String(username).trim());
  if (!user || !user.is_active)
    throw ApiError.unauthorized('Tên đăng nhập hoặc mật khẩu không đúng');

  const verified = await UserModel.verifyPassword(user, password);
  if (!verified)
    throw ApiError.unauthorized('Tên đăng nhập hoặc mật khẩu không đúng');

  const token = signToken({
    id: user.id, username: user.username, role: user.role, full_name: user.full_name,
  });

  LogModel.write({
    user_id: user.id, user_name: user.full_name, action: 'LOGIN',
    entity: 'USER', entity_id: user.id, ip: req.ip,
  }).catch(() => {});

  return ok(res, { token, user: UserModel.publicView(user) }, { message: 'Đăng nhập thành công' });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user.id);
  if (!user) throw ApiError.notFound('User không tồn tại');
  return ok(res, UserModel.publicView(user));
});

exports.logout = asyncHandler(async (req, res) => {
  if (req.user) {
    LogModel.write({
      user_id: req.user.id, user_name: req.user.full_name,
      action: 'LOGOUT', entity: 'USER', entity_id: req.user.id, ip: req.ip,
    }).catch(() => {});
  }
  return ok(res, null, { message: 'Đã đăng xuất' });
});
