const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'downloadArtifactSourceBuild',
    buildNumber: '5'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
