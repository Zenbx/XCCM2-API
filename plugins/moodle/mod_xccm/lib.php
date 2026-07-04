<?php
/**
 * Fonctions de l'API Moodle pour l'activité XCCM2.
 * Ces callbacks sont obligatoires pour tout module d'activité Moodle.
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Fonctionnalités supportées par le module (API Moodle).
 */
function xccm_supports($feature) {
    switch ($feature) {
        case FEATURE_MOD_INTRO:
        case FEATURE_SHOW_DESCRIPTION:
            return true;
        case FEATURE_BACKUP_MOODLE2:
            return false;
        default:
            return null;
    }
}

// ── Callbacks CRUD obligatoires ─────────────────────────────────────────────

function xccm_add_instance($data, $mform = null) {
    global $DB;
    $data->timecreated  = time();
    $data->timemodified = time();
    return $DB->insert_record('xccm', $data);
}

function xccm_update_instance($data, $mform = null) {
    global $DB;
    $data->timemodified = time();
    $data->id           = $data->instance;
    return $DB->update_record('xccm', $data);
}

function xccm_delete_instance($id) {
    global $DB;
    if (!$DB->get_record('xccm', ['id' => $id])) {
        return false;
    }
    $DB->delete_records('xccm', ['id' => $id]);
    return true;
}

// ── Informations pour le journal de cours ───────────────────────────────────

function xccm_get_coursemodule_info($coursemodule) {
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

function xccm_get_recent_mod_activity(&$activities, &$index, $timestart, $courseid, $cmid, $userid = 0, $groupid = 0) {
    // Pas d'activité récente à remonter.
}

function xccm_print_recent_mod_activity($activity, $courseid, $detail, $modnames, $viewfullnames) {
    // Pas d'affichage spécifique.
}

/**
 * Appelle POST {base_url}/api/auth/external pour obtenir un token XCCM2.
 *
 * @return string|false JWT ou false en cas d'échec
 */
function xccm_get_auth_token($baseurl, $apisecret, $user) {
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
        debugging("xccm_get_auth_token: HTTP $httpcode vers $endpoint — body: " . substr((string) $response, 0, 200), DEBUG_DEVELOPER);
        return false;
    }

    $data = json_decode($response, true);
    if (!is_array($data)) {
        return false;
    }

    // successResponse(message, data) → token dans data.token
    // ancien bug : successResponse({token}) → token dans message.token
    if (!empty($data['data']['token']) && is_string($data['data']['token'])) {
        return $data['data']['token'];
    }
    if (is_array($data['message'] ?? null) && !empty($data['message']['token'])) {
        return $data['message']['token'];
    }

    return false;
}

/**
 * Exporte un projet XCCM2 (PDF ou DOCX) via l'API.
 *
 * @param string $baseurl URL de base XCCM2
 * @param string $token JWT utilisateur
 * @param string $projectname Nom du projet
 * @param string $format pdf|docx
 * @return array{content:string, mimetype:string, extension:string}|false
 */
function xccm_export_project_binary($baseurl, $token, $projectname, $format = 'pdf') {
    $format = ($format === 'docx') ? 'docx' : 'pdf';
    $endpoint = rtrim($baseurl, '/') . '/api/projects/' . rawurlencode($projectname)
        . '/export?format=' . $format;

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Accept: application/pdf, application/octet-stream, */*',
        ],
        CURLOPT_TIMEOUT        => 120,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $body = curl_exec($ch);
    $httpcode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contenttype = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($httpcode !== 200 || $body === false || $body === '') {
        debugging("xccm_export_project_binary: HTTP $httpcode — " . substr((string) $body, 0, 200), DEBUG_DEVELOPER);
        return false;
    }

    // Réponse JSON d'erreur déguisée
    if (strpos($contenttype, 'application/json') !== false || (isset($body[0]) && $body[0] === '{')) {
        debugging('xccm_export_project_binary: réponse JSON inattendue', DEBUG_DEVELOPER);
        return false;
    }

    if ($format === 'docx') {
        return [
            'content'   => $body,
            'mimetype'  => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'extension' => 'docx',
        ];
    }

    return [
        'content'   => $body,
        'mimetype'  => 'application/pdf',
        'extension' => 'pdf',
    ];
}

/**
 * Repli : exporte la structure du projet en JSON (si le PDF échoue).
 *
 * @return array{content:string, mimetype:string, extension:string}|false
 */
function xccm_export_project_json($baseurl, $token, $projectname) {
    $endpoint = rtrim($baseurl, '/') . '/api/projects/' . rawurlencode($projectname) . '/structure';

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $body = curl_exec($ch);
    $httpcode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpcode !== 200 || !$body) {
        return false;
    }

    $data = json_decode($body, true);
    if (!is_array($data)) {
        return false;
    }

    $payload = json_encode([
        'project_name' => $projectname,
        'exported_at'  => date('c'),
        'source'       => 'moodle-mod_xccm',
        'data'         => $data['data'] ?? $data,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    if ($payload === false) {
        return false;
    }

    return [
        'content'   => $payload,
        'mimetype'  => 'application/json',
        'extension' => 'json',
    ];
}

/**
 * Enregistre un export dans la zone de fichiers Moodle de l'activité.
 *
 * @param context_module $context
 * @param int $userid
 * @param string $projectname
 * @param array $export Résultat de xccm_export_project_binary
 * @return stored_file|false
 */
function xccm_store_export_file($context, $userid, $projectname, array $export) {
    $fs = get_file_storage();
    $safeproject = preg_replace('/[^a-zA-Z0-9_\-]+/', '_', $projectname);
    $safeproject = trim($safeproject, '_') ?: 'cours';
    $filename = $safeproject . '_' . date('Ymd_His') . '.' . $export['extension'];

    $record = [
        'contextid' => $context->id,
        'component' => 'mod_xccm',
        'filearea'  => 'exports',
        'itemid'    => $userid,
        'filepath'  => '/',
        'filename'  => $filename,
        'userid'    => $userid,
    ];

    return $fs->create_file_from_string($record, $export['content']);
}

/**
 * Liste les exports Moodle d'un utilisateur pour une activité.
 *
 * @param context_module $context
 * @param int $userid
 * @return stored_file[]
 */
function xccm_list_user_exports($context, $userid) {
    $fs = get_file_storage();
    $files = $fs->get_area_files($context->id, 'mod_xccm', 'exports', $userid, 'timemodified DESC', false);
    return array_values($files);
}

/**
 * Sert les fichiers stockés par le plugin (téléchargement).
 */
function xccm_pluginfile($course, $cm, $context, $filearea, $args, $forcedownload, array $options = []) {
    global $USER;

    if ($context->contextlevel != CONTEXT_MODULE) {
        return false;
    }
    if ($filearea !== 'exports') {
        return false;
    }

    require_login($course, true, $cm);
    require_capability('mod/xccm:view', $context);

    $itemid = (int) array_shift($args);
    $filename = array_pop($args);
    $filepath = $args ? '/' . implode('/', $args) . '/' : '/';

    // Chacun télécharge ses propres copies (enseignants : aussi les leurs).
    if ($itemid !== (int) $USER->id) {
        return false;
    }

    $fs = get_file_storage();
    $file = $fs->get_file($context->id, 'mod_xccm', 'exports', $itemid, $filepath, $filename);
    if (!$file || $file->is_directory()) {
        return false;
    }

    send_stored_file($file, 0, 0, $forcedownload, $options);
}
