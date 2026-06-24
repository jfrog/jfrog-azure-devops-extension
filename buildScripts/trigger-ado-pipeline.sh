#!/usr/bin/env bash
set -eu

# Trigger an Azure DevOps pipeline run and wait for it to complete.
#
# Required environment variables:
#   ADO_ORG         - Azure DevOps organization name (e.g. vigneshc0742)
#   ADO_PROJECT     - Azure DevOps project name     (e.g. ecomatrix-test)
#   ADO_PIPELINE_ID - Pipeline definition ID         (e.g. 63)
#   ADO_PAT         - PAT with Build Read+Execute and Project Read scopes only
#
# Optional environment variables:
#   GH_PR_NUMBER    - GitHub PR number passed into pipeline as a variable (default: 0)
#   GH_COMMIT_SHA   - Git commit SHA passed into pipeline as a variable (default: unknown)
#   TIMEOUT_MINUTES - Max minutes to wait for completion (default: 60)

ADO_ORG="${ADO_ORG:?'ADO_ORG is required'}"
ADO_PROJECT="${ADO_PROJECT:?'ADO_PROJECT is required'}"
ADO_PIPELINE_ID="${ADO_PIPELINE_ID:?'ADO_PIPELINE_ID is required'}"
ADO_PAT="${ADO_PAT:?'ADO_PAT is required'}"
GH_PR_NUMBER="${GH_PR_NUMBER:-0}"
GH_COMMIT_SHA="${GH_COMMIT_SHA:-unknown}"
TIMEOUT_MINUTES="${TIMEOUT_MINUTES:-60}"

API_BASE="https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis"
# ADO REST API uses Basic auth with an empty username and PAT as password.
AUTH_HEADER="Authorization: Basic $(echo -n ":${ADO_PAT}" | base64 -w0 2>/dev/null || echo -n ":${ADO_PAT}" | base64)"

echo "=============================================="
echo "  Triggering ADO E2E Pipeline"
echo "  Org:        ${ADO_ORG}"
echo "  Project:    ${ADO_PROJECT}"
echo "  Pipeline:   ${ADO_PIPELINE_ID}"
echo "  PR:         ${GH_PR_NUMBER}"
echo "  Commit:     ${GH_COMMIT_SHA}"
echo "=============================================="

# ------------------------------------------------------------------
# Trigger the pipeline run
# ------------------------------------------------------------------
# Capture HTTP status separately so we can diagnose 401/403/404 etc.
# instead of getting an opaque "curl request failed" message.
RESPONSE_FILE=$(mktemp)
trap 'rm -f "$RESPONSE_FILE"' EXIT

HTTP_STATUS=$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" -X POST \
    "${API_BASE}/pipelines/${ADO_PIPELINE_ID}/runs?api-version=7.1" \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "{
          \"variables\": {
            \"GH_PR_NUMBER\":   { \"value\": \"${GH_PR_NUMBER}\",  \"isSecret\": false },
            \"GH_COMMIT_SHA\":  { \"value\": \"${GH_COMMIT_SHA}\", \"isSecret\": false }
          }
        }" || echo "000")

RUN_RESPONSE="$(cat "$RESPONSE_FILE")"

if [ "$HTTP_STATUS" != "200" ]; then
    echo "ERROR: Pipeline trigger failed."
    echo "  HTTP status : ${HTTP_STATUS}"
    echo "  Endpoint    : ${API_BASE}/pipelines/${ADO_PIPELINE_ID}/runs?api-version=7.1"
    echo "  Response    :"
    echo "${RUN_RESPONSE}" | head -c 2000
    echo ""
    case "${HTTP_STATUS}" in
        000) echo "  Hint: network/DNS failure — ADO_ORG '${ADO_ORG}' may be wrong (used in URL host)." ;;
        401) echo "  Hint: PAT is invalid, expired, or for a different organization. Regenerate ADO_E2E_PAT." ;;
        403) echo "  Hint: PAT lacks scopes. Required: Build (Read & Execute) + Project and Team (Read)." ;;
        404) echo "  Hint: Project '${ADO_PROJECT}' or pipeline definition id '${ADO_PIPELINE_ID}' not found in org '${ADO_ORG}'." ;;
        *)   echo "  Hint: see the response body above for the ADO error message." ;;
    esac
    exit 1
fi

RUN_ID=$(echo "$RUN_RESPONSE"   | jq -r '.id   // empty')
RUN_URL=$(echo "$RUN_RESPONSE"  | jq -r '._links.web.href // empty')

if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
    echo "ERROR: trigger returned HTTP 200 but no run id was parsed from the response:"
    echo "$RUN_RESPONSE" | head -c 2000
    exit 1
fi

echo ""
echo "Pipeline run #${RUN_ID} triggered successfully."
echo "View at: ${RUN_URL}"
echo ""

# ------------------------------------------------------------------
# Poll for completion
# ------------------------------------------------------------------
MAX_ATTEMPTS=$(( TIMEOUT_MINUTES * 2 ))   # poll every 30 seconds
ATTEMPT=0

echo "Polling for completion (timeout: ${TIMEOUT_MINUTES} minutes)..."

while [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; do
    ATTEMPT=$(( ATTEMPT + 1 ))

    STATUS_RESPONSE=$(curl -sf \
        "${API_BASE}/pipelines/${ADO_PIPELINE_ID}/runs/${RUN_ID}?api-version=7.1" \
        -H "${AUTH_HEADER}" || echo "CURL_FAILED")

    if [ "$STATUS_RESPONSE" = "CURL_FAILED" ]; then
        echo "[$(date -u '+%H:%M:%S')] WARNING: status poll failed, retrying..."
        sleep 30
        continue
    fi

    STATE=$(echo  "$STATUS_RESPONSE" | jq -r '.state  // "unknown"')
    RESULT=$(echo "$STATUS_RESPONSE" | jq -r '.result // "unknown"')

    echo "[$(date -u '+%H:%M:%S')] State: ${STATE} | Result: ${RESULT}  (attempt ${ATTEMPT}/${MAX_ATTEMPTS})"

    if [ "$STATE" = "completed" ]; then
        echo ""
        echo "=============================================="
        echo "  Pipeline run #${RUN_ID} completed."
        echo "  Result: ${RESULT}"
        echo "  URL:    ${RUN_URL}"
        echo "=============================================="

        if [ "$RESULT" = "succeeded" ]; then
            echo "All E2E tests passed."
            exit 0
        else
            echo "E2E tests FAILED (result: ${RESULT})."
            exit 1
        fi
    fi

    sleep 30
done

echo ""
echo "ERROR: Timeout — pipeline did not complete within ${TIMEOUT_MINUTES} minutes."
echo "View at: ${RUN_URL}"
exit 1
