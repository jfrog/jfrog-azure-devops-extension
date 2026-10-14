#!/usr/bin/env bash
set -eu

# Drive the same REST call the Azure DevOps "Verify connection" button makes
# on a service endpoint, so CI catches regressions in that flow even though
# no pipeline task ever exercises it.
#
# Required environment variables:
#   ADO_ORG      - Azure DevOps organization name (e.g. vigneshc0742)
#   ADO_PROJECT  - Azure DevOps project name      (e.g. ecomatrix-test)
#   ADO_PAT      - PAT with Service Connections (Read) scope
#
# Optional environment variables:
#   CONNECTION_NAME - Name of an existing service endpoint to test
#                      (default: jfrog-sanity-connection, a JFrog Platform
#                      connection already configured for the sanity pipeline)

ADO_ORG="${ADO_ORG:?'ADO_ORG is required'}"
ADO_PROJECT="${ADO_PROJECT:?'ADO_PROJECT is required'}"
ADO_PAT="${ADO_PAT:?'ADO_PAT is required'}"
CONNECTION_NAME="${CONNECTION_NAME:-jfrog-sanity-connection}"

API_BASE="https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis"
# ADO REST API uses Basic auth with an empty username and PAT as password.
AUTH_HEADER="Authorization: Basic $(echo -n ":${ADO_PAT}" | base64 -w0 2>/dev/null || echo -n ":${ADO_PAT}" | base64)"

echo "=============================================="
echo "  Verifying service connection"
echo "  Org:        ${ADO_ORG}"
echo "  Project:    ${ADO_PROJECT}"
echo "  Connection: ${CONNECTION_NAME}"
echo "=============================================="

RESPONSE_FILE=$(mktemp)
trap 'rm -f "$RESPONSE_FILE"' EXIT

# ------------------------------------------------------------------
# Look up the endpoint id by name
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
        403) echo "  Hint: PAT lacks scopes. Required: Service Connections (Read)." ;;
        404) echo "  Hint: Project '${ADO_PROJECT}' not found in org '${ADO_ORG}'." ;;
        *)   echo "  Hint: see the response body above for the ADO error message." ;;
    esac
    exit 1
fi

ENDPOINT_ID=$(echo "$LOOKUP_RESPONSE" | jq -r '.value[0].id // empty')

if [ -z "$ENDPOINT_ID" ]; then
    echo "ERROR: No service connection named '${CONNECTION_NAME}' found in project '${ADO_PROJECT}'."
    echo "  Has the one-time setup (see .pipelines/ado-sanity-pipeline.yml) been done in this org?"
    exit 1
fi

echo "Found endpoint id: ${ENDPOINT_ID}"

# ------------------------------------------------------------------
# Call the same endpointproxy TestConnection action the "Verify
# connection" button in the ADO UI calls.
# ------------------------------------------------------------------
HTTP_STATUS=$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" -X POST \
    "${API_BASE}/serviceendpoint/endpointproxy?endpointId=${ENDPOINT_ID}&api-version=7.2-preview.1" \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d '{"dataSourceDetails": {"dataSourceName": "TestConnection", "parameters": null}}' || echo "000")

TEST_RESPONSE="$(cat "$RESPONSE_FILE")"

echo ""
echo "Response (HTTP ${HTTP_STATUS}):"
echo "${TEST_RESPONSE}" | head -c 2000
echo ""

STATUS_CODE=$(echo "$TEST_RESPONSE" | jq -r '.statusCode // empty')

if [ "$HTTP_STATUS" != "200" ] || [ "$STATUS_CODE" = "badRequest" ]; then
    ERROR_MESSAGE=$(echo "$TEST_RESPONSE" | jq -r '.errorMessage // "unknown error"')
    echo "=============================================="
    echo "  Verify connection FAILED for '${CONNECTION_NAME}'."
    echo "  Error: ${ERROR_MESSAGE}"
    echo "=============================================="
    exit 1
fi

echo "=============================================="
echo "  Verify connection SUCCEEDED for '${CONNECTION_NAME}'."
echo "=============================================="
exit 0
