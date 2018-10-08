#!/usr/bin/env bash

# This script publishes VSTS extension privately for sanity tests.
# Currently it will work only on Unix and Linux.
# Precondition: Set 2 environment variables:
# 1. VSTS_ARTIFACTORY_DEVELOPER - Developer ID in Visual Studio
# 2. VSTS_ARTIFACTORY_API_KEY - API key in Visual Studio (Personal access tokens under 'Security' menu)

if [ -z "$VSTS_ARTIFACTORY_DEVELOPER" ]; then
    echo "Please set VSTS_ARTIFACTORY_DEVELOPER first"
    exit 1
fi

if [ -z "$VSTS_ARTIFACTORY_API_KEY" ]; then
    echo "Please set VSTS_ARTIFACTORY_API_KEY first"
    exit 1
fi

export PUBLISHER=$VSTS_ARTIFACTORY_DEVELOPER-private

cp vss-extension.json vss-extension-private.json

tfx extension unshare -t $VSTS_ARTIFACTORY_API_KEY --extension-id jfrog-artifactory-vsts-extension --publisher $PUBLISHER --unshare-with $VSTS_ARTIFACTORY_DEVELOPER 2>/dev/null
tfx extension publisher delete -t $VSTS_ARTIFACTORY_API_KEY --publisher $PUBLISHER 2>/dev/null
tfx extension publisher create -t $VSTS_ARTIFACTORY_API_KEY --publisher $PUBLISHER --display-name $PUBLISHER --description "Publishes Artifactory VSTS extension privately for sanity tests"
tfx extension create --manifest-globs vss-extension-private.json --publisher $PUBLISHER
tfx extension publish -t $VSTS_ARTIFACTORY_API_KEY --publisher $PUBLISHER --manifests vss-extension-private.json --override "{\"public\": false}" --share-with $VSTS_ARTIFACTORY_DEVELOPER
tfx extension install --publisher $PUBLISHER --extension-id jfrog-artifactory-vsts-extension --service-url https://$VSTS_ARTIFACTORY_DEVELOPER.visualstudio.com -t $VSTS_ARTIFACTORY_API_KEY

rm *.vsix
rm vss-extension-private.json