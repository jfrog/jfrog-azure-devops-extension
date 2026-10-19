#!/usr/bin/env bash
set -euo pipefail

# Drive the same REST call the Azure DevOps "Verify connection" button makes
# on a service endpoint, so CI catches regressions in that flow even though
# no pipeline task ever exercises it.
#
# Two checks run:
#   1. POSITIVE - the existing, correctly-configured jfrog-sanity-connection
#      must report success. This is the regression guard for the actual fix.
#      Retried a few times: a freshly-updated extension's TestConnection
#      dataSource can take a little longer to take effect in the org than
#      the Marketplace version check (run before this script) confirms.
#   2. NEGATIVE - a throwaway connection (same type/url, deliberately bad
#      token) must report failure. This proves the test itself can actually
#      detect a broken connection — not just that today's config happens to
#      work — so a future API change that silently breaks failure-detection
#      (e.g. the dataSource starts reporting success/200 no matter what)
#      would also be caught.
#
# Before the negative check creates its throwaway endpoint, any orphans left
# by a previous run that was killed before its cleanup trap ran (job
# timeout, a newer run cancelling this one) are swept and deleted first.
#
# Required environment variables:
#   ADO_ORG      - Azure DevOps organization name (e.g. vigneshc0742)
#   ADO_PROJECT  - Azure DevOps project name      (e.g. ecomatrix-test)
#   ADO_PAT      - PAT with Service Connections (Read, query, & manage) scope
#                  (the negative check creates + deletes a throwaway endpoint)
#
# Optional environment variables:
#   CONNECTION_NAME - Name of an existing, working service endpoint to test
#                      (default: jfrog-sanity-connection, a JFrog Platform
#                      connection already configured for the sanity pipeline)

ADO_ORG="${ADO_ORG:?'ADO_ORG is required'}"
ADO_PROJECT="${ADO_PROJECT:?'ADO_PROJECT is required'}"
ADO_PAT="${ADO_PAT:?'ADO_PAT is required'}"
CONNECTION_NAME="${CONNECTION_NAME:-jfrog-sanity-connection}"

# GITHUB_RUN_ID is unique per workflow run across the whole repo (unlike the
# shell PID, which GitHub's minimal runner containers can hand out
# identically to two jobs started around the same time); GITHUB_RUN_ATTEMPT
# distinguishes re-runs of the same run. $$ is only a last-resort local-run
# fallback, never relied on alone for uniqueness in CI.
BAD_PREFIX="${CONNECTION_NAME}-badcreds-e2e-"
BAD_NAME="${BAD_PREFIX}${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-0}-$$"
CURL_MAX_TIME=30
# statusCode ADO's TestConnection returns for a healthy connection. Asserted
# explicitly: "anything but badRequest" would also pass on an empty value
# (jq failure, or ADO renaming the field).
EXPECTED_SUCCESS_STATUS_CODE="ok"

API_BASE="https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis"
# ADO REST API uses Basic auth with an empty username and PAT as password.
AUTH_HEADER="Authorization: Basic $(echo -n ":${ADO_PAT}" | base64 -w0 2>/dev/null || echo -n ":${ADO_PAT}" | base64)"

RESPONSE_FILE=$(mktemp)
BAD_ENDPOINT_ID=""
BAD_ENDPOINT_PROJECT_ID=""

# Deletes service endpoint $1 (scoped to BAD_ENDPOINT_PROJECT_ID), used by
# both the cleanup trap and the orphan sweep below.
delete_endpoint() {
    local endpoint_id="$1"
    curl -sS --max-time "$CURL_MAX_TIME" -o /dev/null -X DELETE \
        "${API_BASE}/serviceendpoint/endpoints/${endpoint_id}?projectIds=${BAD_ENDPOINT_PROJECT_ID}&api-version=7.1" \
        -H "${AUTH_HEADER}"
}

cleanup() {
    rm -f "$RESPONSE_FILE"
    if [ -n "$BAD_ENDPOINT_ID" ]; then
        echo "Cleaning up throwaway endpoint ${BAD_ENDPOINT_ID}..."
        delete_endpoint "$BAD_ENDPOINT_ID" || echo "  WARNING: cleanup delete failed — remove '${BAD_ENDPOINT_ID}' manually."
    fi
}
trap cleanup EXIT

# Calls endpointproxy TestConnection for $1 (an endpoint id). Sets
# $TEST_HTTP_STATUS and $TEST_STATUS_CODE ("" if the body wasn't valid JSON —
# e.g. an HTML error/maintenance page during a transient ADO outage — rather
# than letting a bare jq parse failure abort the whole script under set -e).
call_test_connection() {
    local endpoint_id="$1"
    TEST_HTTP_STATUS=$(curl -sS --max-time "$CURL_MAX_TIME" -o "$RESPONSE_FILE" -w "%{http_code}" -X POST \
        "${API_BASE}/serviceendpoint/endpointproxy?endpointId=${endpoint_id}&api-version=7.2-preview.1" \
        -H "${AUTH_HEADER}" \
        -H "Content-Type: application/json" \
        -d '{"dataSourceDetails": {"dataSourceName": "TestConnection", "parameters": null}}' || echo "000")
    TEST_RESPONSE="$(cat "$RESPONSE_FILE")"
    echo "Response (HTTP ${TEST_HTTP_STATUS}):"
    printf '%.2000s\n' "${TEST_RESPONSE}"
    echo ""
    TEST_STATUS_CODE=$(echo "$TEST_RESPONSE" | jq -r '.statusCode // empty' 2>/dev/null || echo "")
}

