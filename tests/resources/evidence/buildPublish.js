const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Evidence Test',
    buildNumber: '1',
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
