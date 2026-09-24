const fs=require('fs');
let pass=0,fail=0;function t(n,c){if(c){console.log('PASS - '+n);pass++}else{console.log('FAIL - '+n);fail++}}
const model=fs.readFileSync('models/support.model.js','utf8'),ctl=fs.readFileSync('controllers/client/support.controller.js','utf8'),route=fs.readFileSync('routes/client/account.routes.js','utf8'),view=fs.readFileSync('views/client/account/support.ejs','utf8');
t('archive client ne masque plus côté admin',/SET client_archived_at=NOW\(\),updated_at=NOW\(\)/.test(model)&&!/SET client_archived_at=NOW\(\),admin_archived_at=NOW\(\)/.test(model));
t('liste demandes masquées client',model.includes('listArchivedForUser'));
t('restauration modèle client',model.includes('restoreForUser')&&model.includes('client_archived_at=NULL'));
t('contrôleur charge les archives',ctl.includes('archivedTickets=await Support.listArchivedForUser'));
t('contrôleur restauration',ctl.includes('exports.restoreTicket='));
t('route restauration',route.includes('/:id/restaurer'));
t('section demandes masquées',view.includes('Demandes masquées/archivées'));
t('bouton restaurer',view.includes('class="restore-ticket"'));
t('filtres statuts',view.includes("data-filter=\"NEW\"")&&view.includes("data-filter=\"PROGRESS\"")&&view.includes("data-filter=\"RESOLVED\"")&&view.includes("data-filter=\"CLOSED\""));
t('hidden CSS robuste pour filtres/recherche',view.includes('.sd-ticket[hidden]{display:none!important}'));
t('recherche client branchée',view.includes("ticketSearch')?.addEventListener('input',applyTicketListControls"));
t('tri client branché',view.includes("ticketSort')?.addEventListener('change',applyTicketListControls"));
t('réactions aperçu liste mises à jour',view.includes('t.last_reactions')&&view.includes('t.last_reaction_count'));
console.log(`\nRÉSULTAT 18.7.2.5 : PASS=${pass} | FAIL=${fail}`);process.exitCode=fail?1:0;
