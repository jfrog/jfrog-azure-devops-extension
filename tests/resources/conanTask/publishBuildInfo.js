const testUtils = require('../../testUtils');
const basename = require('path').basename;

const TEST_NAME = basename(__dirname);
const BUILD_NAME = TEST_NAME;
const BUILD_NUMBER = '1';

let inputs = {
    buildName: BUILD_NAME,
    buildNumber: BUILD_NUMBER,
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
