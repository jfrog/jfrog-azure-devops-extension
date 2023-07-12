const testUtils = require('../../testUtils');
const join = require('path').join;
const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    buildName: 'DotNET Test',
    buildNumber: '7',
    command: 'restore',
    rootPath: join(testUtils.getLocalTestDir(TEST_NAME)),
    targetResolveRepo: testUtils.getRepoKeys().nugetVirtualRepo,
    packagesDirectory: join(testUtils.getLocalTestDir(TEST_NAME), 'packages'),
    verbosityRestore: 'Minimal',
    collectBuildInfo: true,
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'restore');
testUtils.runArtifactoryTask(testUtils.dotnet, {}, inputs);
