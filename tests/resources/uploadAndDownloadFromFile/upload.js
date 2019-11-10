const testUtils = require('../../testUtils');
const path = require('path');
const fs = require('fs-extra');
const TEST_NAME = testUtils.getTestName(__dirname);

const specPath = path.join(testUtils.testDataDir, "uploadSpec.json");

fs.writeFileSync(specPath, JSON.stringify({
    files: [{
        pattern: testUtils.getTestLocalFilesDir(__dirname),
        target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME)
    }]
}), "utf8");

let inputs = {
    "specSource": "file",
    "file": specPath,
    "failNoOp": true
};

testUtils.runTask(testUtils.upload, {}, inputs);
