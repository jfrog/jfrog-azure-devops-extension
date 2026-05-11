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

npx tfx extension unshare -t "$ADO_ARTIFACTORY_API_KEY" --extension-id jfrog-azure-devops-extension --publisher "$PUBLISHER" --unshare-with "$ADO_ARTIFACTORY_DEVELOPER" 2>/dev/null
npx tfx extension unpublish -t "$ADO_ARTIFACTORY_API_KEY" --extension-id jfrog-azure-devops-extension --publisher "$PUBLISHER"
npx tfx extension create --manifest-globs vss-extension-private.json --publisher "$PUBLISHER"

# Max size is 50MB, but we want to be under 40.
vsixSize="$(du -m -- *.vsix | awk '{print $1}' | head -1)"
if [ "${vsixSize}" -gt 40 ]; then
    echo "Extension vsix size is greater than 30MB! (${vsixSize}MB) - Hint: Most of the dependencies on package-json are in format of - <^x.y.z>, so maybe one of them got updated, and the node_modules directory became bigger"
    exit 1
fi
echo "Publishing extension version: $VSIX_VERSION (commit: $GIT_HEAD)"
npx tfx extension publish -t "$ADO_ARTIFACTORY_API_KEY" --publisher "$PUBLISHER" --manifests vss-extension-private.json --override "{\"public\": false, \"version\": \"$VSIX_VERSION\", \"description\": \"Commit SHA: $GIT_HEAD\"}" --share-with "$ADO_ARTIFACTORY_DEVELOPER"
npx tfx extension install --publisher "$PUBLISHER" --extension-id jfrog-azure-devops-extension --service-url https://"$ADO_ARTIFACTORY_DEVELOPER".visualstudio.com -t "$ADO_ARTIFACTORY_API_KEY"

rm -- *.vsix
rm vss-extension-private.json