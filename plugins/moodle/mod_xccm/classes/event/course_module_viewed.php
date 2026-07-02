<?php
namespace mod_xccm\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Déclenché lorsqu'un utilisateur ouvre une activité XCCM2.
 */
class course_module_viewed extends \core\event\course_module_viewed {

    protected function init() {
        $this->data['crud'] = 'r';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
        $this->data['objecttable'] = 'xccm';
    }

    public static function get_objectid_mapping() {
        return ['db' => 'xccm', 'restore' => 'xccm'];
    }
}
