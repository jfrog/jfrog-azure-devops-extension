const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'excludeEnv',
    buildNumber: '3',
    excludeEnvVars: '*password*'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
