#!/usr/bin/env bash
set -eu

# This script publishes JFrog Artifactory extension privately for sanity tests.
# Currently it will work only on Unix and Linux.
# Run it from the project's directory.
#
# Required environment variables:
#   ADO_ARTIFACTORY_DEVELOPER - Developer ID in Visual Studio (Organization name in Azure DevOps)
#   ADO_ARTIFACTORY_API_KEY   - PAT with these scopes:
#                                 Marketplace: Acquire + Publish + Manage
#                                 Extensions:  Read & Manage
#                                 Build:       Read & Execute
#                                 Project and Team: Read
#                                 Token must be scoped to "All accessible organizations".
#                                 The matching publisher must be created at
#                                 https://aka.ms/vsm-create-publisher with id
#                                 "${ADO_ARTIFACTORY_DEVELOPER}-private".
#
# Optional environment variables:
#   EXTENSION_VERSION_OVERRIDE
#       If set, uses this semver string for the published extension version.
#       Useful in CI to produce a traceable version like "0.<PR_NUMBER>.<RUN_NUMBER>".
#   EXTENSION_ID_OVERRIDE
#       If set, replaces the extension id in the manifest before packaging.
#       The e2e workflow uses a per-run unique id (e.g. jfrog-ext-e2e-r<RUN>)
#       so each CI run gets a fresh Marketplace record (Marketplace keeps a
#       permanent tombstone of every (publisher, id) pair it has ever seen,
#       which causes "The extension already exists" errors on republish).
#   SKIP_VSIX_SIZE_CHECK
#       Set to "true" to bypass the local 40MB pre-flight check on the .vsix
#       (Marketplace will still enforce its own limit at upload time).
#   SKIP_INSTALL
#       Set to "true" to publish the extension to Marketplace without
#       installing it into the developer org. Useful for dry runs.
#   INSTALL_MAX_ATTEMPTS / INSTALL_RETRY_WAIT_SECONDS
#       Tunables for the install retry loop. Defaults: 6 attempts, 30s apart.

if [ -z "$ADO_ARTIFACTORY_DEVELOPER" ]; then
    echo "Please set ADO_ARTIFACTORY_DEVELOPER first"
    exit 1
fi

if [ -z "$ADO_ARTIFACTORY_API_KEY" ]; then
    echo "Please set ADO_ARTIFACTORY_API_KEY first"
    exit 1
fi

export PUBLISHER=$ADO_ARTIFACTORY_DEVELOPER-private
GIT_HEAD=$(git rev-parse --short HEAD)
export GIT_HEAD

# Use EXTENSION_VERSION_OVERRIDE when set (e.g. from CI: "0.<PR>.<run>"),
# otherwise fall back to random numbers so manual runs still work without setup.
if [ -n "${EXTENSION_VERSION_OVERRIDE:-}" ]; then
    VSIX_VERSION="$EXTENSION_VERSION_OVERRIDE"
else
    VSIX_VERSION="$RANDOM.$RANDOM.$RANDOM"
fi
export VSIX_VERSION

cp vss-extension.json vss-extension-private.json

# Force the manifest's "publisher" field to the private publisher. tfx's
# --publisher flag is meant to override the manifest, but in some versions
# the manifest's value silently wins, which can cause publishes to land in
# (or conflict with) the wrong publisher. Editing the JSON in-place removes
# that ambiguity.
sed -i.bak "s/\"publisher\": *\"[^\"]*\"/\"publisher\": \"$PUBLISHER\"/" vss-extension-private.json

# Optionally override the extension id. Each CI run uses a unique id so
# Marketplace cannot reject the publish with "The extension already exists"
# (which it does indefinitely after the first successful publish of any
# given (publisher, id) pair, even after unpublish, because of an internal
# tombstone we cannot clear in reasonable CI time).
EXTENSION_ID="jfrog-azure-devops-extension"
if [ -n "${EXTENSION_ID_OVERRIDE:-}" ]; then
    EXTENSION_ID="$EXTENSION_ID_OVERRIDE"
    sed -i.bak "s/\"id\": *\"jfrog-azure-devops-extension\"/\"id\": \"$EXTENSION_ID\"/" vss-extension-private.json
fi
rm -f vss-extension-private.json.bak
export EXTENSION_ID

# Build the .vsix.
npx tfx extension create --manifest-globs vss-extension-private.json --publisher "$PUBLISHER"

# Pre-flight size check: stay under 40MB so the .vsix downloads quickly for
# installs. Set SKIP_VSIX_SIZE_CHECK=true to opt out (useful while a separate
# effort tackles a known node_modules bloat regression - Marketplace will
# still enforce its own limit at upload time).
if [ "${SKIP_VSIX_SIZE_CHECK:-false}" != "true" ]; then
    vsixSize="$(du -m -- *.vsix | awk '{print $1}' | head -1)"
    if [ "${vsixSize}" -gt 40 ]; then
        echo "Extension vsix size is greater than 40MB! (${vsixSize}MB) - Hint: Most of the dependencies on package-json are in format of - <^x.y.z>, so maybe one of them got updated, and the node_modules directory became bigger"
        echo "If this is expected (CI bypass), re-run with SKIP_VSIX_SIZE_CHECK=true"
        exit 1
    fi
