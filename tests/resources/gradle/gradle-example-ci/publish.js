const testUtils = require('../../../testUtils');

let inputs = {
    buildName: 'GradleCITest',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
