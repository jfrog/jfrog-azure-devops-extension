const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildPromoteDryRun',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
