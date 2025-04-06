const testUtils = require('../../testUtils');
const { platformDockerDomain } = require('../../testUtils');

let inputs = {
    buildName: 'dockerTest',
    buildNumber: '2',
    command: 'Pull',
    collectBuildInfo: true,
    imageName: `${platformDockerDomain}/${testUtils.getRepoKeys().dockerLocalRepo}/docker-test:1`,
};

testUtils.runArtifactoryTask(testUtils.docker, {}, inputs);
