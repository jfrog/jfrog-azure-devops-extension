#!/usr/bin/env bash
set -euo pipefail

# Release script for jfrog-azure-devops-extension.
# Extracted from .github/workflows/release.yml so it can be run either from
# GitHub Actions or directly on a developer's machine.
#
# Expected environment variables:
#   NEXT_VERSION         - version to release, e.g. 2.1.0
#   IL_AUTOMATION_TOKEN  - GitHub token with push access to jfrog/jfrog-azure-devops-extension
#   ARTIFACTORY_URL      - JFrog Artifactory URL
#   ARTIFACTORY_USER     - JFrog Artifactory user
#   ARTIFACTORY_APIKEY   - JFrog Artifactory API key/password
#   AZURE_DEVOPS_TOKEN   - Azure DevOps Marketplace publish token
#
# To run locally: export the variables above, then run this script from the
# root of a checkout of the v2 branch with the JFrog CLI (`jf`) already
# installed and on PATH.

# Always clean up the JFrog CLI config, even if an earlier command fails
# (mirrors the "Cleanup JFrog CLI config" step's `if: always()` behavior).
cleanup() {
  jf c rm --quiet
}
trap cleanup EXIT

git config user.name "jfrog-ecosystem-integration"
git config user.email "eco-system@jfrog.com"
git remote set-url origin https://${IL_AUTOMATION_TOKEN}@github.com/jfrog/jfrog-azure-devops-extension.git
git fetch origin dev

jf c rm --quiet
jf c add internal --url=${ARTIFACTORY_URL} --access-token=${ARTIFACTORY_APIKEY}

git merge origin/dev

npm i --unsafe-perm --prefix=buildScripts
node buildScripts/bump-version.js -v "${NEXT_VERSION}"
git commit -am "[jfrog-release] Release version ${NEXT_VERSION}"
git tag "${NEXT_VERSION}"

npm i --unsafe-perm
jf audit --fail=false
npm run create

find . -iname "JFrog.jfrog-azure-devops-extension-${NEXT_VERSION}.vsix" -size +15M | grep .

jf rt u "JFrog.jfrog-azure-devops-extension-${NEXT_VERSION}.vsix" ecosys-jfrog-azure-devops-extension/
jf rt bag && jf rt bce
jf rt bp

npx tfx extension publish -t ${AZURE_DEVOPS_TOKEN}

git push origin v2
git push origin --tags

git checkout dev
git merge origin/v2
git push origin dev
