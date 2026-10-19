#!/usr/bin/env node
'use strict';

// Drive the same REST call the Azure DevOps "Verify connection" button makes
// on a service endpoint, so CI catches regressions in that flow even though
// no pipeline task ever exercises it.
//
// Two checks run:
//   1. POSITIVE - the existing, correctly-configured jfrog-sanity-connection
//      must report success. This is the regression guard for the actual fix.
//      Retried a few times: a freshly-updated extension's TestConnection
//      dataSource can take a little longer to take effect in the org than
//      the Marketplace version check (run before this script) confirms.
//   2. NEGATIVE - a throwaway connection (same type/url, deliberately bad
//      token) must report failure. This proves the test itself can actually
//      detect a broken connection — not just that today's config happens to
//      work — so a future API change that silently breaks failure-detection
//      (e.g. the dataSource starts reporting success/200 no matter what)
//      would also be caught.
//
// Before the negative check creates its throwaway endpoint, any orphans left
// by a previous run that was killed before its cleanup ran (job timeout, a
// newer run cancelling this one) are swept and deleted first.
//
// Required environment variables:
//   ADO_ORG      - Azure DevOps organization name (e.g. vigneshc0742)
//   ADO_PROJECT  - Azure DevOps project name      (e.g. ecomatrix-test)
//   ADO_PAT      - PAT with Service Connections (Read, query, & manage) scope
//                  (the negative check creates + deletes a throwaway endpoint)
//
// Optional environment variables:
//   CONNECTION_NAME - Name of an existing, working service endpoint to test
//                      (default: jfrog-sanity-connection, a JFrog Platform
//                      connection already configured for the sanity pipeline)
//   ADO_BASE_URL    - Override https://dev.azure.com (for local testing only)
//   POSITIVE_RETRY_WAIT_SECONDS - Override the 30s wait between positive-check
//                      retries (for local testing only)

const REQUEST_TIMEOUT_MS = 30 * 1000;
const POSITIVE_RETRY_ATTEMPTS = 3;
const POSITIVE_RETRY_WAIT_SECONDS = Number(process.env.POSITIVE_RETRY_WAIT_SECONDS ?? 30);
// statusCode ADO's TestConnection returns for a healthy connection. Asserted
// explicitly: "anything but badRequest" would also pass on an empty value
// (unparseable body, or ADO renaming the field).
const EXPECTED_SUCCESS_STATUS_CODE = 'ok';
const BAD_TOKEN = 'invalid-token-for-e2e-negative-test';
const BODY_PREVIEW_CHARS = 2000;

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        console.error(`${name} is required`);
        process.exit(1);
    }
    return value;
}

const ADO_ORG = requireEnv('ADO_ORG');
const ADO_PROJECT = requireEnv('ADO_PROJECT');
const ADO_PAT = requireEnv('ADO_PAT');
const CONNECTION_NAME = process.env.CONNECTION_NAME || 'jfrog-sanity-connection';

// GITHUB_RUN_ID is unique per workflow run across the whole repo (unlike the
// PID, which GitHub's minimal runner containers can hand out identically to
// two jobs started around the same time); GITHUB_RUN_ATTEMPT distinguishes
// re-runs of the same run. The PID is only a last-resort local-run fallback,
// never relied on alone for uniqueness in CI.
const BAD_PREFIX = `${CONNECTION_NAME}-badcreds-e2e-`;
const BAD_NAME = `${BAD_PREFIX}${process.env.GITHUB_RUN_ID || 'local'}-${process.env.GITHUB_RUN_ATTEMPT || 0}-${process.pid}`;

const API_BASE = `${process.env.ADO_BASE_URL || 'https://dev.azure.com'}/${encodeURIComponent(ADO_ORG)}/${encodeURIComponent(ADO_PROJECT)}/_apis`;
// ADO REST API uses Basic auth with an empty username and PAT as password.
const AUTH_HEADER = `Basic ${Buffer.from(`:${ADO_PAT}`).toString('base64')}`;

let badEndpointId = '';
let badEndpointProjectId = '';

class CheckFailed extends Error {}

