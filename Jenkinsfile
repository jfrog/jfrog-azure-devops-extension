node("docker") {
    cleanWs()

    stage('Clone and Checkout V1') {
        sh 'git clone https://github.com/jfrog/jfrog-azure-devops-extension.git'
        dir("jfrog-azure-devops-extension") {
            sh 'git checkout v1'
        }
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
            wget https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz
            tar -xvf node-v${NODE_VERSION}-linux-x64.tar.xz
        '''
    }

    withEnv(["PATH+=${WORKSPACE}/node-v${NODE_VERSION}-linux-x64/bin"]) {
        dir('jfrog-azure-devops-extension') {

            // If this variable is set to true, skip all git steps and move directly to release.
            if (!params.SKIP_GIT_STEPS) {
                stage('Git config') {
                    sh '''#!/bin/bash
                        git config user.name "jfrog-ecosystem"
                        git config user.email "eco-system@jfrog.com"
                    '''
                }

                stage('Merge to v1') {
                    sh("git merge origin/dev-v1")
                }

                stage('Bump version') {
                    sh '''#!/bin/bash
                        set -euxo pipefail
                        npm i --prefix=buildScripts
                        node buildScripts/bump-version.js -v ${ADO_ARTIFACTORY_VERSION}
                    '''
                }

                stage('Commit release version') {
                    sh("git commit -am '[artifactory-release] Release version ${ADO_ARTIFACTORY_VERSION}'")
                }

                wrap([$class: 'MaskPasswordsBuildWrapper', varPasswordPairs: [[password: 'GITHUB_API_KEY', var: 'SECRET']]]) {
                    stage('Push changes') {
                        sh("git push https://${GITHUB_USERNAME}:${GITHUB_API_KEY}@github.com/jfrog/jfrog-azure-devops-extension.git")
                    }

                    stage('Create tag') {
                        sh("git tag '${ADO_ARTIFACTORY_VERSION}'")
                        sh("git push https://${GITHUB_USERNAME}:${GITHUB_API_KEY}@github.com/jfrog/jfrog-azure-devops-extension.git --tags")
                    }

                    stage('Merge to dev-v1') {
                        sh '''#!/bin/bash
                        set -euxo pipefail
                        git checkout dev-v1
                        git merge v1
                        git push https://${GITHUB_USERNAME}:${GITHUB_API_KEY}@github.com/jfrog/jfrog-azure-devops-extension.git
                        git checkout v1
                        '''
                    }
                }
            }

            stage('Create extension') {
                sh '''#!/bin/bash
                    set -euxo pipefail
                    npm i --unsafe-perm
                    npm run create
                    # Verify vsix file is larger than 15M
                    find . -iname "JFrog.jfrog-artifactory-vsts-extension*" -size +15M | grep .
                '''
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