echo "=============================================="
echo "  1. Positive check: ${CONNECTION_NAME}"
echo "  Org:        ${ADO_ORG}"
echo "  Project:    ${ADO_PROJECT}"
echo "=============================================="

# ------------------------------------------------------------------
# Look up the good endpoint by name
# ------------------------------------------------------------------
HTTP_STATUS=$(curl -sS --max-time "$CURL_MAX_TIME" -o "$RESPONSE_FILE" -w "%{http_code}" \
    "${API_BASE}/serviceendpoint/endpoints?endpointNames=${CONNECTION_NAME}&api-version=7.1" \
    -H "${AUTH_HEADER}" || echo "000")

LOOKUP_RESPONSE="$(cat "$RESPONSE_FILE")"

if [ "$HTTP_STATUS" != "200" ]; then
    echo "ERROR: Failed to look up service connection '${CONNECTION_NAME}'."
    echo "  HTTP status : ${HTTP_STATUS}"
    echo "  Response    :"
    printf '%.2000s\n' "${LOOKUP_RESPONSE}"
    echo ""
    case "${HTTP_STATUS}" in
        000) echo "  Hint: network/DNS failure — ADO_ORG '${ADO_ORG}' may be wrong (used in URL host)." ;;
        401) echo "  Hint: PAT is invalid, expired, or for a different organization. Regenerate ADO_E2E_PAT." ;;
        403) echo "  Hint: PAT lacks scopes. Required: Service Connections (Read, query, & manage)." ;;
        404) echo "  Hint: Project '${ADO_PROJECT}' not found in org '${ADO_ORG}'." ;;
        *)   echo "  Hint: see the response body above for the ADO error message." ;;
    esac
    exit 1
fi

ENDPOINT_ID=$(echo "$LOOKUP_RESPONSE" | jq -r '.value[0].id // empty')
ENDPOINT_TYPE=$(echo "$LOOKUP_RESPONSE" | jq -r '.value[0].type // empty')
ENDPOINT_URL=$(echo "$LOOKUP_RESPONSE" | jq -r '.value[0].url // empty')

if [ -z "$ENDPOINT_ID" ]; then
    echo "ERROR: No service connection named '${CONNECTION_NAME}' found in project '${ADO_PROJECT}'."
    echo "  Has the one-time setup (see .pipelines/ado-sanity-pipeline.yml) been done in this org?"
    exit 1
fi

# Narrow the throwaway endpoint's scope to just $ADO_PROJECT, even if the
# good connection happens to be shared with other projects too — the
# throwaway endpoint should never need (or be granted) a wider blast radius.
PROJECT_REF=$(echo "$LOOKUP_RESPONSE" | jq -c --arg proj "$ADO_PROJECT" \
    '[.value[0].serviceEndpointProjectReferences[] | select(.projectReference.name == $proj)][0] // empty')

if [ -z "$PROJECT_REF" ]; then
    echo "ERROR: '${CONNECTION_NAME}' has no project reference matching '${ADO_PROJECT}'."
    exit 1
fi
BAD_ENDPOINT_PROJECT_ID=$(echo "$PROJECT_REF" | jq -r '.projectReference.id')

echo "Found endpoint id: ${ENDPOINT_ID} (type: ${ENDPOINT_TYPE})"
echo ""

# A freshly-updated extension's service-endpoint-type contribution can take
# a little longer to take effect in the org than the Marketplace version
# check already performed by the caller — retry before concluding this is a
# real regression.
POSITIVE_RETRY_ATTEMPTS=3
POSITIVE_RETRY_WAIT_SECONDS=30
attempt=1
while : ; do
    call_test_connection "$ENDPOINT_ID"
    if [ "$TEST_HTTP_STATUS" = "200" ] && [ "$TEST_STATUS_CODE" = "$EXPECTED_SUCCESS_STATUS_CODE" ]; then
        break
    fi
    if [ "$attempt" -ge "$POSITIVE_RETRY_ATTEMPTS" ]; then
        ERROR_MESSAGE=$(echo "$TEST_RESPONSE" | jq -r '.errorMessage // "unknown error"' 2>/dev/null || echo "unknown error")
        echo "=============================================="
        echo "  Verify connection FAILED for '${CONNECTION_NAME}' (expected success) after ${attempt} attempts."
        echo "  Error: ${ERROR_MESSAGE}"
        echo "=============================================="
        exit 1
    fi
    echo "Attempt ${attempt}/${POSITIVE_RETRY_ATTEMPTS} failed — retrying in ${POSITIVE_RETRY_WAIT_SECONDS}s in case the extension is still propagating..."
    sleep "$POSITIVE_RETRY_WAIT_SECONDS"
    attempt=$((attempt + 1))
