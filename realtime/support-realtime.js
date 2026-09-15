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
    socket.on('support:typing', async payload => {
      try {
        const ticketId=Number(payload && payload.ticketId); if(!ticketId)return;
        const session=socket.request.session; let allowed=false, actorType='', actorName='';
        if(session?.admin?.id){allowed=!!(await Support.findById(ticketId));actorType='ADMIN';actorName=session.admin.name||'Support TiopTiop';}
        else if(session?.user?.id){allowed=!!(await Support.findForUser(ticketId,Number(session.user.id)));actorType='CUSTOMER';actorName=session.user.display_name||session.user.first_name||'Client';}
        if(allowed) {
          const event={ticketId,typing:!!payload.typing,actorType,actorName};
          const ticket=await Support.findById(ticketId);
          const rooms=[`support:${ticketId}`];
          if(actorType==='ADMIN' && ticket?.user_id) rooms.push(`support:user:${Number(ticket.user_id)}`);
          if(actorType==='CUSTOMER') rooms.push('support:admins');
          socket.to(rooms).emit('support:typing',event);
        }
      } catch(_){}
    });
    socket.on('support:leave', payload => {
      const ticketId = Number(payload && payload.ticketId);
      if (ticketId) socket.leave(`support:${ticketId}`);
    });
  });
};
