const tmrm = require('azure-pipelines-task-lib/mock-run');
const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const fs = require('fs-extra');
const rimraf = require('rimraf');
const syncRequest = require('sync-request');
const testDataDir = path.join(__dirname, 'testData');
const repoKeysPath = path.join(testDataDir, 'configuration', 'repoKeys');
const devnull = require('dev-null');
const assert = require('assert');
let artifactoryUrl = process.env.ADO_ARTIFACTORY_URL;
let artifactoryUsername = process.env.ADO_ARTIFACTORY_USERNAME;
let artifactoryPassword = process.env.ADO_ARTIFACTORY_PASSWORD;
let artifactoryAccessToken = process.env.ADO_ARTIFACTORY_ACCESS_TOKEN;
let artifactoryDockerDomain = process.env.ADO_ARTIFACTORY_DOCKER_DOMAIN;
let artifactoryDockerRepo = process.env.ADO_ARTIFACTORY_DOCKER_REPO;
let skipTests = process.env.ADO_ARTIFACTORY_SKIP_TESTS ? process.env.ADO_ARTIFACTORY_SKIP_TESTS.split(',') : [];

const testReposPrefix = 'ado-extension-test';
let repoKeys = {
    repo0: 'repo0',
    repo1: 'repo1',
    repo2: 'repo2',
    mavenLocalRepo: 'maven-local',
    mavenRemoteRepo: 'maven-remote',
    nugetLocalRepo: 'nuget-local',
    nugetRemoteRepo: 'nuget-remote',
    nugetVirtualRepo: 'nuget-virtual',
    npmLocalRepo: 'npm-local',
    npmRemoteRepo: 'npm-remote',
    npmVirtualRepo: 'npm-virtual',
    conanLocalRepo: 'conan-local',
    goLocalRepo: 'go-local',
    goRemoteRepo: 'go-remote',
    goVirtualRepo: 'go-virtual'
};

module.exports = {
    testDataDir: testDataDir,
    repoKeysPath: repoKeysPath,
    artifactoryDockerDomain: artifactoryDockerDomain,
    artifactoryDockerRepo: artifactoryDockerRepo,
    artifactoryUrl: artifactoryUrl,
    artifactoryPassword: artifactoryPassword,
    artifactoryUsername: artifactoryUsername,

    promote: path.join(__dirname, '..', 'tasks', 'ArtifactoryBuildPromotion', 'buildPromotion.js'),
    conan: path.join(__dirname, '..', 'tasks', 'ArtifactoryConan', 'conanBuild.js'),
    docker: path.join(__dirname, '..', 'tasks', 'ArtifactoryDocker', 'dockerBuild.js'),
    download: path.join(__dirname, '..', 'tasks', 'ArtifactoryGenericDownload', 'Ver2', 'downloadArtifacts.js'),
    upload: path.join(__dirname, '..', 'tasks', 'ArtifactoryGenericUpload', 'uploadArtifacts.js'),
    maven: path.join(__dirname, '..', 'tasks', 'ArtifactoryMaven', 'mavenBuild.js'),
    npm: path.join(__dirname, '..', 'tasks', 'ArtifactoryNpm', 'npmBuild.js'),
    nuget: path.join(__dirname, '..', 'tasks', 'ArtifactoryNuget', 'nugetBuild.js'),
    publish: path.join(__dirname, '..', 'tasks', 'ArtifactoryPublishBuildInfo', 'publishBuildInfo.js'),
    discard: path.join(__dirname, '..', 'tasks', 'ArtifactoryDiscardBuilds', 'discardBuilds.js'),
    properties: path.join(__dirname, '..', 'tasks', 'ArtifactoryProperties', 'properties.js'),
    go: path.join(__dirname, '..', 'tasks', 'ArtifactoryGo', 'goBuild.js'),

    initTests: initTests,
    runTask: runTask,
    getTestName: getTestName,
    getTestLocalFilesDir: getTestLocalFilesDir,
    getLocalTestDir: getLocalTestDir,
    getRemoteTestDir: getRemoteTestDir,
    isRepoExists: isRepoExists,
    getBuild: getBuild,
    deleteBuild: deleteBuild,
    copyTestFilesToTestWorkDir: copyTestFilesToTestWorkDir,
    isWindows: isWindows,
    cleanUpAllTests: cleanUpAllTests,
    isSkipTest: isSkipTest,
    getRepoKeys: getRepoKeys
};

