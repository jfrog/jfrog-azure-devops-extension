const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Maven Test',
    buildNumber: '3'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
