const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildPromote',
    buildNumber: '3'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
