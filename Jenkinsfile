node {
    cleanWs()

    stage ('Clone') {
        git url: 'https://github.com/jfrog/artifactory-vsts-extension.git'
    }

    stage ('Downloading npm') {
        sh '''#!/bin/bash
            set -euxo pipefail
            echo "Downloading npm..."
            wget https://nodejs.org/dist/v${NPM_VERSION}/node-v${NPM_VERSION}-linux-x64.tar.xz
            tar -xvf node-v${NPM_VERSION}-linux-x64.tar.xz
        '''
    }

    stage ('Create extension') {
        sh '''#!/bin/bash
            set -euxo pipefail
            export PATH="${PWD}/node-v${NPM_VERSION}-linux-x64/bin:${PATH}"
            npm i --prefix=buildScripts
            node buildScripts/build.js
            npm install -g tfx-cli
            tfx extension create
        '''
    }

    stage ('Bump version') {
        sh("node-v${NPM_VERSION}-linux-x64/bin/node buildScripts/bump-version.js -v ${VSTS_ARTIFACTORY_VERSION}")
    }

    stage('Commit release version') {
        sh("git commit -am '[artifactory-release] Release version ${VSTS_ARTIFACTORY_VERSION}'")
    }

    stage('Push changes') {
        sh("git push https://${GITHUB_USERNAME}:${GITHUB_PASSWORD}@github.com/jfrog/artifactory-vsts-extension.git 2>&1 | grep -v http")
    }

    stage('Publish extension') {
        sh("tfx extension publish -t ${VSTS_PUBLISHER_API_KEY}")
    }

    stage('Create tag') {
        sh("git tag '${VSTS_ARTIFACTORY_VERSION}'")
        sh("git push https://${GITHUB_USERNAME}:${GITHUB_PASSWORD}@github.com/jfrog/artifactory-vsts-extension.git --tags 2>&1 | grep -v http")
    }
}