const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'downloadArtifactSource1',
    buildNumber: '5'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