function initTests() {
    process.env.JFROG_CLI_REPORT_USAGE = false;
    process.env.JFROG_CLI_OFFER_CONFIG = false;
    process.env.JFROG_CLI_LOG_LEVEL = 'ERROR';
    tl.setStdStream(devnull());
    tl.setVariable('Agent.WorkFolder', testDataDir);
    tl.setVariable('Agent.TempDirectory', testDataDir);
    tl.setVariable('Agent.ToolsDirectory', testDataDir);

    cleanUpOldRepositories();
    recreateTestDataDir();
    createTestRepositories();
}

function runTask(testMain, variables, inputs) {
    variables['Agent.WorkFolder'] = testDataDir;
    variables['Agent.TempDirectory'] = testDataDir;
    variables['Agent.ToolsDirectory'] = testDataDir;
    variables['System.DefaultWorkingDirectory'] = testDataDir;

    let tmr = new tmrm.TaskMockRunner(testMain);

    setVariables(variables);
    setArtifactoryCredentials();
    mockGetInputs(inputs);

    tmr.registerMock('azure-pipelines-task-lib/mock-task', tl);
    tmr.run();
}

function recreateTestDataDir() {
    if (fs.existsSync(testDataDir)) {
        rimraf.sync(testDataDir);
    }
    fs.mkdirSync(testDataDir);
}

function getBuild(buildName, buildNumber) {
    return syncRequest('GET', stripTrailingSlash(artifactoryUrl) + '/api/build/' + buildName + '/' + buildNumber, {
        headers: {
            Authorization: getAuthorizationHeaderValue()
        }
    });
}

function deleteBuild(buildName) {
    syncRequest('DELETE', stripTrailingSlash(artifactoryUrl) + '/api/build/' + buildName + '?deleteAll=1', {
        headers: {
            Authorization: getAuthorizationHeaderValue()
        }
    });
}

function cleanUpAllTests() {
    if (fs.existsSync(testDataDir)) {
        rimraf(testDataDir, err => {
            if (err) {
                console.warn('Tests cleanup issue: ' + err);
            }
        });
    }
    deleteTestRepositories();
}

function createTestRepositories() {
    createUniqueReposKeys();
    createRepo(repoKeys.repo1, JSON.stringify({ rclass: 'local', packageType: 'generic' }));
    createRepo(repoKeys.repo2, JSON.stringify({ rclass: 'local', packageType: 'generic' }));
    createRepo(repoKeys.mavenLocalRepo, JSON.stringify({ rclass: 'local', packageType: 'maven' }));
    createRepo(repoKeys.mavenRemoteRepo, JSON.stringify({ rclass: 'remote', packageType: 'maven', url: 'https://jcenter.bintray.com' }));
    createRepo(repoKeys.nugetLocalRepo, JSON.stringify({ rclass: 'local', packageType: 'nuget', repoLayoutRef: 'nuget-default' }));
    createRepo(
        repoKeys.nugetVirtualRepo,
        JSON.stringify({
            rclass: 'virtual',
            packageType: 'nuget',
            repoLayoutRef: 'nuget-default',
            repositories: [repoKeys.nugetRemoteRepo, repoKeys.nugetLocalRepo]
        })
    );
    createRepo(repoKeys.npmLocalRepo, JSON.stringify({ rclass: 'local', packageType: 'npm', repoLayoutRef: 'npm-default' }));
    createRepo(
        repoKeys.npmRemoteRepo,
        JSON.stringify({ rclass: 'remote', packageType: 'npm', repoLayoutRef: 'npm-default', url: 'https://registry.npmjs.org' })
    );
    createRepo(
        repoKeys.npmVirtualRepo,
        JSON.stringify({
            rclass: 'virtual',
            packageType: 'npm',
            repoLayoutRef: 'npm-default',
            repositories: [repoKeys.npmLocalRepo, repoKeys.npmRemoteRepo]
        })
    );
    createRepo(repoKeys.conanLocalRepo, JSON.stringify({ rclass: 'local', packageType: 'conan' }));
    createRepo(repoKeys.goLocalRepo, JSON.stringify({ rclass: 'local', packageType: 'go', repoLayoutRef: 'go-default' }));
    createRepo(
        repoKeys.goRemoteRepo,
        JSON.stringify({ rclass: 'remote', packageType: 'go', repoLayoutRef: 'go-default', url: 'https://gocenter.io' })
    );
    createRepo(
        repoKeys.goVirtualRepo,
        JSON.stringify({
            rclass: 'virtual',
            packageType: 'go',
            repoLayoutRef: 'go-default',
            repositories: [repoKeys.goLocalRepo, repoKeys.goRemoteRepo]
        })
    );
}

