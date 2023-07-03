const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildDiscard',
    buildNumber: '4',
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
