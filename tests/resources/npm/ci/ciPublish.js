const testUtils = require('../../../testUtils');

let inputs = {
    buildName: 'npm Test',
    buildNumber: '2',
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
