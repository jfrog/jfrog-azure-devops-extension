const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildPromoteDryRun',
    buildNumber: '3',
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
