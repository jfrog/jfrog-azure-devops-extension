#!/usr/bin/env bash

# Publisher ID in Visual Studio marketplace
export PUBLISHER=eyalbe4
# Developer ID in Visual Studio
export DEVELOPER=eyalbe4
# API key in Visual Studio (Personal access tokens under 'Security' menu)
export API_KEY=iojikarhjvwlowp7xfb67hyimmdlqplmzwwn5x7bkvpip6rw3wnq

if [ ! -f vss-extension-private.json ]; then
    cp vss-extension.json vss-extension-private.json
fi

tfx extension create --manifest-globs vss-extension-private.json --publisher $PUBLISHER --rev-version --override "{\"public\": false}"
tfx extension publish -t $API_KEY --publisher $PUBLISHER --manifests vss-extension-private.json --override "{\"public\": false}" --share-with $DEVELOPER

rm *.vsix