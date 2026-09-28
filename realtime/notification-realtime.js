module.exports = function registerNotificationRealtime(io) {
  io.on('connection', socket => {
    const session = socket.request.session;
    if (session?.user?.id) socket.join(`notifications:user:${Number(session.user.id)}`);
    if (session?.admin?.id) socket.join('notifications:admins');
  });
};
