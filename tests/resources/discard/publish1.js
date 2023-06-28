const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildDiscard',
    buildNumber: '1',
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
