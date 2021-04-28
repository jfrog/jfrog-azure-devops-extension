const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'dockerTest',
    buildNumber: '1',
    command: 'push',
    collectBuildInfo: true,
    targetRepo: testUtils.artifactoryDockerRepo,
    imageName: testUtils.artifactoryDockerDomain + '/docker-test:1'
};

testUtils.runArtifactoryTask(testUtils.docker, {}, inputs);
