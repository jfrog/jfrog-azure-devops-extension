#!/usr/bin/env bash
set -eu

# Drive the same REST call the Azure DevOps "Verify connection" button makes
# on a service endpoint, so CI catches regressions in that flow even though
# no pipeline task ever exercises it.
#
# Two checks run:
#   1. POSITIVE - the existing, correctly-configured jfrog-sanity-connection
#      must report success. This is the regression guard for the actual fix.
#   2. NEGATIVE - a throwaway connection (same type/url, deliberately bad
#      token) must report failure. This proves the test itself can actually
#      detect a broken connection — not just that today's config happens to
#      work — so a future API change that silently breaks failure-detection
#      (e.g. the dataSource starts reporting success/200 no matter what)
#      would also be caught.
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

API_BASE="https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis"
# ADO REST API uses Basic auth with an empty username and PAT as password.
AUTH_HEADER="Authorization: Basic $(echo -n ":${ADO_PAT}" | base64 -w0 2>/dev/null || echo -n ":${ADO_PAT}" | base64)"

RESPONSE_FILE=$(mktemp)
BAD_ENDPOINT_ID=""
BAD_ENDPOINT_PROJECT_IDS=""

cleanup() {
    rm -f "$RESPONSE_FILE"
    if [ -n "$BAD_ENDPOINT_ID" ]; then
        echo "Cleaning up throwaway endpoint ${BAD_ENDPOINT_ID}..."
        curl -sS -o /dev/null -X DELETE \
            "${API_BASE}/serviceendpoint/endpoints/${BAD_ENDPOINT_ID}?projectIds=${BAD_ENDPOINT_PROJECT_IDS}&api-version=7.1" \
            -H "${AUTH_HEADER}" || echo "  WARNING: cleanup delete failed — remove '${BAD_ENDPOINT_ID}' manually."
    fi
}
trap cleanup EXIT

# Calls endpointproxy TestConnection for $1 (an endpoint id) and prints the
# response. Sets $TEST_HTTP_STATUS and $TEST_STATUS_CODE for the caller.
call_test_connection() {
    local endpoint_id="$1"
    TEST_HTTP_STATUS=$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" -X POST \
        "${API_BASE}/serviceendpoint/endpointproxy?endpointId=${endpoint_id}&api-version=7.2-preview.1" \
        -H "${AUTH_HEADER}" \
        -H "Content-Type: application/json" \
        -d '{"dataSourceDetails": {"dataSourceName": "TestConnection", "parameters": null}}' || echo "000")
    TEST_RESPONSE="$(cat "$RESPONSE_FILE")"
    echo "Response (HTTP ${TEST_HTTP_STATUS}):"
    echo "${TEST_RESPONSE}" | head -c 2000
    echo ""
    TEST_STATUS_CODE=$(echo "$TEST_RESPONSE" | jq -r '.statusCode // empty')
}

echo "=============================================="
echo "  1. Positive check: ${CONNECTION_NAME}"
echo "  Org:        ${ADO_ORG}"
echo "  Project:    ${ADO_PROJECT}"
echo "=============================================="

# ------------------------------------------------------------------
# Look up the good endpoint by name
# ------------------------------------------------------------------
HTTP_STATUS=$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" \
    "${API_BASE}/serviceendpoint/endpoints?endpointNames=${CONNECTION_NAME}&api-version=7.1" \
    -H "${AUTH_HEADER}" || echo "000")

LOOKUP_RESPONSE="$(cat "$RESPONSE_FILE")"

if [ "$HTTP_STATUS" != "200" ]; then
    echo "ERROR: Failed to look up service connection '${CONNECTION_NAME}'."
    echo "  HTTP status : ${HTTP_STATUS}"
    echo "  Response    :"
    echo "${LOOKUP_RESPONSE}" | head -c 2000
    echo ""
    case "${HTTP_STATUS}" in
        000) echo "  Hint: network/DNS failure — ADO_ORG '${ADO_ORG}' may be wrong (used in URL host)." ;;
        401) echo "  Hint: PAT is invalid, expired, or for a different organization. Regenerate the PAT." ;;
        403) echo "  Hint: PAT lacks scopes. Required: Service Connections (Read, query, & manage)." ;;
        404) echo "  Hint: Project '${ADO_PROJECT}' not found in org '${ADO_ORG}'." ;;
        *)   echo "  Hint: see the response body above for the ADO error message." ;;
    esac
    exit 1
