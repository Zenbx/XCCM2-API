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

$completion = new completion_info($course);
$completion->set_module_viewed($cm);

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

// Hauteur confortable pour TOC + éditeur + RightPanel (défaut activité souvent trop bas).
$height = max(900, (int) $xccm->editor_height);

echo html_writer::tag('style', '
.xccm-editor-wrapper {
  width: 100%;
  max-width: none;
  margin: 0;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,.08);
}
.xccm-editor-wrapper iframe {
  display: block;
  width: 100% !important;
  min-width: 100%;
  border: 0;
  background: #fff;
}
/* Élargir dans les thèmes Moodle à colonne étroite */
.path-mod-xccm #region-main,
.path-mod-xccm .region-main,
.path-mod-xccm [role="main"] {
  max-width: none !important;
  width: 100% !important;
}
');

echo html_writer::tag('div',
    html_writer::tag('iframe', '', [
        'src'             => $embed_url,
        'width'           => '100%',
        'height'          => $height,
        'frameborder'     => '0',
        'style'           => 'border:none; border-radius:8px; display:block; width:100%; height:'
            . $height . 'px; min-height:85vh;',
        'allow'           => 'clipboard-read; clipboard-write',
        'allowfullscreen' => 'true',
        'title'           => s($xccm->name),
        'id'              => 'xccm-editor-iframe',
    ]),
    ['class' => 'xccm-editor-wrapper']
);

// ── Copies enregistrées dans Moodle (PDF téléchargeables) ───────────────────
$exports = xccm_list_user_exports($context, $USER->id);
$saveurl = new moodle_url('/mod/xccm/save_export.php', ['id' => $cm->id, 'sesskey' => sesskey()]);

echo html_writer::start_div('xccm-exports-panel', ['id' => 'xccm-exports-panel']);
echo html_writer::tag('h3', get_string('exports_title', 'mod_xccm'));
echo html_writer::tag('p', get_string('exports_intro', 'mod_xccm'), ['class' => 'xccm-exports-intro']);

echo html_writer::start_div('xccm-exports-actions');
echo html_writer::tag('button', get_string('save_to_moodle', 'mod_xccm'), [
    'type'  => 'button',
    'id'    => 'xccm-save-export-btn',
    'class' => 'btn btn-primary',
]);
echo html_writer::span('', 'xccm-exports-status', ['id' => 'xccm-exports-status']);
echo html_writer::end_div();

echo html_writer::start_tag('ul', ['id' => 'xccm-exports-list', 'class' => 'xccm-exports-list']);
if (empty($exports)) {
    echo html_writer::tag('li', get_string('exports_empty', 'mod_xccm'), [
        'id'    => 'xccm-exports-empty',
        'class' => 'xccm-exports-empty',
    ]);
} else {
    foreach ($exports as $file) {
        $url = moodle_url::make_pluginfile_url(
            $file->get_contextid(),
            $file->get_component(),
            $file->get_filearea(),
            $file->get_itemid(),
            $file->get_filepath(),
            $file->get_filename(),
            true
        );
        $label = s($file->get_filename()) . ' — ' . userdate($file->get_timecreated());
        echo html_writer::tag('li',
            html_writer::link($url, $label, ['class' => 'xccm-export-link'])
        );
    }
}
echo html_writer::end_tag('ul');
echo html_writer::end_div();

echo html_writer::tag('style', '
.xccm-exports-panel {
  margin-top: 1.5rem;
  padding: 1.25rem 1.5rem;
  background: #f8f9fa;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.xccm-exports-panel h3 { margin-top: 0; }
.xccm-exports-intro { color: #4b5563; margin-bottom: 1rem; }
.xccm-exports-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
.xccm-exports-status { font-size: 0.9rem; color: #374151; }
.xccm-exports-status.is-error { color: #b91c1c; }
.xccm-exports-status.is-ok { color: #047857; }
.xccm-exports-list { list-style: none; padding: 0; margin: 0; }
.xccm-exports-list li { padding: 0.5rem 0; border-top: 1px solid #e5e7eb; }
.xccm-exports-list li:first-child { border-top: 0; }
.xccm-export-link { font-weight: 600; }
.xccm-exports-empty { color: #6b7280; font-style: italic; }
');

$jsstrings = json_encode([
    'saving'  => get_string('export_saving', 'mod_xccm'),
    'saved'   => get_string('export_saved', 'mod_xccm'),
    'failed'  => get_string('error_export_failed', 'mod_xccm'),
    'empty'   => get_string('exports_empty', 'mod_xccm'),
], JSON_UNESCAPED_UNICODE);

echo html_writer::script('
(function () {
  var saveUrl = ' . json_encode($saveurl->out(false)) . ';
  var strings = ' . $jsstrings . ';
  var btn = document.getElementById("xccm-save-export-btn");
  var statusEl = document.getElementById("xccm-exports-status");
  var listEl = document.getElementById("xccm-exports-list");
  var busy = false;
  var lastAutoSave = 0;

  function setStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.className = "xccm-exports-status" + (kind ? " is-" + kind : "");
  }

  function prependExport(item) {
    if (!listEl) return;
    var empty = document.getElementById("xccm-exports-empty");
    if (empty) empty.remove();
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = item.downloadurl;
    a.className = "xccm-export-link";
    a.textContent = item.filename + " — " + new Date(item.timecreated * 1000).toLocaleString();
    li.appendChild(a);
    listEl.insertBefore(li, listEl.firstChild);
  }

  function saveToMoodle(fromAuto) {
    if (busy) return;
    busy = true;
    if (btn) btn.disabled = true;
    setStatus(strings.saving, "");

    fetch(saveUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.success) {
          setStatus((data && data.error) || strings.failed, "error");
          return;
        }
        setStatus(data.message || strings.saved, "ok");
        prependExport(data);
      })
      .catch(function () {
        setStatus(strings.failed, "error");
      })
      .finally(function () {
        busy = false;
        if (btn) btn.disabled = false;
      });
  }

  if (btn) {
    btn.addEventListener("click", function () { saveToMoodle(false); });
  }

  // Après un Enregistrer dans l\'éditeur XCCM : copie PDF dans Moodle (max 1 / 60 s).
  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "XCCM_CONTENT_SAVED") return;
    var now = Date.now();
    if (now - lastAutoSave < 60000) return;
    lastAutoSave = now;
    saveToMoodle(true);
  });
})();
');

echo $OUTPUT->footer();
