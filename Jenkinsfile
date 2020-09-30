node("docker") {
    cleanWs()

    stage('Clone') {
        sh 'git clone https://github.com/jfrog/artifactory-azure-devops-extension.git'
    }

    stage('Install Prerequisites') {
        sh '''#!/bin/bash
            apt update
            apt install wget -y
            apt install file
        '''
    }

    stage('Downloading npm') {
        sh '''#!/bin/bash
            set -euxo pipefail
            echo "Downloading npm..."
            wget https://nodejs.org/dist/v${NPM_VERSION}/node-v${NPM_VERSION}-linux-x64.tar.xz
            tar -xvf node-v${NPM_VERSION}-linux-x64.tar.xz
        '''
    }

    withEnv(["PATH+=${WORKSPACE}/node-v${NPM_VERSION}-linux-x64/bin"]) {
        dir('artifactory-azure-devops-extension') {

            stage('Merge to master') {
                sh("git merge origin/dev")
            }

            stage('Bump version') {
                sh '''#!/bin/bash
                    set -euxo pipefail
                    npm i --prefix=buildScripts
                    node buildScripts/bump-version.js -v ${ADO_ARTIFACTORY_VERSION}
                '''
            }

            stage('Create extension') {
                sh '''#!/bin/bash
                    set -euxo pipefail
                    npm i
                    npm run create
                '''
            }

            stage('Git config') {
                sh '''#!/bin/bash
                    git config user.name "jfrog-ecosystem"
                    git config user.email "eco-system@jfrog.com"
                '''
            }

            stage('Commit release version') {
                sh("git commit -am '[artifactory-release] Release version ${ADO_ARTIFACTORY_VERSION}'")
            }

            wrap([$class: 'MaskPasswordsBuildWrapper', varPasswordPairs: [[password: 'GITHUB_API_KEY', var: 'SECRET']]]) {
                stage('Push changes') {
                    sh("git push https://${GITHUB_USERNAME}:${GITHUB_API_KEY}@github.com/jfrog/artifactory-azure-devops-extension.git")
                }

                stage('Create tag') {
                    sh("git tag '${ADO_ARTIFACTORY_VERSION}'")
                    sh("git push https://${GITHUB_USERNAME}:${GITHUB_API_KEY}@github.com/jfrog/artifactory-azure-devops-extension.git --tags")
                }

                stage('Merge to dev') {
                    sh '''#!/bin/bash
                    set -euxo pipefail
                    git checkout dev
                    git merge master
                    git push https://${GITHUB_USERNAME}:${GITHUB_API_KEY}@github.com/jfrog/artifactory-azure-devops-extension.git
                    '''
                }
            }

            stage('Publish extension') {
                withCredentials([string(credentialsId: 'azure-devops-publisher', variable: 'ADO_PUBLISHER_API_KEY')]) {
                    sh '''#!/bin/bash
                        set -euxo pipefail
                        ./node_modules/tfx-cli/_build/tfx-cli.js extension publish -t ${ADO_PUBLISHER_API_KEY}
                    '''
                }
            }
        }
    }
}