done

echo "Verify connection SUCCEEDED for '${CONNECTION_NAME}', as expected."
echo ""

# ------------------------------------------------------------------
# Sweep: delete any orphaned throwaway endpoints left by a previous run
# whose cleanup trap didn't get to run (SIGKILL on timeout/cancellation).
# ------------------------------------------------------------------
echo "Sweeping for orphaned throwaway endpoints (prefix '${BAD_PREFIX}')..."
HTTP_STATUS=$(curl -sS --max-time "$CURL_MAX_TIME" -o "$RESPONSE_FILE" -w "%{http_code}" \
    "${API_BASE}/serviceendpoint/endpoints?api-version=7.1" \
    -H "${AUTH_HEADER}" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    ORPHANS=$(jq -r --arg prefix "$BAD_PREFIX" \
        '.value[] | select(.name | startswith($prefix)) | "\(.id) \(.name)"' "$RESPONSE_FILE" 2>/dev/null || echo "")
    if [ -n "$ORPHANS" ]; then
        while read -r orphan_id orphan_name; do
            [ -z "$orphan_id" ] && continue
            echo "  Deleting orphan '${orphan_name}' (${orphan_id})..."
            delete_endpoint "$orphan_id" || echo "    WARNING: failed to delete orphan '${orphan_name}'."
        done <<< "$ORPHANS"
    else
        echo "  None found."
    fi
else
    echo "  WARNING: sweep lookup failed (HTTP ${HTTP_STATUS}) — continuing without it."
fi
echo ""

# ------------------------------------------------------------------
# Negative check: throwaway connection, same type/url, bad token.
# Proves the pass/fail detection itself still works.
# ------------------------------------------------------------------
echo "=============================================="
echo "  2. Negative check: ${BAD_NAME}"
echo "=============================================="

CREATE_BODY=$(jq -n \
    --arg name "$BAD_NAME" \
    --arg type "$ENDPOINT_TYPE" \
    --arg url "$ENDPOINT_URL" \
    --argjson ref "$PROJECT_REF" \
    '{
        name: $name,
        type: $type,
        url: $url,
        authorization: { scheme: "Token", parameters: { apitoken: "invalid-token-for-e2e-negative-test" } },
        isShared: false,
        isReady: true,
        owner: "library",
        serviceEndpointProjectReferences: [($ref | .name = $name)]
    }')

HTTP_STATUS=$(curl -sS --max-time "$CURL_MAX_TIME" -o "$RESPONSE_FILE" -w "%{http_code}" -X POST \
    "${API_BASE}/serviceendpoint/endpoints?api-version=7.1" \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "$CREATE_BODY" || echo "000")

CREATE_RESPONSE="$(cat "$RESPONSE_FILE")"

if [ "$HTTP_STATUS" != "200" ]; then
    echo "ERROR: Failed to create throwaway bad-credentials endpoint."
    echo "  HTTP status : ${HTTP_STATUS}"
    echo "  Response    :"
    printf '%.2000s\n' "${CREATE_RESPONSE}"
    echo ""
    case "${HTTP_STATUS}" in
        403) echo "  Hint: PAT lacks scopes. Required: Service Connections (Read, query, & manage)." ;;
        *)   echo "  Hint: see the response body above for the ADO error message." ;;
    esac
    exit 1
fi

BAD_ENDPOINT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')

if [ -z "$BAD_ENDPOINT_ID" ]; then
    echo "ERROR: create returned HTTP 200 but no endpoint id was parsed:"
    printf '%.2000s\n' "$CREATE_RESPONSE"
    exit 1
fi

echo "Created throwaway endpoint id: ${BAD_ENDPOINT_ID}"
echo ""

call_test_connection "$BAD_ENDPOINT_ID"

# An empty statusCode means the response couldn't be parsed — that's an
# inconclusive result, not proof that the bad token was rejected.
if [ "$TEST_HTTP_STATUS" = "200" ] && [ -z "$TEST_STATUS_CODE" ]; then
    echo "ERROR: TestConnection returned HTTP 200 but no parseable statusCode for '${BAD_NAME}'; cannot tell whether the bad token was rejected."
    exit 1
fi

if [ "$TEST_HTTP_STATUS" = "200" ] && [ "$TEST_STATUS_CODE" = "$EXPECTED_SUCCESS_STATUS_CODE" ]; then
    echo "=============================================="
    echo "  Verify connection SUCCEEDED for '${BAD_NAME}' — but it should have"
    echo "  FAILED (the token is deliberately invalid). The TestConnection"
    echo "  dataSource is no longer distinguishing valid from invalid auth."
    echo "=============================================="
    exit 1
fi

echo "=============================================="
echo "  Verify connection correctly FAILED for '${BAD_NAME}', as expected."
echo "  Both checks passed."
echo "=============================================="
exit 0
