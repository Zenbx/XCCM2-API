<?php
/**
 * Vue principale de l'activité XCCM2.
 *
 * Flux :
 *  1. Moodle vérifie les droits de l'étudiant
 *  2. Le plugin appelle POST /api/auth/external sur XCCM2 pour obtenir un JWT
 *  3. L'éditeur XCCM2 est intégré dans un <iframe> avec le JWT et le nom de projet
 */

require_once('../../config.php');
require_once('lib.php');

// ── Paramètres Moodle ────────────────────────────────────────────────────────
$id = optional_param('id', 0, PARAM_INT);  // ID du module de cours

if ($id) {
    $cm     = get_coursemodule_from_id('xccm', $id, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
    $xccm   = $DB->get_record('xccm', ['id' => $cm->instance], '*', MUST_EXIST);
} else {
    throw new moodle_exception('missingparam', '', '', 'id');
}

// ── Vérification de l'accès ──────────────────────────────────────────────────
require_login($course, true, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/xccm:view', $context);

// ── Journalisation ───────────────────────────────────────────────────────────
$event = \mod_xccm\event\course_module_viewed::create([
    'objectid' => $xccm->id,
    'context'  => $context,
]);
$event->add_record_snapshot('course_modules', $cm);
$event->add_record_snapshot('course', $course);
$event->add_record_snapshot('xccm', $xccm);
$event->trigger();
completion_info::set_module_viewed($course, $cm);

// ── Configuration globale du plugin ─────────────────────────────────────────
$base_url  = get_config('mod_xccm', 'base_url');
$api_secret = get_config('mod_xccm', 'api_secret');

if (empty($base_url)) {
    throw new moodle_exception('error_no_baseurl', 'mod_xccm');
}
if (empty($api_secret)) {
    throw new moodle_exception('error_no_secret', 'mod_xccm');
}

// ── Résolution du nom de projet ──────────────────────────────────────────────
// En mode individuel, {user_id} est remplacé par l'ID Moodle de l'étudiant.
$project_name = $xccm->project_name;
if ($xccm->mode === 'individual') {
    $project_name = str_replace('{user_id}', $USER->id, $project_name);
}

// ── Obtention du JWT XCCM2 via l'API externe ─────────────────────────────────
$token = xccm_get_auth_token($base_url, $api_secret, $USER);
if (!$token) {
    throw new moodle_exception('error_auth_failed', 'mod_xccm');
}

// ── URL de l'iframe ──────────────────────────────────────────────────────────
$embed_url = rtrim($base_url, '/') . '/embed/editor'
    . '?projectName=' . urlencode($project_name)
    . '&token='       . urlencode($token);

// ── Rendu Moodle ─────────────────────────────────────────────────────────────
$PAGE->set_url('/mod/xccm/view.php', ['id' => $cm->id]);
$PAGE->set_title(format_string($xccm->name));
$PAGE->set_heading(format_string($course->fullname));

echo $OUTPUT->header();
echo $OUTPUT->heading(format_string($xccm->name));

if (!empty($xccm->intro)) {
    echo $OUTPUT->box(format_module_intro('xccm', $xccm, $cm->id), 'generalbox mod_introbox');
}

$height = max(200, (int) $xccm->editor_height);

echo html_writer::tag('div',
    html_writer::tag('iframe', '', [
        'src'             => $embed_url,
        'width'           => '100%',
        'height'          => $height . 'px',
        'frameborder'     => '0',
        'style'           => 'border:none; border-radius:8px; display:block;',
        'allow'           => 'clipboard-read; clipboard-write',
        'allowfullscreen' => 'true',
        'title'           => s($xccm->name),
    ]),
    ['class' => 'xccm-editor-wrapper', 'style' => 'width:100%; overflow:hidden;']
);

echo $OUTPUT->footer();