/**
 * Creates unique repositories keys, and writes them to file for later access by the tests.
 */
function createUniqueReposKeys() {
    let timestamp = getCurrentTimestamp();
    Object.keys(repoKeys).forEach(repoVar => {
        repoKeys[repoVar] = [testReposPrefix, repoKeys[repoVar]].join('-');
        // There is a bug in Artifactory when creating a remote nuget repository [RTFACT-10628]. Cannot be created via REST API. Need to create manually.
        if (repoKeys[repoVar] !== repoKeys.nugetRemoteRepo) {
            repoKeys[repoVar] = [repoKeys[repoVar], timestamp].join('-');
        }
    });
    fs.outputFileSync(repoKeysPath, JSON.stringify(repoKeys));
}

/**
 * Returns the current timestamp in seconds
 */
function getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000);
}

/**
 * Reads the configured repositories keys from file.
 */
function getRepoKeys() {
    return JSON.parse(fs.readFileSync(repoKeysPath, 'utf8'));
}

function deleteTestRepositories() {
    Object.values(repoKeys)
        .filter(repoKey => repoKey !== repoKeys.nugetRemoteRepo)
        .forEach(deleteRepo);
}

/**
 * Deletes repositories older than 24 hours that match the tests repository key pattern.
 */
function cleanUpOldRepositories() {
    let repoKeysList = getRepoListFromArtifactory();
    let repoPattern = new RegExp('^' + testReposPrefix + '(-\\w*)+-(\\d*)$');

    // Search and delete matching repositories
    repoKeysList.forEach(repoKey => {
        let regexGroups = repoPattern.exec(repoKey);
        // If does not match pattern, continue
        if (!regexGroups) {
            return;
        }
        let repoTimestamp = parseInt(regexGroups.pop(), 10);
        // Convert unix timestamp to time
        let timeDifference = new Date(Math.floor(getCurrentTimestamp() - repoTimestamp) * 1000);
        // If more than 24 hours have passed, delete the repository.
        if (timeDifference.getHours() > 24) {
            deleteRepo(repoKey);
        }
    });
}

function getRepoListFromArtifactory() {
    let res = syncRequest('GET', stripTrailingSlash(artifactoryUrl) + '/api/repositories/', {
        headers: {
            Authorization: getAuthorizationHeaderValue()
        }
    });
    assert(
        res.statusCode === 200 || res.statusCode === 201,
        'Failed getting repositories from Artifactory. Status code: ' + res.statusCode + '. Error: ' + res.getBody('utf8')
    );
    let repoArray = JSON.parse(res.getBody('utf8'));
    return repoArray.map(repo => repo.key);
}

