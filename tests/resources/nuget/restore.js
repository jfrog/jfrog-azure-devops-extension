const testUtils = require('../../testUtils');
const join = require('path').join;
const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    buildName: 'NuGet Test',
    buildNumber: '3',
    command: 'restore',
    solutionPath: join(testUtils.getLocalTestDir(TEST_NAME), '**', '*.sln'),
    targetResolveRepo: testUtils.getRepoKeys().nugetVirtualRepo,
    packagesDirectory: join(testUtils.getLocalTestDir(TEST_NAME), 'packages'),
    verbosityRestore: 'Detailed',
    collectBuildInfo: true,
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'restore');
testUtils.runArtifactoryTask(testUtils.nuget, {}, inputs);
