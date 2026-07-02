<?php
$string['modulename']       = 'XCCM2 Content Editor';
$string['modulenameplural'] = 'XCCM2 Content Editors';
$string['pluginname']       = 'XCCM2 Content Editor';

$string['xccm:addinstance'] = 'Add a new XCCM2 activity';
$string['xccm:view']        = 'View XCCM2 activity';

$string['project_name']        = 'Project name';
$string['project_name_help']   = 'Name of the XCCM2 project to open. In individual mode, use {user_id} as a placeholder to create a separate project per student (e.g. "report_{user_id}").';
$string['mode']                = 'Collaboration mode';
$string['mode_individual']     = 'Individual (one project per student)';
$string['mode_collaborative']  = 'Collaborative (shared project)';
$string['editor_height']       = 'Editor height (px)';

$string['pluginadministration'] = 'XCCM2 administration';
$string['xccm_base_url']        = 'XCCM2 base URL';
$string['xccm_base_url_desc']   = 'Public URL of the XCCM2 frontend (embed + proxied API), e.g. https://xccm-2.vercel.app';
$string['xccm_base_url_rewrite_hint'] = 'The frontend must proxy /api/* to the XCCM2 API (Next.js rewrites).';
$string['nonewmodules']         = 'No XCCM2 activities in this course';
$string['xccm_api_secret']      = 'API secret';
$string['xccm_api_secret_desc'] = 'Shared secret between Moodle and XCCM2 (must match PLUGIN_API_SECRET in the XCCM2 .env).';

$string['error_no_baseurl']  = 'XCCM2 base URL is not configured. Contact your administrator.';
$string['error_no_secret']   = 'XCCM2 API secret is not configured. Contact your administrator.';
$string['error_auth_failed'] = 'Could not authenticate with XCCM2. Please try again or contact your administrator.';