function createRepo(repoKey, body) {
    let res = syncRequest('PUT', stripTrailingSlash(artifactoryUrl) + '/api/repositories/' + repoKey, {
        headers: {
            Authorization: getAuthorizationHeaderValue(),
            'Content-Type': 'application/json'
        },
        body: body
    });
    assert(
        res.statusCode === 200 || res.statusCode === 201,
        'Failed creating repo: ' + repoKey + '. Status code: ' + res.statusCode + '. Error: ' + res.getBody('utf8')
    );
    return res;
}

function isRepoExists(repoKey) {
    let res = syncRequest('GET', stripTrailingSlash(artifactoryUrl) + '/api/repositories/' + repoKey, {
        headers: {
            Authorization: getAuthorizationHeaderValue()
        }
    });
    return res.statusCode === 200;
}

function deleteRepo(repoKey) {
    syncRequest('DELETE', stripTrailingSlash(artifactoryUrl) + '/api/repositories/' + repoKey, {
        headers: {
            Authorization: getAuthorizationHeaderValue(),
            'Content-Type': 'application/json'
        }
    });
}

function getAuthorizationHeaderValue() {
    if (artifactoryAccessToken) {
        return 'Bearer ' + artifactoryAccessToken;
    } else {
        return 'Basic ' + new Buffer.from(artifactoryUsername + ':' + artifactoryPassword).toString('base64');
    }
}

function setArtifactoryCredentials() {
    tl.getEndpointUrl = () => {
        return artifactoryUrl;
    };
    tl.getEndpointAuthorizationParameter = (id, key, optional) => {
        if (key === 'username') {
            return artifactoryUsername;
        }
        if (key === 'password') {
            return artifactoryPassword;
        }
        if (key === 'apitoken') {
            return artifactoryAccessToken;
        }
    };
}

/**
 * Returns an array of files contained in folderToCopy
 */
function getResourcesFiles(folderToCopy) {
    let dir = path.join(__dirname, 'resources', folderToCopy);
    let files = fs.readdirSync(dir);
    let fullFilesPath = [];
    for (let i = 0; i < files.length; i++) {
        fullFilesPath.push(path.join(dir, files[i]));
    }
    return fullFilesPath;
}

/**
 * Copies all files exists in "tests/<testDirName>/<folderToCopy>" to a corresponding folder under "testDataDir/<testDirName>"
 * @param testDirName - test directory
 * @param folderToCopy - the folder to copy from the test
 */
function copyTestFilesToTestWorkDir(testDirName, folderToCopy) {
    let files = getResourcesFiles(path.join(testDirName, folderToCopy));

    if (!fs.existsSync(path.join(testDataDir, testDirName))) {
        fs.mkdirSync(path.join(testDataDir, testDirName));
    }

    for (let i = 0; i < files.length; i++) {
        fs.copyFileSync(files[i], path.join(getLocalTestDir(testDirName), path.basename(files[i])));
    }
}

function setVariables(variables) {
    for (let [key, value] of Object.entries(variables)) {
        tl.setVariable(key, value);
    }
}

/**
 * Override tl.getInput(), tl.getBoolInput() and tl.getPathInput() functions.
 * The test will return inputs[name] instead of using the original functions.
 * @param inputs - (String) - Test inputs
 */
function mockGetInputs(inputs) {
    tl.getInput = tl.getBoolInput = tl.getPathInput = (name, required) => {
        return inputs[name];
    };
}

function getTestName(testDir) {
    return path.basename(testDir);
}

function getLocalTestDir(testName) {
    return path.join(testDataDir, testName, '/');
}

function getTestLocalFilesDir(testDir) {
    return path.join(testDir, 'files', '/');
}

function getRemoteTestDir(repo, testName) {
    return repo + '/' + testName + '/';
}

function isWindows() {
    return process.platform.startsWith('win');
}

function isSkipTest(skipValue) {
    return skipTests.indexOf(skipValue) !== -1;
}

function stripTrailingSlash(str) {
    return str.endsWith('/') ? str.slice(0, -1) : str;
}
