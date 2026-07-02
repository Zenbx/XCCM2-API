<?php
/**
 * Formulaire de configuration de l'activité XCCM2 (vu par l'enseignant).
 */

defined('MOODLE_INTERNAL') || die();
require_once($CFG->dirroot . '/course/moodleform_mod.php');

class mod_xccm_mod_form extends moodleform_mod {

    public function definition(): void {
        $mform = $this->_form;

        // ── Informations générales ─────────────────────────────────────────
        $mform->addElement('header', 'general', get_string('general', 'form'));

        $mform->addElement('text', 'name', get_string('name'), ['size' => 64]);
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');

        $this->standard_intro_elements();

        // ── Paramètres XCCM2 ──────────────────────────────────────────────
        $mform->addElement('header', 'xccm_settings', get_string('pluginadministration', 'mod_xccm'));

        // Nom du projet
        $mform->addElement('text', 'project_name', get_string('project_name', 'mod_xccm'), ['size' => 64]);
        $mform->setType('project_name', PARAM_TEXT);
        $mform->addHelpButton('project_name', 'project_name', 'mod_xccm');
        $mform->addRule('project_name', null, 'required', null, 'client');

        // Mode de collaboration
        $modes = [
            'individual'    => get_string('mode_individual',    'mod_xccm'),
            'collaborative' => get_string('mode_collaborative', 'mod_xccm'),
        ];
        $mform->addElement('select', 'mode', get_string('mode', 'mod_xccm'), $modes);
        $mform->setDefault('mode', 'individual');

        // Hauteur de l'iframe
        $mform->addElement('text', 'editor_height', get_string('editor_height', 'mod_xccm'), ['size' => 6]);
        $mform->setType('editor_height', PARAM_INT);
        $mform->setDefault('editor_height', 700);

        // ── Paramètres standards Moodle ───────────────────────────────────
        $this->standard_coursemodule_elements();
        $this->add_action_buttons();
    }

    public function validation(array $data, array $files): array {
        $errors = parent::validation($data, $files);

        if (empty($data['project_name'])) {
            $errors['project_name'] = get_string('required');
        }
        if (!is_numeric($data['editor_height']) || $data['editor_height'] < 200) {
            $errors['editor_height'] = get_string('required');
        }

        return $errors;
    }
}
