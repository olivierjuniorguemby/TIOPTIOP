const Support = require('../models/support.model');

module.exports = function registerSupportRealtime(io) {
  io.on('connection', socket => {
    const session=socket.request.session;
    if(session?.admin?.id) socket.join('support:admins');
    if(session?.user?.id) socket.join(`support:user:${Number(session.user.id)}`);
    socket.on('support:join', async payload => {
      try {
        const ticketId = Number(payload && payload.ticketId);
        if (!ticketId) return;
        const session = socket.request.session;
        if (session?.admin?.id) {
          if (await Support.findById(ticketId)) socket.join(`support:${ticketId}`);
          return;
        }
        const userId = Number(session?.user?.id);
        if (userId && await Support.findForUser(ticketId, userId)) socket.join(`support:${ticketId}`);
      } catch (_) {}
    });
    socket.on('support:leave', payload => {
      const ticketId = Number(payload && payload.ticketId);
      if (ticketId) socket.leave(`support:${ticketId}`);
    });
  });
};
