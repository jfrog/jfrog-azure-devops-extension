const testUtils = require('../../testUtils');
const { platformDockerDomain } = require('../../testUtils');

let inputs = {
    buildName: 'dockerTest',
    buildNumber: '2',
    command: 'Pull',
    collectBuildInfo: true,
    imageName: `${platformDockerDomain}/docker-local/docker-test:1`
};

testUtils.runArtifactoryTask(testUtils.docker, {}, inputs);
