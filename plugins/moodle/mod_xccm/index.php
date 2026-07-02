<?php
/**
 * Liste toutes les instances de l'activité XCCM2 dans un cours.
 * Page standard exigée par Moodle pour tout module d'activité.
 */

require_once('../../config.php');
require_once('lib.php');

$id = required_param('id', PARAM_INT); // ID du cours

$course = $DB->get_record('course', ['id' => $id], '*', MUST_EXIST);

require_course_login($course);

$PAGE->set_url('/mod/xccm/index.php', ['id' => $id]);
$PAGE->set_title(format_string($course->fullname));
$PAGE->set_heading(format_string($course->fullname));

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('modulenameplural', 'mod_xccm'));

$xccms = get_all_instances_in_course('xccm', $course);
if (!$xccms) {
    notice(get_string('nonewmodules', 'mod_xccm'), new moodle_url('/course/view.php', ['id' => $course->id]));
}

$table = new html_table();
$table->head = [get_string('name'), get_string('mode', 'mod_xccm')];

foreach ($xccms as $xccm) {
    $link = html_writer::link(
        new moodle_url('/mod/xccm/view.php', ['id' => $xccm->coursemodule]),
        format_string($xccm->name)
    );
    $table->data[] = [$link, get_string('mode_' . $xccm->mode, 'mod_xccm')];
}

echo html_writer::table($table);
echo $OUTPUT->footer();
