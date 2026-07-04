<?php
$string['modulename']       = 'Éditeur de contenu XCCM2';
$string['modulenameplural'] = 'Éditeurs de contenu XCCM2';
$string['pluginname']       = 'Éditeur de contenu XCCM2';

$string['xccm:addinstance'] = 'Ajouter une activité XCCM2';
$string['xccm:view']        = 'Voir l\'activité XCCM2';

$string['project_name']        = 'Nom du projet';
$string['project_name_help']   = 'Nom du projet XCCM2 à ouvrir. En mode individuel, utilisez {user_id} pour créer un projet par étudiant (ex : "rapport_{user_id}").';
$string['mode']                = 'Mode de collaboration';
$string['mode_individual']     = 'Individuel (un projet par étudiant)';
$string['mode_collaborative']  = 'Collaboratif (projet partagé)';
$string['editor_height']       = 'Hauteur de l\'éditeur (px)';

$string['pluginadministration'] = 'Administration XCCM2';
$string['xccm_base_url']        = 'URL de base XCCM2';
$string['xccm_base_url_desc']   = 'URL publique du frontend XCCM2 (iframe + API proxy), ex : https://xccm-2.vercel.app';
$string['xccm_base_url_rewrite_hint'] = 'Le frontend doit proxyfier /api/* vers l\'API XCCM2 (rewrites Next.js).';
$string['nonewmodules']         = 'Aucune activité XCCM2 dans ce cours';
$string['xccm_api_secret']      = 'Secret API';
$string['xccm_api_secret_desc'] = 'Secret partagé entre Moodle et XCCM2 (doit correspondre à PLUGIN_API_SECRET dans le .env de XCCM2).';

$string['error_no_baseurl']  = 'L\'URL de base XCCM2 n\'est pas configurée. Contactez votre administrateur.';
$string['error_no_secret']   = 'Le secret API XCCM2 n\'est pas configuré. Contactez votre administrateur.';
$string['error_auth_failed'] = 'Impossible de s\'authentifier auprès de XCCM2. Réessayez ou contactez votre administrateur.';
$string['error_no_project']  = 'Aucun nom de projet n\'est configuré pour cette activité.';
$string['error_export_failed'] = 'Impossible de générer le fichier du cours. Vérifiez que le projet contient du contenu, puis réessayez.';
$string['error_store_failed']  = 'Le fichier a été généré mais n\'a pas pu être enregistré dans Moodle.';

$string['exports_title']   = 'Copies enregistrées dans Moodle';
$string['exports_intro']   = 'Enregistrez une copie PDF de votre cours ici pour la retrouver et la télécharger depuis Moodle, même hors de l\'éditeur.';
$string['exports_empty']   = 'Aucune copie enregistrée pour le moment.';
$string['save_to_moodle']  = 'Enregistrer une copie dans Moodle (PDF)';
$string['export_saving']   = 'Génération et enregistrement en cours…';
$string['export_saved']    = 'Copie enregistrée dans Moodle. Vous pouvez la télécharger ci-dessous.';
