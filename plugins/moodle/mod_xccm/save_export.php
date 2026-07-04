<?php
/**
 * Enregistre une copie du cours XCCM2 dans Moodle (PDF) et renvoie le lien de téléchargement.
 */

define('AJAX_SCRIPT', true);

require_once('../../config.php');
require_once('lib.php');

$id = required_param('id', PARAM_INT);
$format = optional_param('format', 'pdf', PARAM_ALPHA);

require_sesskey();

$cm = get_coursemodule_from_id('xccm', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$xccm = $DB->get_record('xccm', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, true, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/xccm:view', $context);

$baseurl = get_config('mod_xccm', 'base_url');
$apisecret = get_config('mod_xccm', 'api_secret');

if (empty($baseurl) || empty($apisecret)) {
    echo json_encode(['success' => false, 'error' => get_string('error_no_baseurl', 'mod_xccm')]);
    die;
}

$projectname = $xccm->project_name;
if ($xccm->mode === 'individual') {
    $projectname = str_replace('{user_id}', $USER->id, $projectname);
}

if (trim($projectname) === '') {
    echo json_encode(['success' => false, 'error' => get_string('error_no_project', 'mod_xccm')]);
    die;
}

$token = xccm_get_auth_token($baseurl, $apisecret, $USER);
if (!$token) {
    echo json_encode(['success' => false, 'error' => get_string('error_auth_failed', 'mod_xccm')]);
    die;
}

// PDF de préférence ; JSON de secours si la génération document échoue.
$export = xccm_export_project_binary($baseurl, $token, $projectname, $format);
if (!$export) {
    $export = xccm_export_project_json($baseurl, $token, $projectname);
}
if (!$export) {
    echo json_encode(['success' => false, 'error' => get_string('error_export_failed', 'mod_xccm')]);
    die;
}

$file = xccm_store_export_file($context, $USER->id, $projectname, $export);
if (!$file) {
    echo json_encode(['success' => false, 'error' => get_string('error_store_failed', 'mod_xccm')]);
    die;
}

$downloadurl = moodle_url::make_pluginfile_url(
    $file->get_contextid(),
    $file->get_component(),
    $file->get_filearea(),
    $file->get_itemid(),
    $file->get_filepath(),
    $file->get_filename(),
    true
)->out(false);

echo json_encode([
    'success'     => true,
    'filename'    => $file->get_filename(),
    'filesize'    => $file->get_filesize(),
    'timecreated' => $file->get_timecreated(),
    'downloadurl' => $downloadurl,
    'message'     => get_string('export_saved', 'mod_xccm'),
]);
