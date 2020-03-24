const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Collect issues',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
