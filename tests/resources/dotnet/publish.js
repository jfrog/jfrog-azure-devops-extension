const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'DotNET Test',
    buildNumber: '7'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
