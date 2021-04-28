const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'dockerTest',
    buildNumber: '2',
    command: 'pull',
    collectBuildInfo: true,
    sourceRepo: testUtils.artifactoryDockerRepo,
    imageName: testUtils.artifactoryDockerDomain + '/docker-test:1'
};

testUtils.runArtifactoryTask(testUtils.docker, {}, inputs);
