const Notification = require('../models/notification.model');
async function createAndEmit(io, data, room) {
  const id = await Notification.create(data);
  if (io && room) io.to(room).emit('notification:new', { id });
  return id;
}
exports.client = (io, userId, data) => createAndEmit(io, { ...data, userId }, `notifications:user:${Number(userId)}`);
exports.admin = (io, data) => createAndEmit(io, { ...data, userId:null }, 'notifications:admins');
exports.changedClient = (io,userId)=>io?.to(`notifications:user:${Number(userId)}`).emit('notification:changed');
exports.changedAdmin = io=>io?.to('notifications:admins').emit('notification:changed');
