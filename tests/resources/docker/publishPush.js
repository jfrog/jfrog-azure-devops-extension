const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'dockerTest',
    buildNumber: '1'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