fi

ENDPOINT_ID=$(echo "$LOOKUP_RESPONSE" | jq -r '.value[0].id // empty')
ENDPOINT_TYPE=$(echo "$LOOKUP_RESPONSE" | jq -r '.value[0].type // empty')
ENDPOINT_URL=$(echo "$LOOKUP_RESPONSE" | jq -r '.value[0].url // empty')
ENDPOINT_PROJECT_REFS=$(echo "$LOOKUP_RESPONSE" | jq -c '.value[0].serviceEndpointProjectReferences // []')

if [ -z "$ENDPOINT_ID" ]; then
    echo "ERROR: No service connection named '${CONNECTION_NAME}' found in project '${ADO_PROJECT}'."
    echo "  Has the one-time setup (see .pipelines/ado-sanity-pipeline.yml) been done in this org?"
    exit 1
fi

echo "Found endpoint id: ${ENDPOINT_ID} (type: ${ENDPOINT_TYPE})"
echo ""

call_test_connection "$ENDPOINT_ID"

if [ "$TEST_HTTP_STATUS" != "200" ] || [ "$TEST_STATUS_CODE" = "badRequest" ]; then
    ERROR_MESSAGE=$(echo "$TEST_RESPONSE" | jq -r '.errorMessage // "unknown error"')
    echo "=============================================="
    echo "  Verify connection FAILED for '${CONNECTION_NAME}' (expected success)."
    echo "  Error: ${ERROR_MESSAGE}"
    echo "=============================================="
    exit 1
fi

echo "Verify connection SUCCEEDED for '${CONNECTION_NAME}', as expected."
echo ""

# ------------------------------------------------------------------
# Negative check: throwaway connection, same type/url, bad token.
# Proves the pass/fail detection itself still works.
# ------------------------------------------------------------------
BAD_NAME="${CONNECTION_NAME}-badcreds-e2e-$$"

echo "=============================================="
echo "  2. Negative check: ${BAD_NAME}"
echo "=============================================="

BAD_ENDPOINT_PROJECT_IDS=$(echo "$ENDPOINT_PROJECT_REFS" | jq -r 'map(.projectReference.id) | join(",")')
CREATE_BODY=$(jq -n \
    --arg name "$BAD_NAME" \
    --arg type "$ENDPOINT_TYPE" \
    --arg url "$ENDPOINT_URL" \
    --argjson refs "$ENDPOINT_PROJECT_REFS" \
    '{
        name: $name,
        type: $type,
        url: $url,
        authorization: { scheme: "Token", parameters: { apitoken: "invalid-token-for-e2e-negative-test" } },
        isShared: false,
        isReady: true,
        owner: "library",
        serviceEndpointProjectReferences: ($refs | map(.name = $name))
    }')

HTTP_STATUS=$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" -X POST \
    "${API_BASE}/serviceendpoint/endpoints?api-version=7.1" \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "$CREATE_BODY" || echo "000")

CREATE_RESPONSE="$(cat "$RESPONSE_FILE")"

if [ "$HTTP_STATUS" != "200" ]; then
    echo "ERROR: Failed to create throwaway bad-credentials endpoint."
    echo "  HTTP status : ${HTTP_STATUS}"
    echo "  Response    :"
    echo "${CREATE_RESPONSE}" | head -c 2000
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
    echo "$CREATE_RESPONSE" | head -c 2000
    exit 1
fi

echo "Created throwaway endpoint id: ${BAD_ENDPOINT_ID}"
echo ""

call_test_connection "$BAD_ENDPOINT_ID"

if [ "$TEST_HTTP_STATUS" = "200" ] && [ "$TEST_STATUS_CODE" != "badRequest" ]; then
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