fi

# Publish to Marketplace. --no-wait-validation makes the call return as soon
# as the upload lands; Marketplace continues validation asynchronously.
# Without this flag, tfx blocks on a ~3 minute polling timeout that frequently
# expires before validation finishes - tfx then exits non-zero even though
# the upload itself succeeded.
echo "Publishing extension version: $VSIX_VERSION (commit: $GIT_HEAD, id: $EXTENSION_ID)"
npx tfx extension publish --no-wait-validation \
    -t "$ADO_ARTIFACTORY_API_KEY" \
    --publisher "$PUBLISHER" \
    --manifests vss-extension-private.json \
    --override "{\"public\": false, \"version\": \"$VSIX_VERSION\", \"description\": \"Commit SHA: $GIT_HEAD\"}" \
    --share-with "$ADO_ARTIFACTORY_DEVELOPER"

if [ "${SKIP_INSTALL:-false}" = "true" ]; then
    echo "SKIP_INSTALL=true - skipping install step."
    rm -- *.vsix
    rm vss-extension-private.json
    exit 0
fi

# Tasks inside the .vsix carry stable GUIDs (e.g. JFrogBuildPromotion has
# id 32f70de9-cdd0-4009-831a-856c52a4a0ba) and ADO refuses to install a new
# extension whose tasks collide with task GUIDs already present in the org.
# When CI runs use unique extension ids (e.g. ...e2e-r123, ...e2e-r124, etc),
# every prior run's extension is still installed in the dev org and will
# conflict with the new install. Uninstall all stale e2e extensions from this
# publisher before installing the new one. (We deliberately scope this to
# $PUBLISHER so it only touches extensions we own.)
ADO_HOST="extmgmt.dev.azure.com"
EXT_API_BASE="https://${ADO_HOST}/${ADO_ARTIFACTORY_DEVELOPER}/_apis/ExtensionManagement"
AUTH_HEADER="Authorization: Basic $(printf ':%s' "$ADO_ARTIFACTORY_API_KEY" | base64 | tr -d '\n')"

echo "Looking for stale e2e extensions installed in '$ADO_ARTIFACTORY_DEVELOPER' from publisher '$PUBLISHER'..."
INSTALLED_LIST_FILE="$(mktemp)"
if curl -sSf -H "$AUTH_HEADER" \
    "${EXT_API_BASE}/InstalledExtensions?api-version=7.1-preview.1" \
    -o "$INSTALLED_LIST_FILE"; then
    STALE_EXTENSIONS="$(jq -r --arg pub "$PUBLISHER" --arg current "$EXTENSION_ID" \
        '.value[] | select(.publisherName == $pub) | select(.extensionName != $current) | .extensionName' \
        "$INSTALLED_LIST_FILE")"
    if [ -z "$STALE_EXTENSIONS" ]; then
        echo "  No stale extensions to uninstall."
    else
        echo "  Stale extensions found:"
        echo "$STALE_EXTENSIONS" | sed 's/^/    - /'
        for stale in $STALE_EXTENSIONS; do
            echo "  Uninstalling $PUBLISHER.$stale ..."
            if curl -sSf -X DELETE -H "$AUTH_HEADER" \
                "${EXT_API_BASE}/InstalledExtensionsByName/${PUBLISHER}/${stale}?api-version=7.1-preview.1" >/dev/null; then
                echo "    OK"
            else
                echo "    Warning: failed to uninstall $stale (continuing - install may still succeed if tasks don't collide)"
            fi
        done
    fi
else
    echo "  Warning: could not list installed extensions (continuing - install may still succeed if no stale state exists)"
fi
rm -f "$INSTALLED_LIST_FILE"

# Install the new extension. Marketplace's async validation may still be in
# progress for a few seconds after publish, so retry the install for a short
# window.
INSTALL_MAX_ATTEMPTS="${INSTALL_MAX_ATTEMPTS:-6}"
INSTALL_RETRY_WAIT_SECONDS="${INSTALL_RETRY_WAIT_SECONDS:-30}"
attempt=1
while : ; do
    if npx tfx extension install \
        --publisher "$PUBLISHER" \
        --extension-id "$EXTENSION_ID" \
        --service-url "https://${ADO_ARTIFACTORY_DEVELOPER}.visualstudio.com" \
        -t "$ADO_ARTIFACTORY_API_KEY"; then
        break
    fi
    if [ "$attempt" -ge "$INSTALL_MAX_ATTEMPTS" ]; then
        echo "Install failed after ${attempt} attempts. Marketplace validation may have failed - check the publisher dashboard at https://marketplace.visualstudio.com/manage/publishers/${PUBLISHER}"
        exit 1
    fi
    echo "Install attempt ${attempt} failed (extension may still be validating). Waiting ${INSTALL_RETRY_WAIT_SECONDS}s before retry..."
    sleep "$INSTALL_RETRY_WAIT_SECONDS"
    attempt=$((attempt + 1))
done

rm -- *.vsix
rm vss-extension-private.json
