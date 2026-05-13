#!/usr/bin/env bash
set -eu

# This script publishes JFrog Artifactory extension privately for sanity tests.
# Currently it will work only on Unix and Linux.
# Run it from the project's directory.
# Precondition: Set 2 environment variables:
# 1. ADO_ARTIFACTORY_DEVELOPER - Developer ID in Visual Studio (Organization name in Azure DevOps)
# 2. ADO_ARTIFACTORY_API_KEY - API key in Visual Studio (Personal access tokens under 'Security' menu, configured to 'All accessible organizations' in 'Organization' and 'Full access' in 'Scopes'.)
# 3. Create publisher at https://aka.ms/vsm-create-publisher. It's Name (and ID) should be the value of '$ADO_ARTIFACTORY_DEVELOPER-private' (other details are not required).
#
# Optional:
# EXTENSION_VERSION_OVERRIDE - If set, uses this semver string instead of a random version.
#   Useful in CI to produce a traceable version like "0.<PR_NUMBER>.<RUN_NUMBER>".

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

# Force the manifest to use the private publisher. tfx's --publisher flag
# is meant to override the manifest, but in some versions the manifest's
# value silently wins, causing publishes to land in (or conflict with) the
# wrong publisher. Editing the JSON in-place removes that ambiguity.
sed -i.bak "s/\"publisher\": *\"[^\"]*\"/\"publisher\": \"$PUBLISHER\"/" vss-extension-private.json
rm -f vss-extension-private.json.bak

# `tfx extension unpublish` removes the extension entirely from Marketplace.
# We used to call it before every publish to keep the publisher tidy, but
# Marketplace's API leaves a tombstoned record after unpublish that the next
# `publish` call cannot overwrite (returns "The extension already exists"
# even though the publisher UI shows nothing). Skipping unpublish lets the
# extension stay in place and `publish` simply adds a new version each run.
# Set REPUBLISH_FROM_SCRATCH=true to restore the old behaviour for one-off
# manual cleanups.
if [ "${REPUBLISH_FROM_SCRATCH:-false}" = "true" ]; then
    npx tfx extension unshare -t "$ADO_ARTIFACTORY_API_KEY" --extension-id jfrog-azure-devops-extension --publisher "$PUBLISHER" --unshare-with "$ADO_ARTIFACTORY_DEVELOPER" 2>/dev/null || true
    npx tfx extension unpublish -t "$ADO_ARTIFACTORY_API_KEY" --extension-id jfrog-azure-devops-extension --publisher "$PUBLISHER" || true
    MARKETPLACE_DELETE_WAIT_SECONDS="${MARKETPLACE_DELETE_WAIT_SECONDS:-60}"
    echo "Waiting ${MARKETPLACE_DELETE_WAIT_SECONDS}s for Marketplace to fully process the unpublish..."
    sleep "$MARKETPLACE_DELETE_WAIT_SECONDS"
fi

npx tfx extension create --manifest-globs vss-extension-private.json --publisher "$PUBLISHER"

# Pre-flight size check: Marketplace's hard limit is generous, but we like to
# stay under 40MB so the .vsix downloads quickly for installs.
# Set SKIP_VSIX_SIZE_CHECK=true to opt out (useful in CI while a separate
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
echo "Publishing extension version: $VSIX_VERSION (commit: $GIT_HEAD)"
# Retry publish up to 3 times: the previous unpublish + sleep usually clears
# the eventual-consistency window, but if Marketplace still returns "The
# extension already exists" we wait longer and retry.
PUBLISH_MAX_ATTEMPTS="${PUBLISH_MAX_ATTEMPTS:-3}"
PUBLISH_RETRY_WAIT_SECONDS="${PUBLISH_RETRY_WAIT_SECONDS:-45}"
attempt=1
while : ; do
    if npx tfx extension publish -t "$ADO_ARTIFACTORY_API_KEY" --publisher "$PUBLISHER" --manifests vss-extension-private.json --override "{\"public\": false, \"version\": \"$VSIX_VERSION\", \"description\": \"Commit SHA: $GIT_HEAD\"}" --share-with "$ADO_ARTIFACTORY_DEVELOPER"; then
        break
    fi
    if [ "$attempt" -ge "$PUBLISH_MAX_ATTEMPTS" ]; then
        echo "Publish failed after ${attempt} attempts. Giving up."
        exit 1
    fi
    echo "Publish attempt ${attempt} failed. Waiting ${PUBLISH_RETRY_WAIT_SECONDS}s before retry..."
    sleep "$PUBLISH_RETRY_WAIT_SECONDS"
    attempt=$((attempt + 1))
done
npx tfx extension install --publisher "$PUBLISHER" --extension-id jfrog-azure-devops-extension --service-url https://"$ADO_ARTIFACTORY_DEVELOPER".visualstudio.com -t "$ADO_ARTIFACTORY_API_KEY"

rm -- *.vsix
rm vss-extension-private.json