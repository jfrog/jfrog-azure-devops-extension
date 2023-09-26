#!/usr/bin/env bash
set -eu

# This script publishes JFrog Artifactory extension privately for sanity tests.
# Currently it will work only on Unix and Linux.
# Run it from the project's directory.
# Precondition: Set 2 environment variables:
# 1. ADO_ARTIFACTORY_DEVELOPER - Developer ID in Visual Studio (Organization name in Azure DevOps)
# 2. ADO_ARTIFACTORY_API_KEY - API key in Visual Studio (Personal access tokens under 'Security' menu, configured to 'All accessible organizations' in 'Organization' and 'Full access' in 'Scopes'.)
# 3. Create publisher at https://aka.ms/vsm-create-publisher. It's Name (and ID) should be the value of '$ADO_ARTIFACTORY_DEVELOPER-private' (other details are not required).

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

cp vss-extension.json vss-extension-private.json

npx tfx extension unshare -t "$ADO_ARTIFACTORY_API_KEY" --extension-id jfrog-azure-devops-extension --publisher "$PUBLISHER" --unshare-with "$ADO_ARTIFACTORY_DEVELOPER" 2>/dev/null
npx tfx extension unpublish -t "$ADO_ARTIFACTORY_API_KEY" --extension-id jfrog-azure-devops-extension --publisher "$PUBLISHER"
npx tfx extension create --manifest-globs vss-extension-private.json --publisher "$PUBLISHER"
# Check that vsix size is less then 30MB
if [ "$(du -m -- *.vsix | awk '{print $1}')" -gt 30 ]; then
    echo "extension vsix size is greater than 30MB! Hint: Most of the dependencies on package-json are ^x.y.z, so maybe one of them got updated, and the node_modules directory became bigger."
    exit 1
fi
npx tfx extension publish -t "$ADO_ARTIFACTORY_API_KEY" --publisher "$PUBLISHER" --manifests vss-extension-private.json --override "{\"public\": false, \"version\": \"$RANDOM.$RANDOM.$RANDOM\", \"description\": \"Commit SHA: $GIT_HEAD\"}" --share-with "$ADO_ARTIFACTORY_DEVELOPER"
npx tfx extension install --publisher "$PUBLISHER" --extension-id jfrog-azure-devops-extension --service-url https://"$ADO_ARTIFACTORY_DEVELOPER".visualstudio.com -t "$ADO_ARTIFACTORY_API_KEY"

rm -- *.vsix
rm vss-extension-private.json