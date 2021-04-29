const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildDiscard',
    buildNumber: '2'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
