#!/usr/bin/env bash
set -eu
rm -f *.vsix

PUBLISHER="winslowtech"
ORGANIZATION="winslowtech"
EXTENSION_ID="novo-artifactory-setup"
EXTENSION_NAME="Novo Artifactory Setup"

OVERRIDE_JSON=$(
  cat <<EOF
{
  "id": "$EXTENSION_ID",
  "name": "$EXTENSION_NAME",
  "public": false,
  "description": "work in progress"
}
EOF
)

# Unshare and unpublish the extension if it exists (ignore errors if it doesn't)
tfx extension unshare -t "$WINSLOWTECH_TOKEN" --extension-id $EXTENSION_ID --publisher "$PUBLISHER" --unshare-with "$ORGANIZATION" 2>/dev/null || true
tfx extension unpublish -t "$WINSLOWTECH_TOKEN" --extension-id $EXTENSION_ID --publisher "$PUBLISHER" || true

# Create the VSIX package
tfx extension create --manifests vss-extension.json --publisher "$PUBLISHER" --rev-version --override $OVERRIDE_JSON

vsixSize=$(du -k *.vsix | awk '{sum+=$1} END {print int(sum/1024)}')
echo "Extension VSIX size is ${vsixSize}MB"

# Publish the extension
tfx extension publish -t "$WINSLOWTECH_TOKEN" \
  --publisher "$PUBLISHER" \
  --manifests vss-extension.json \
  --share-with "$ORGANIZATION" \
  --override $OVERRIDE_JSON

# Install the extension to your organization
tfx extension install \
  --publisher "$PUBLISHER" \
  --extension-id $EXTENSION_ID \
  --service-url "https://${PUBLISHER}.visualstudio.com" \
  -t "$WINSLOWTECH_TOKEN"

rm *.vsix
