#!/usr/bin/env bash

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

cp vss-extension.json vss-extension-private.json
# Replaces the version to a random version (required for azure to load the changes)
sed -i '' "s/\"version\": \".*..*..*\"/\"version\": \"${RANDOM}.${RANDOM}.${RANDOM}\"/g" vss-extension-private.json


tfx extension unshare -t $ADO_ARTIFACTORY_API_KEY --extension-id jfrog-azure-devops-extension --publisher $PUBLISHER --unshare-with $ADO_ARTIFACTORY_DEVELOPER 2>/dev/null
tfx extension unpublish -t $ADO_ARTIFACTORY_API_KEY --extension-id jfrog-azure-devops-extension --publisher $PUBLISHER
tfx extension create --manifest-globs vss-extension-private.json --publisher $PUBLISHER
tfx extension publish -t $ADO_ARTIFACTORY_API_KEY --publisher $PUBLISHER --manifests vss-extension-private.json --override "{\"public\": false}" --share-with $ADO_ARTIFACTORY_DEVELOPER
tfx extension install --publisher $PUBLISHER --extension-id jfrog-azure-devops-extension --service-url https://$ADO_ARTIFACTORY_DEVELOPER.visualstudio.com -t $ADO_ARTIFACTORY_API_KEY

rm *.vsix
rm vss-extension-private.json