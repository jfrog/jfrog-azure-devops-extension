const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'includeEnv',
    buildNumber: '3',
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
