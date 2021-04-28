const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Go Test',
    buildNumber: '3'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