// Performs an ADO REST call. Never throws on HTTP errors or network failure:
// a network failure/timeout is reported as status 0 so callers can treat it
// the same way as any other non-200 response. json is null if the body isn't
// valid JSON — e.g. an HTML error/maintenance page during a transient ADO
// outage.
async function adoRequest(method, path, body) {
    let status = 0;
    let text = '';
    try {
        const response = await fetch(`${API_BASE}${path}`, {
            method,
            headers: {
                Authorization: AUTH_HEADER,
                Accept: 'application/json',
                ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        status = response.status;
        text = await response.text();
    } catch (err) {
        text = String(err && err.message ? err.message : err);
    }
    let json = null;
    try {
        json = JSON.parse(text);
    } catch {
        // Not JSON; callers fall back to the raw text.
    }
    return { status, text, json };
}

function preview(text) {
    return text.slice(0, BODY_PREVIEW_CHARS);
}

function sleep(seconds) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// Deletes service endpoint `endpointId` (scoped to badEndpointProjectId), used
// by both the cleanup and the orphan sweep below. Returns true on success.
async function deleteEndpoint(endpointId) {
    const { status } = await adoRequest('DELETE', `/serviceendpoint/endpoints/${endpointId}?projectIds=${badEndpointProjectId}&api-version=7.1`);
    return status >= 200 && status < 300;
}

async function cleanup() {
    if (!badEndpointId) {
        return;
    }
    const id = badEndpointId;
    badEndpointId = '';
    console.log(`Cleaning up throwaway endpoint ${id}...`);
    if (!(await deleteEndpoint(id))) {
        console.log(`  WARNING: cleanup delete failed — remove '${id}' manually.`);
    }
}

// Calls endpointproxy TestConnection for an endpoint id. statusCode is ''
// if the body wasn't valid JSON or had no statusCode field.
async function callTestConnection(endpointId) {
    const response = await adoRequest('POST', `/serviceendpoint/endpointproxy?endpointId=${endpointId}&api-version=7.2-preview.1`, {
        dataSourceDetails: { dataSourceName: 'TestConnection', parameters: null },
    });
    console.log(`Response (HTTP ${response.status}):`);
    console.log(preview(response.text));
    console.log('');
    const statusCode = response.json && typeof response.json.statusCode === 'string' ? response.json.statusCode : '';
    return { ...response, statusCode };
}

function isTestConnectionSuccess(result) {
    return result.status === 200 && result.statusCode === EXPECTED_SUCCESS_STATUS_CODE;
}

function lookupFailureHint(status) {
    switch (status) {
        case 0:
            return `  Hint: network/DNS failure — ADO_ORG '${ADO_ORG}' may be wrong (used in URL host).`;
        case 401:
            return '  Hint: PAT is invalid, expired, or for a different organization. Regenerate ADO_E2E_PAT.';
        case 403:
            return '  Hint: PAT lacks scopes. Required: Service Connections (Read, query, & manage).';
        case 404:
            return `  Hint: Project '${ADO_PROJECT}' not found in org '${ADO_ORG}'.`;
        default:
            return '  Hint: see the response body above for the ADO error message.';
    }
}

function banner(...lines) {
    console.log('==============================================');
    lines.forEach((line) => console.log(line));
    console.log('==============================================');
}

async function positiveCheck() {
    banner(`  1. Positive check: ${CONNECTION_NAME}`, `  Org:        ${ADO_ORG}`, `  Project:    ${ADO_PROJECT}`);

    // Look up the good endpoint by name
    const lookup = await adoRequest('GET', `/serviceendpoint/endpoints?endpointNames=${encodeURIComponent(CONNECTION_NAME)}&api-version=7.1`);
    if (lookup.status !== 200) {
        console.error(`ERROR: Failed to look up service connection '${CONNECTION_NAME}'.`);
        console.error(`  HTTP status : ${lookup.status}`);
        console.error('  Response    :');
        console.error(preview(lookup.text));
        console.error('');
        console.error(lookupFailureHint(lookup.status));
        throw new CheckFailed('lookup failed');
    }

    const endpoint = lookup.json && Array.isArray(lookup.json.value) ? lookup.json.value[0] : undefined;
    if (!endpoint || !endpoint.id) {
        console.error(`ERROR: No service connection named '${CONNECTION_NAME}' found in project '${ADO_PROJECT}'.`);
        console.error('  Has the one-time setup (see .pipelines/ado-sanity-pipeline.yml) been done in this org?');
        throw new CheckFailed('endpoint not found');
    }

    // Narrow the throwaway endpoint's scope to just ADO_PROJECT, even if the
    // good connection happens to be shared with other projects too — the
    // throwaway endpoint should never need (or be granted) a wider blast radius.
    const projectRef = (endpoint.serviceEndpointProjectReferences || []).find(
        (ref) => ref.projectReference && ref.projectReference.name === ADO_PROJECT,
    );
    if (!projectRef) {
        console.error(`ERROR: '${CONNECTION_NAME}' has no project reference matching '${ADO_PROJECT}'.`);
        throw new CheckFailed('no project reference');
    }
    badEndpointProjectId = projectRef.projectReference.id;

    console.log(`Found endpoint id: ${endpoint.id} (type: ${endpoint.type})`);
    console.log('');

    // A freshly-updated extension's service-endpoint-type contribution can
    // take a little longer to take effect in the org than the Marketplace
    // version check already performed by the caller — retry before
    // concluding this is a real regression.
    for (let attempt = 1; ; attempt++) {
        const result = await callTestConnection(endpoint.id);
        if (isTestConnectionSuccess(result)) {
            break;
        }
        if (attempt >= POSITIVE_RETRY_ATTEMPTS) {
            const errorMessage = (result.json && result.json.errorMessage) || 'unknown error';
            banner(`  Verify connection FAILED for '${CONNECTION_NAME}' (expected success) after ${attempt} attempts.`, `  Error: ${errorMessage}`);
            throw new CheckFailed('positive check failed');
        }
        console.log(
            `Attempt ${attempt}/${POSITIVE_RETRY_ATTEMPTS} failed — retrying in ${POSITIVE_RETRY_WAIT_SECONDS}s in case the extension is still propagating...`,
        );
        await sleep(POSITIVE_RETRY_WAIT_SECONDS);
    }

    console.log(`Verify connection SUCCEEDED for '${CONNECTION_NAME}', as expected.`);
    console.log('');
    return { endpoint, projectRef };
}

// Delete any orphaned throwaway endpoints left by a previous run whose
// cleanup didn't get to run (SIGKILL on timeout/cancellation).
async function sweepOrphans() {
    console.log(`Sweeping for orphaned throwaway endpoints (prefix '${BAD_PREFIX}')...`);
    const list = await adoRequest('GET', '/serviceendpoint/endpoints?api-version=7.1');
    if (list.status !== 200 || !list.json || !Array.isArray(list.json.value)) {
        console.log(`  WARNING: sweep lookup failed (HTTP ${list.status}) — continuing without it.`);
        console.log('');
        return;
    }
    const orphans = list.json.value.filter((e) => typeof e.name === 'string' && e.name.startsWith(BAD_PREFIX));
    if (orphans.length === 0) {
        console.log('  None found.');
    }
    for (const orphan of orphans) {
        console.log(`  Deleting orphan '${orphan.name}' (${orphan.id})...`);
        if (!(await deleteEndpoint(orphan.id))) {
            console.log(`    WARNING: failed to delete orphan '${orphan.name}'.`);
        }
    }
    console.log('');
}

// Throwaway connection, same type/url, bad token. Proves the pass/fail
// detection itself still works.
async function negativeCheck({ endpoint, projectRef }) {
    banner(`  2. Negative check: ${BAD_NAME}`);

    const created = await adoRequest('POST', '/serviceendpoint/endpoints?api-version=7.1', {
        name: BAD_NAME,
        type: endpoint.type,
        url: endpoint.url,
        authorization: { scheme: 'Token', parameters: { apitoken: BAD_TOKEN } },
        isShared: false,
        isReady: true,
        owner: 'library',
        serviceEndpointProjectReferences: [{ ...projectRef, name: BAD_NAME }],
    });
    if (created.status !== 200) {
        console.error('ERROR: Failed to create throwaway bad-credentials endpoint.');
        console.error(`  HTTP status : ${created.status}`);
        console.error('  Response    :');
        console.error(preview(created.text));
        console.error('');
        console.error(
            created.status === 403
                ? '  Hint: PAT lacks scopes. Required: Service Connections (Read, query, & manage).'
                : '  Hint: see the response body above for the ADO error message.',
        );
        throw new CheckFailed('create failed');
    }

    badEndpointId = (created.json && created.json.id) || '';
    if (!badEndpointId) {
        console.error('ERROR: create returned HTTP 200 but no endpoint id was parsed:');
        console.error(preview(created.text));
        throw new CheckFailed('no endpoint id');
    }
    console.log(`Created throwaway endpoint id: ${badEndpointId}`);
    console.log('');

    const result = await callTestConnection(badEndpointId);

    // An empty statusCode means the response couldn't be parsed — that's an
    // inconclusive result, not proof that the bad token was rejected.
    if (result.status === 200 && result.statusCode === '') {
        console.error(
            `ERROR: TestConnection returned HTTP 200 but no parseable statusCode for '${BAD_NAME}'; cannot tell whether the bad token was rejected.`,
        );
        throw new CheckFailed('inconclusive negative check');
    }

    if (isTestConnectionSuccess(result)) {
        banner(
            `  Verify connection SUCCEEDED for '${BAD_NAME}' — but it should have`,
            '  FAILED (the token is deliberately invalid). The TestConnection',
            '  dataSource is no longer distinguishing valid from invalid auth.',
        );
        throw new CheckFailed('negative check passed unexpectedly');
    }

    banner(`  Verify connection correctly FAILED for '${BAD_NAME}', as expected.`, '  Both checks passed.');
}

async function main() {
    const context = await positiveCheck();
    await sweepOrphans();
    await negativeCheck(context);
}

// GitHub sends SIGINT, then SIGTERM, when cancelling a run (cancel-in-progress)
// — clean up the throwaway endpoint before dying. The next run's sweep covers
// the case where we're SIGKILLed before this gets a chance to finish.
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        console.log(`Received ${signal} — cleaning up before exit.`);
        cleanup().finally(() => process.exit(1));
    });
}

main()
    .then(() => cleanup())
    .then(() => process.exit(0))
    .catch(async (err) => {
        if (!(err instanceof CheckFailed)) {
            console.error(err);
        }
        await cleanup();
        process.exit(1);
    });
