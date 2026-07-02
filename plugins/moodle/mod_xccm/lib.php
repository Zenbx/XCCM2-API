<?php
/**
 * Fonctions de l'API Moodle pour l'activité XCCM2.
 * Ces callbacks sont obligatoires pour tout module d'activité Moodle.
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Fonctionnalités supportées par le module (API Moodle).
 */
function xccm_supports(string $feature) {
    switch ($feature) {
        case FEATURE_MOD_INTRO:
        case FEATURE_SHOW_DESCRIPTION:
        case FEATURE_BACKUP_MOODLE2:
            return true;
        default:
            return null;
    }
}

// ── Callbacks CRUD obligatoires ─────────────────────────────────────────────

function xccm_add_instance(stdClass $data, ?mod_xccm_mod_form $mform = null): int {
    global $DB;
    $data->timecreated  = time();
    $data->timemodified = time();
    return $DB->insert_record('xccm', $data);
}

function xccm_update_instance(stdClass $data, ?mod_xccm_mod_form $mform = null): bool {
    global $DB;
    $data->timemodified = time();
    $data->id           = $data->instance;
    return $DB->update_record('xccm', $data);
}

function xccm_delete_instance(int $id): bool {
    global $DB;
    if (!$DB->get_record('xccm', ['id' => $id])) {
        return false;
    }
    $DB->delete_records('xccm', ['id' => $id]);
    return true;
}

// ── Informations pour le journal de cours ───────────────────────────────────

function xccm_get_coursemodule_info(stdClass $coursemodule): cached_cm_info {
    global $DB;
    $info = new cached_cm_info();
    $record = $DB->get_record('xccm', ['id' => $coursemodule->instance], 'id, name, intro, introformat');
    if ($record) {
        $info->name = $record->name;
        if ($coursemodule->showdescription) {
            $info->content = format_module_intro('xccm', $record, $coursemodule->id, false);
        }
    }
    return $info;
}

// ── Support de la recherche dans les cours ─────────────────────────────────

function xccm_get_recent_mod_activity(array &$activities, int &$index, int $timestart,
                                      int $courseid, int $cmid, int $userid = 0,
                                      int $groupid = 0): void {
    // Pas d'activité récente à remonter (lecture seule dans le journal)
}

    // Pas d'affichage spécifique
}

/**
 * Appelle POST {base_url}/api/auth/external pour obtenir un token XCCM2.
 *
 * @return string|false JWT ou false en cas d'échec
 */
function xccm_get_auth_token(string $baseurl, string $apisecret, stdClass $user): string|false {
    $endpoint = rtrim($baseurl, '/') . '/api/auth/external';

    $payload = json_encode([
        'api_secret'  => $apisecret,
        'email'       => $user->email,
        'firstname'   => $user->firstname,
        'lastname'    => $user->lastname,
        'source'      => 'moodle',
        'external_id' => (string) $user->id,
    ]);

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response = curl_exec($ch);
    $httpcode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpcode !== 200 || !$response) {
        debugging("xccm_get_auth_token: HTTP $httpcode vers $endpoint", DEBUG_DEVELOPER);
        return false;
    }

    $data = json_decode($response, true);
    return $data['data']['token'] ?? false;
}
