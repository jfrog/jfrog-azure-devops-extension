const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'downloadArtifactSource',
    buildNumber: '5'
};

testUtils.runTask(testUtils.publish, {}, inputs);
