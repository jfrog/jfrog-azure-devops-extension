const testUtils = require('../../testUtils');
const { platformDockerDomain } = require('../../testUtils');

let inputs = {
    command: 'Scan',
    imageName: `${platformDockerDomain}/docker-local/docker-test:1`
};

testUtils.runXrayTask(testUtils.docker, {}, inputs);
