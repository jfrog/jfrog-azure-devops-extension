const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'dockerTest',
    buildNumber: '2'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
