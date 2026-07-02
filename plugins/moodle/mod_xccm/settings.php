<?php
/**
 * Paramètres globaux du plugin XCCM2 (Administration > Plugins > Activités > XCCM2).
 * L'administrateur Moodle configure ici l'URL de l'instance et le secret API.
 */

defined('MOODLE_INTERNAL') || die();

if ($ADMIN->fulltree) {

    // URL de base de l'instance XCCM2
    $settings->add(new admin_setting_configtext(
        'mod_xccm/base_url',
        get_string('xccm_base_url',      'mod_xccm'),
        get_string('xccm_base_url_desc', 'mod_xccm') . ' ' .
            get_string('xccm_base_url_rewrite_hint', 'mod_xccm'),
        'https://xccm-2.vercel.app',
        PARAM_URL
    ));

    // Secret API partagé (même valeur que PLUGIN_API_SECRET dans le .env XCCM2)
    $settings->add(new admin_setting_configpasswordunmask(
        'mod_xccm/api_secret',
        get_string('xccm_api_secret',      'mod_xccm'),
        get_string('xccm_api_secret_desc', 'mod_xccm'),
        ''
    ));
}
