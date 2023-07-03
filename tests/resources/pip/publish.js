const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Pip Test',
    buildNumber: '17',
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
