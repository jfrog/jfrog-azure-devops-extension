#!/usr/bin/env bash
set -euo pipefail

# Staging script for jfrog-azure-devops-extension.
# Extracted from .github/workflows/staging.yml so it can be run either from
# GitHub Actions or directly on a developer's machine.
#
# Expected environment variables:
#   ADO_ARTIFACTORY_DEVELOPER - Artifactory developer identifier used for the staging publish
#   ADO_ARTIFACTORY_API_KEY   - Azure DevOps Marketplace / Artifactory API key used to publish
#
# To run locally: export the variables above, then run this script from the
# root of a checkout of the dev branch with Node.js already installed.

npm run publish-private
