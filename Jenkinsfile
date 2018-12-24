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

    stage('Merge to master') {
        sh("git merge origin/dev")
    }

    stage ('Bump version') {
        sh("node-v${NPM_VERSION}-linux-x64/bin/node buildScripts/bump-version.js -v ${ADO_ARTIFACTORY_VERSION}")
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

    stage('Commit release version') {
        sh("git commit -am '[artifactory-release] Release version ${ADO_ARTIFACTORY_VERSION}'")
    }

    wrap([$class: 'MaskPasswordsBuildWrapper', varPasswordPairs: [[password: '$GITHUB_PASSWORD', var: 'SECRET']]]) {
        stage('Push changes') {
            sh("git push https://${GITHUB_USERNAME}:${GITHUB_PASSWORD}@github.com/jfrog/artifactory-vsts-extension.git")
        }

        stage('Create tag') {
            sh("git tag '${ADO_ARTIFACTORY_VERSION}'")
            sh("git push https://${GITHUB_USERNAME}:${GITHUB_PASSWORD}@github.com/jfrog/artifactory-vsts-extension.git --tags")
        }

        stage('Merge to dev') {
            sh '''#!/bin/bash
                set -euxo pipefail
                git checkout dev
                git merge origin/master
                git push https://${GITHUB_USERNAME}:${GITHUB_PASSWORD}@github.com/jfrog/artifactory-vsts-extension.git
            '''
        }
    }

    stage('Publish extension') {
        wrap([$class: 'MaskPasswordsBuildWrapper', varPasswordPairs: [[password: '$ADO_PUBLISHER_API_KEY', var: 'SECRET']]]) {
            sh '''#!/bin/bash
                set -euxo pipefail
                export PATH="${PWD}/node-v${NPM_VERSION}-linux-x64/bin:${PATH}"
                tfx extension publish -t ${ADO_PUBLISHER_API_KEY}
            '''
        }
    }
}